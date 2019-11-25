const PROMQL_SYMBOLS = "(){}[]"; // symbol
const MATH_SIGNS = "+-*/"; // sign

// PromQL examples:
// histogram_quantile(0.99, sum(rate(tidb_session_transaction_duration_seconds_bucket[1m]) + 10) by (le, sql_type))
// sum(increase(node_cpu_seconds_total{mode!="idle"}[3m])) by (instance) / sum(increase(node_cpu_seconds_total[3m])) by (instance)
type ExprItemType =
  | "sign" // `+-*/`
  | "symbol" // `(){}[]`
  | "fn" // `histogram_quantile`, `sum`, `rate`, `increase`...
  | "metric" // `node_cpu_seconds_total`, content before '{}'
  | "tags" // `mode!="idle", name~="xxx"`, content inside '{}'
  | "duration" // `1m`, content inside '[]'
  | "metric_tags" // `node_cpu_seconds_total{mode!="idle"}`, metric and tags
  | "const_number" // `10`, `0.99`, const number
  | "by" // `by`
  | "by_target"; // `(instance)`, content after by

interface ExprItem {
  val: string;
  type: ExprItemType;
  pos: number;
}

function combineExprArr(exprArr: ExprItem[]) {
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
function isNumber(str: string) {
  return !isNaN(parseFloat(str));
}

class PromQLParser {
  private readonly promQL: string;
  private exprArr: ExprItem[];
  private curCommonChars: string[];

  constructor(promQL: string) {
    this.promQL = promQL;
    this.exprArr = [];
    this.curCommonChars = []; // 暂存区

    this.parse();
  }

  enqueExpr(exprType: ExprItemType, curPos: number) {
    this.exprArr.push({
      val: this.curCommonChars.join(""),
      type: exprType,
      pos: curPos - this.curCommonChars.length
    });
    this.curCommonChars = [];
  }

  // PromQL: load1 + 5
  // 应该视 5 为 const_number
  enqueueMetricOrNumber(pos: number) {
    if (isNumber(this.curCommonChars.join(""))) {
      this.enqueExpr("const_number", pos);
    } else {
      this.enqueExpr("metric", pos);
    }
  }

  parse() {
    let i = 0;
    let enterTags = false;
    let handleBy = false;
    while (i < this.promQL.length) {
      const char = this.promQL[i];

      if (enterTags && char !== "}") {
        this.curCommonChars.push(char);
        i++;
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
                this.enqueExpr("by", i);
                // enque 剩下所有
                const byEnd = this.promQL.indexOf(")", i);
                this.exprArr.push({
                  val: this.promQL.slice(i, byEnd + 1),
                  type: "by_target",
                  pos: i
                });
                i = byEnd + 1;
                handleBy = true;
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
        if (!handleBy) {
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
      if (!handleBy) {
        i++;
      }
      handleBy = false;
    }
    if (this.curCommonChars.length > 0) {
      this.enqueueMetricOrNumber(i);
    }
  }

  combine() {
    return combineExprArr(this.exprArr);
  }

  insertTag(extraTag: string, cleanVariables = true) {
    let newExprArr = [...this.exprArr];
    for (let i = 0; i < newExprArr.length; i++) {
      let curExpr = newExprArr[i];
      if (curExpr.type !== "metric") {
        continue;
      }

      let tagsExpr = newExprArr[i + 2];
      if (tagsExpr && tagsExpr.type === "tags") {
        // 有对应的 tags expr
        let tagsArr = tagsExpr.val.split(",");
        tagsArr = tagsArr
          .map(tag => tag.trim())
          .filter(tag => tag !== "")
          .filter(tag =>
            // 清除含变量的 tag，比如 instance=~"$instance"
            cleanVariables ? tag.indexOf('"$') === -1 : true
          );
        if (extraTag !== "") {
          tagsArr = tagsArr.concat(extraTag);
        }
        tagsExpr.val = tagsArr.join(", ");
      } else if (extraTag !== "") {
        // 没有 tags expr
        // 将要插入的 tag 放到 metric expr item 中，并将其类型改成 metric_tags
        curExpr.val = curExpr.val + "{" + extraTag + "}";
        curExpr.type = "metric_tags";
      }
    }
    return combineExprArr(newExprArr);
  }
}

////////////////////////////////////////////

export function genNewPromQL(
  oriPromQL: string,
  extraTag: string = "",
  cleanVariables: boolean = true
) {
  const parser = new PromQLParser(oriPromQL);
  return parser.insertTag(extraTag, cleanVariables);
}
