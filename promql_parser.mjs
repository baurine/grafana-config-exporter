function genNewPromQL(oldPromQL, toInjectStr) {}

const promQLSymbols = '()[]{}+-*/'

export default class PromQLParser {
  constructor(promQL) {
    this.promQL = promQL
    this.exprArr = [] // item: {val: 'sum', type: 'symbol|fn|metric|tags|duration', pos: 2}
    this.curCommonChars = []
  }

  enqueExpr(exprType, curPos) {
    this.exprArr.push({
      val: this.curCommonChars.join(''),
      type: exprType,
      pos: curPos - this.curCommonChars.length
    })
    this.curCommonChars = []
  }

  parse() {
    for (let i = 0; i < this.promQL.length; i++) {
      const char = this.promQL[i]
      if (promQLSymbols.includes(char)) {
        // symbol
        switch (char) {
          case '(':
            // '(' 之前，如果 tempChars.length > 0，则为函数
            if (this.curCommonChars.length > 0) {
              this.enqueExpr('fn', i)
            }
            break
          case ')':
            // ')' 之前，如果 tempChars.length > 0，则为 metric
            if (this.curCommonChars.length > 0) {
              this.enqueExpr('metric', i)
            }
            break
          case '{':
            // '{' 之前是 metric，this.tempChars 必须大于 0
            this.enqueExpr('metric', i)
            break
          case '}':
            // '}' 之前是 tags
            this.enqueExpr('tags', i)
            break
          case '[':
            // '[' 之前，如果 tempChars 大于 0，则为 metric
            if (this.curCommonChars.length > 0) {
              this.enqueExpr('metric', i)
            }
            break
          case ']':
            // ']' 之前是 duration, this.tempChars 必须大于 0
            this.enqueExpr('duration', i)
            break
          case '+':
          case '-':
          case '*':
          case '/':
            break
        }
        // 放入 exprArr 中
        this.exprArr.push({ val: char, type: 'symbol', pos: i })
      } else if (char !== ' ') {
        // common char except ' '
        this.curCommonChars.push(char)
      }
    }
  }

  combine() {
    return this.exprArr.map(item => item.val).join('')
  }

  inject() {}
}
