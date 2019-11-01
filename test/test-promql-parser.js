const PromQLParser = require('../promql_parser')

function test() {
  let promQL =
    '(sum(rate(tikv_storage_engine_async_request_duration_seconds_sum{type="write"}[5m]))+5)/sum(rate(tikv_storage_engine_async_request_duration_seconds_count{type="write"}[5m]))'
  let parser = new PromQLParser(promQL)
  parser.parse()
  console.log(parser.exprArr)
  if (promQL !== parser.combine()) {
    console.error('error')
  }
  console.log(promQL)
  console.log(parser.combine())
  console.log(parser.injectToTags('PLACE_HOLDER'))
}

test()
