const { PromQLParser, genNewPromQL } = require("../promql_parser");
const { describe } = require("mocha");
const { expect } = require("chai");

describe("test parser", function() {
  const promQLNormal =
    '(sum(rate(tikv_storage_engine_async_request_duration_seconds_sum{type="write"}[5m]))+5)/sum(rate(tikv_storage_engine_async_request_duration_seconds_count{type="write"}[5m]))';
  const promQLMetrics = "(5+load1+load5)/(load5+load1+6)+5+load5";
  const promQLVariables =
    'sum(rate(tikv_engine_cache_efficiency{instance=~"$instance", db="$db", type="block_cache_hit"}[1m])) / (sum(rate(tikv_engine_cache_efficiency{db="$db", type="block_cache_hit"}[1m])) + sum(rate(tikv_engine_cache_efficiency{db="$db", type="block_cache_miss"}[1m])))';
  const promQLRegex1 =
    'sum(rate(tikv_thread_cpu_seconds_total{name=~"apply_[0-9]+"}[1m])) by (instance)';
  const promQLRegex2 = 'go_memstats_heap_inuse_bytes{job=~"tidb.*"}';
  const promQLBy =
    "histogram_quantile(0.99, sum(rate(tidb_session_transaction_duration_seconds_bucket{}[1m])) by (le, sql_type))";
  const promQLBys =
    'sum(increase(node_cpu_seconds_total{mode!="idle"}[3m])) by (instance) / sum(increase(node_cpu_seconds_total[3m])) by (instance)';

  it("should format the PromQL correctly", function() {
    const parser = new PromQLParser(promQLNormal);
    let targetPromQL =
      '(sum(rate(tikv_storage_engine_async_request_duration_seconds_sum{type="write"}[5m])) + 5) / sum(rate(tikv_storage_engine_async_request_duration_seconds_count{type="write"}[5m]))';
    expect(parser.combine()).to.equal(targetPromQL);
  });

  it("should format the PromQL correctly", function() {
    const parser = new PromQLParser(promQLMetrics);
    let targetPromQL = "(5 + load1 + load5) / (load5 + load1 + 6) + 5 + load5";
    expect(parser.combine()).to.equal(targetPromQL);
  });

  it("should inject the placeholder correctly", function() {
    const parser = new PromQLParser(promQLNormal);
    let injectedPromQL =
      '(sum(rate(tikv_storage_engine_async_request_duration_seconds_sum{type="write", PLACE_HOLDER}[5m])) + 5) / sum(rate(tikv_storage_engine_async_request_duration_seconds_count{type="write", PLACE_HOLDER}[5m]))';
    expect(parser.injectToTags("PLACE_HOLDER")).to.equal(injectedPromQL);
  });

  it("should inject the placeholder correctly", function() {
    const parser = new PromQLParser(promQLMetrics);
    let injectedPromQL =
      "(5 + load1{PLACE_HOLDER} + load5{PLACE_HOLDER}) / (load5{PLACE_HOLDER} + load1{PLACE_HOLDER} + 6) + 5 + load5{PLACE_HOLDER}";
    expect(parser.injectToTags("PLACE_HOLDER")).to.equal(injectedPromQL);
  });

  it("should clean the variables in the PromQL", function() {
    let targetPromQL =
      'sum(rate(tikv_engine_cache_efficiency{type="block_cache_hit", PLACE_HOLDER}[1m])) / (sum(rate(tikv_engine_cache_efficiency{type="block_cache_hit", PLACE_HOLDER}[1m])) + sum(rate(tikv_engine_cache_efficiency{type="block_cache_miss", PLACE_HOLDER}[1m])))';
    expect(genNewPromQL(promQLVariables, "PLACE_HOLDER")).to.equal(
      targetPromQL
    );
  });

  it("should handle math signs which included in the regex correctly", function() {
    let targetPromQL =
      'sum(rate(tikv_thread_cpu_seconds_total{name=~"apply_[0-9]+", PLACE_HOLDER}[1m])) by (instance)';
    expect(genNewPromQL(promQLRegex1, "PLACE_HOLDER")).to.equal(targetPromQL);
  });

  it("should handle math signs which included in the regex correctly", function() {
    let targetPromQL =
      'go_memstats_heap_inuse_bytes{job=~"tidb.*", PLACE_HOLDER}';
    expect(genNewPromQL(promQLRegex2, "PLACE_HOLDER")).to.equal(targetPromQL);
  });

  it("should handle promQL which includes 1 `by` correctly", function() {
    let targetPromQL =
      "histogram_quantile(0.99, sum(rate(tidb_session_transaction_duration_seconds_bucket{PLACE_HOLDER}[1m])) by (le, sql_type))";
    expect(genNewPromQL(promQLBy, "PLACE_HOLDER")).to.equal(targetPromQL);
  });

  it("should handle promQL which includes more than 1 `by` correctly", function() {
    let targetPromQL =
      'sum(increase(node_cpu_seconds_total{mode!="idle", PLACE_HOLDER}[3m])) by (instance) / sum(increase(node_cpu_seconds_total{PLACE_HOLDER}[3m])) by (instance)';
    expect(genNewPromQL(promQLBys, "PLACE_HOLDER")).to.equal(targetPromQL);
  });
});
