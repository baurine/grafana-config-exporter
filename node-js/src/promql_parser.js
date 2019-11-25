const PROMQL_SYMBOLS = "()[]{}";
const MATH_SIGNS = "+-*/";

function combineExprArr(exprArr) {
  return exprArr
    .map(item =>
      item.type === "sign" || item.type === "by" ? ` ${item.val} ` : item.val
    )
    .join("");
}

// load1 + load5
// (sum(load1) + 5)
// 5 + sum(load1)
// '5' -> const_num
// 'load1' -> metric
function isNumber(str) {
  return !isNaN(parseFloat(str));
}

class PromQLParser {
  constructor(promQL) {
    this.promQL = promQL;
    this.exprArr = []; // each item: {val: 'sum', type: 'sign|symbol|fn|metric|tags|duration|metric_tags|const_number|by|remain', pos: 2}
    this.curCommonChars = [];

    this.parse();
  }

  enqueExpr(exprType, curPos) {
    this.exprArr.push({
      val: this.curCommonChars.join(""),
      type: exprType,
      pos: curPos - this.curCommonChars.length
    });
    this.curCommonChars = [];
  }

  enqueueMetricOrNumber(pos) {
    if (isNumber(this.curCommonChars.join(""))) {
      this.enqueExpr("const_number", pos);
    } else {
      this.enqueExpr("metric", pos);
    }
  }

  parse() {
    let i = 0;
    let reachEnd = false; // 以 by 为标准
    let enterTags = false;
    for (i = 0; i < this.promQL.length; i++) {
      const char = this.promQL[i];

      if (enterTags && char !== "}") {
        this.curCommonChars.push(char);
        continue;
      }

      if (PROMQL_SYMBOLS.includes(char)) {
        // symbol
        switch (char) {
          case "(":
            // '(' 之前，如果 tempChars.length > 0，则为函数 或 by
            if (this.curCommonChars.length > 0) {
              if (this.curCommonChars.join("") === "by") {
                // parse 结束
                reachEnd = true;
                this.enqueExpr("by", i);
                // enque 剩下所有
                this.exprArr.push({
                  val: this.promQL.slice(i),
                  type: "remain",
                  pos: i
                });
              } else {
                this.enqueExpr("fn", i);
              }
            }
            break;
          case ")":
            // ')' 之前，如果 tempChars.length > 0，则为 metric 或 const_number
            // 如果 tempChars 为数字，则为 const_number
            if (this.curCommonChars.length > 0) {
              this.enqueueMetricOrNumber(i);
            }
            break;
          case "{":
            // '{' 之前是 metric，this.tempChars 必须大于 0
            this.enqueExpr("metric", i);
            enterTags = true;
            break;
          case "}":
            // '}' 之前是 tags
            this.enqueExpr("tags", i);
            enterTags = false;
            break;
          case "[":
            // '[' 之前，如果 tempChars 大于 0，则为 metric
            if (this.curCommonChars.length > 0) {
              this.enqueExpr("metric", i);
            }
            break;
          case "]":
            // ']' 之前是 duration, this.tempChars 必须大于 0
            this.enqueExpr("duration", i);
            break;
        }
        if (!reachEnd) {
          // 放入 exprArr 中
          this.exprArr.push({ val: char, type: "symbol", pos: i });
        }
      } else if (MATH_SIGNS.includes(char)) {
        // 如果 curCommonChars 不为空，那它有可能是 metric 或 const_number
        // edge case: "sum(rate(tikv_thread_cpu_seconds_total{name=~\"apply_[0-9]+\"}[1m])) by (instance)"
        // edge case: "go_memstats_heap_inuse_bytes{job=~\"tidb.*\"}"
        // 如果 * 前面是 . 号，那么这个 * 号并不是数学符号
        if (this.curCommonChars.length > 0) {
          // TODO: remove
          if (this.curCommonChars[this.curCommonChars.length - 1] === ".") {
            // 说明是通配符
            this.curCommonChars.push(char);
          } else {
            this.enqueueMetricOrNumber(i);
            this.exprArr.push({ val: char, type: "sign", pos: i });
          }
        } else {
          this.exprArr.push({ val: char, type: "sign", pos: i });
        }
      } else if (char !== " ") {
        // common char except ' '
        this.curCommonChars.push(char);
        if (char === ",") {
          // 在 ',' 后面补一个空格
          this.curCommonChars.push(" ");
        }
      }
      if (reachEnd) {
        break;
      }
    }
    if (this.curCommonChars.length > 0) {
      this.enqueueMetricOrNumber(i);
    }
  }

  combine() {
    return combineExprArr(this.exprArr);
  }

  injectToTags(extraTag, cleanVariablesInTags = false) {
    let newExprArr = [...this.exprArr];
    for (let i = 0; i < newExprArr.length; i++) {
      let curExpr = newExprArr[i];
      if (curExpr.type !== "metric") {
        continue;
      }

      // metric
      let tagsExpr = newExprArr[i + 2];
      if (tagsExpr && tagsExpr.type === "tags") {
        // 有对应的 tags expr
        tagsExpr.val = tagsExpr.val
          .split(",")
          .map(tag => tag.trim())
          .filter(tag =>
            // 清除含变量的 tag，比如 instance=~"$instance"
            cleanVariablesInTags ? tag.indexOf('"$') === -1 : true
          );
        if (extraTag !== "") {
          tagsExpr.val = tagsExpr.val.concat(extraTag);
        }
        tagsExpr.val = tagsExpr.val.join(", ");
      } else {
        // 没有 tags expr
        curExpr.val = curExpr.val + "{" + extraTag + "}";
        curExpr.type = "metric_tags";
      }
    }
    return combineExprArr(newExprArr);
  }
}

////////////////////////////////////////////

function genNewPromQL(oriPromQL, placeholder) {
  const parser = new PromQLParser(oriPromQL);
  return parser.injectToTags(placeholder, true);
}

////////////////////////////////////////////

module.exports = { PromQLParser, genNewPromQL };
