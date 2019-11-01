const PromQLParser = require('../promql_parser')
const { describe } = require('mocha')
const { expect } = require('chai')

describe('test parser', function() {
  it('shoule be success', function() {
    let promQL =
      '(sum(rate(tikv_storage_engine_async_request_duration_seconds_sum{type="write"}[5m]))+5)/sum(rate(tikv_storage_engine_async_request_duration_seconds_count{type="write"}[5m]))'

    let parser = new PromQLParser(promQL)
    parser.parse()

    let targetPromQL =
      '(sum(rate(tikv_storage_engine_async_request_duration_seconds_sum{type="write"}[5m])) + 5) / sum(rate(tikv_storage_engine_async_request_duration_seconds_count{type="write"}[5m]))'
    expect(parser.combine()).to.equal(targetPromQL)

    let injectedPromQL =
      '(sum(rate(tikv_storage_engine_async_request_duration_seconds_sum{type="write", PLACE_HOLDER}[5m])) + 5) / sum(rate(tikv_storage_engine_async_request_duration_seconds_count{type="write", PLACE_HOLDER}[5m]))'
    expect(parser.injectToTags('PLACE_HOLDER')).to.equal(injectedPromQL)
  })
})

describe('test parser', function() {
  it('shoule be success', function() {
    let promQL = '(5+load1+load5)/(load5+load1+6)+5+load5'

    let parser = new PromQLParser(promQL)
    parser.parse()

    let targetPromQL = '(5 + load1 + load5) / (load5 + load1 + 6) + 5 + load5'
    expect(parser.combine()).to.equal(targetPromQL)

    let injectedPromQL =
      '(5 + load1{PLACE_HOLDER} + load5{PLACE_HOLDER}) / (load5{PLACE_HOLDER} + load1{PLACE_HOLDER} + 6) + 5 + load5{PLACE_HOLDER}'
    expect(parser.injectToTags('PLACE_HOLDER')).to.equal(injectedPromQL)
  })
})

describe('测试清除 PromQL 中的变量', function() {
  it('应该清除变量', function() {
    let promQL =
      'sum(rate(tikv_engine_cache_efficiency{instance=~"$instance", db="$db", type="block_cache_hit"}[1m])) / (sum(rate(tikv_engine_cache_efficiency{db="$db", type="block_cache_hit"}[1m])) + sum(rate(tikv_engine_cache_efficiency{db="$db", type="block_cache_miss"}[1m])))'
    let targetPromQL =
      'sum(rate(tikv_engine_cache_efficiency{type="block_cache_hit", PLACE_HOLDER}[1m])) / (sum(rate(tikv_engine_cache_efficiency{type="block_cache_hit", PLACE_HOLDER}[1m])) + sum(rate(tikv_engine_cache_efficiency{type="block_cache_miss", PLACE_HOLDER}[1m])))'

    let parser = new PromQLParser(promQL)
    parser.parse()
    expect(parser.injectToTags('PLACE_HOLDER', true)).to.equal(targetPromQL)
  })
})
