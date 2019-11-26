const PROMQL_SYMBOLS = "(){}[]"; // symbol
const MATH_SIGNS = "+-*/"; // sign
const COMPARE_SIGNS = "<>="; // compare

// PromQL examples:
// histogram_quantile(0.99, sum(rate(tidb_session_transaction_duration_seconds_bucket[1m]) + 10) by (le, sql_type))
// sum(increase(node_cpu_seconds_total{mode!="idle"}[3m])) by (instance) / sum(increase(node_cpu_seconds_total[3m])) by (instance)
type ExprItemType =
  | "sign" // `+-*/`
  | "compare" // <>=
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
}

function combineExprArr(exprArr: ExprItem[]) {
  return exprArr
    .map(item =>
      item.type === "sign" || item.type === "compare" || item.type === "by"
        ? ` ${item.val} `
        : item.val
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

  enqueExpr(exprType: ExprItemType) {
    if (this.curCommonChars.length === 0) {
      return;
    }
    this.exprArr.push({
      val: this.curCommonChars.join(""),
      type: exprType
    });
    this.curCommonChars = [];
  }

  // PromQL: load1 + 5
  // 应该视 5 为 const_number，而不是 metric
  enqueueMetricOrNumber() {
    if (isNumber(this.curCommonChars.join(""))) {
      this.enqueExpr("const_number");
    } else {
      this.enqueExpr("metric");
    }
  }

  // 算法：
  // 因为不会编译原理，所以采用简单粗暴的方法，逐个字符进行分析
  // 后面考虑用词法解析的方法来解析，这也应该是正确的方法
  parse() {
    let i = 0;
    let handleTags = false;
    let handleBy = false;
    while (i < this.promQL.length) {
      const char = this.promQL[i];

      if (PROMQL_SYMBOLS.includes(char)) {
        // symbol
        switch (char) {
          case "(":
            // '(' 之前，如果 commonChars.length > 0，则为函数 或 by
            if (this.curCommonChars.join("") === "by") {
              this.enqueExpr("by");
              // 处理 by 剩余内容
              const byEnd = this.promQL.indexOf(")", i);
              this.exprArr.push({
                val: this.promQL.slice(i, byEnd + 1),
                type: "by_target"
              });
              i = byEnd + 1;
              handleBy = true;
            } else {
              this.enqueExpr("fn");
            }
            break;
          case ")":
            // ')' 之前，如果 commonChars.length > 0，则为 metric 或 const_number
            this.enqueueMetricOrNumber();
            break;
          case "{":
            // '{' 之前是 metric，this.commonChars 必须大于 0
            this.enqueExpr("metric");
            // 处理 tags
            this.exprArr.push({ val: "{", type: "symbol" });
            const tagsEnd = this.promQL.indexOf("}", i);
            this.exprArr.push({
              val: this.promQL.slice(i + 1, tagsEnd),
              type: "tags"
            });
            this.exprArr.push({ val: "}", type: "symbol" });
            i = tagsEnd + 1;
            handleTags = true;
            break;
          case "}":
            // '}' 之前是 tags
            this.enqueExpr("tags");
            break;
          case "[":
            // '[' 之前，如果 commonChars 大于 0，则为 metric
            this.enqueExpr("metric");
            break;
          case "]":
            // ']' 之前是 duration, this.commonChars 必须大于 0
            this.enqueExpr("duration");
            break;
        }
        if (!handleBy && !handleTags) {
          // 放入 exprArr 中
          this.exprArr.push({ val: char, type: "symbol" });
        }
      } else if (MATH_SIGNS.includes(char)) {
        // 减号 `-`，也可能是用于标志负数，比如有个 grafana 中的 PromQL 表达式是 `sum(...) by (instance) > -30` (怀疑这个表达式是不是能真的工作哦，那结果岂不是只有 0 和 1)
        let isNegative = false;
        if (char === "-") {
          const lastExpr = this.exprArr[this.exprArr.length - 1];
          if (lastExpr && lastExpr.type === "compare") {
            // 前一个符号是比较值，说明是负号，作为普通字符放放 curCommonChars
            this.curCommonChars.push(char);
            isNegative = true;
          }
        }
        if (!isNegative) {
          this.enqueueMetricOrNumber();
          this.exprArr.push({ val: char, type: "sign" });
        }
      } else if (COMPARE_SIGNS.includes(char)) {
        if (char !== "=") {
          this.enqueueMetricOrNumber();
          this.exprArr.push({ val: char, type: "compare" });
        } else {
          this.curCommonChars.push(char);
          if (this.curCommonChars.length === 2) {
            this.enqueExpr("compare");
          }
        }
      } else if (char !== " ") {
        // common char except ' '
        this.curCommonChars.push(char);
        if (char === ",") {
          // 在 ',' 后面补一个空格
          this.curCommonChars.push(" ");
        }
      }
      if (!handleBy && !handleTags) {
        i++;
      }
      handleBy = false;
      handleTags = false;
    }
    // 最后再处理 commonChars 中的内容
    this.enqueueMetricOrNumber();
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
