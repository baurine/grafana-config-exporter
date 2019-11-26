import { genNewPromQL } from "../promql-parser";

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
  const promQLLt =
    'delta(tikv_raftstore_region_count{instance=~"$instance", type="leader"}[30s]) < -10';
  const promQLEqual = 'count(probe_success{group="tidb"} == 1)';

  const placeHolder = "PLACE_HOLDER";

  it("should format the PromQL correctly", function() {
    const targetPromQL =
      '(sum(rate(tikv_storage_engine_async_request_duration_seconds_sum{type="write"}[5m])) + 5) / sum(rate(tikv_storage_engine_async_request_duration_seconds_count{type="write"}[5m]))';
    expect(genNewPromQL(promQLNormal)).toBe(targetPromQL);
  });

  it("should format the PromQL correctly", function() {
    const targetPromQL =
      "(5 + load1 + load5) / (load5 + load1 + 6) + 5 + load5";
    expect(genNewPromQL(promQLMetrics)).toBe(targetPromQL);
  });

  it("should inject the placeholder correctly", function() {
    const targetPromQL =
      '(sum(rate(tikv_storage_engine_async_request_duration_seconds_sum{type="write", PLACE_HOLDER}[5m])) + 5) / sum(rate(tikv_storage_engine_async_request_duration_seconds_count{type="write", PLACE_HOLDER}[5m]))';
    expect(genNewPromQL(promQLNormal, placeHolder)).toBe(targetPromQL);
  });

  it("should inject the placeholder correctly", function() {
    const targetPromQL =
      "(5 + load1{PLACE_HOLDER} + load5{PLACE_HOLDER}) / (load5{PLACE_HOLDER} + load1{PLACE_HOLDER} + 6) + 5 + load5{PLACE_HOLDER}";
    expect(genNewPromQL(promQLMetrics, placeHolder)).toBe(targetPromQL);
  });

  it("should clean the variables in the PromQL", function() {
    const targetPromQL =
      'sum(rate(tikv_engine_cache_efficiency{type="block_cache_hit", PLACE_HOLDER}[1m])) / (sum(rate(tikv_engine_cache_efficiency{type="block_cache_hit", PLACE_HOLDER}[1m])) + sum(rate(tikv_engine_cache_efficiency{type="block_cache_miss", PLACE_HOLDER}[1m])))';
    expect(genNewPromQL(promQLVariables, placeHolder)).toBe(targetPromQL);
  });

  it("should handle math signs which included in the regex correctly", function() {
    const targetPromQL =
      'sum(rate(tikv_thread_cpu_seconds_total{name=~"apply_[0-9]+", PLACE_HOLDER}[1m])) by (instance)';
    expect(genNewPromQL(promQLRegex1, placeHolder)).toBe(targetPromQL);
  });

  it("should handle math signs which included in the regex correctly", function() {
    const targetPromQL =
      'go_memstats_heap_inuse_bytes{job=~"tidb.*", PLACE_HOLDER}';
    expect(genNewPromQL(promQLRegex2, placeHolder)).toBe(targetPromQL);
  });

  it("should handle promQL which includes 1 `by` correctly", function() {
    const targetPromQL =
      "histogram_quantile(0.99, sum(rate(tidb_session_transaction_duration_seconds_bucket{PLACE_HOLDER}[1m])) by (le, sql_type))";
    expect(genNewPromQL(promQLBy, placeHolder)).toBe(targetPromQL);
  });

  it("should handle promQL which includes more than 1 `by` correctly", function() {
    const targetPromQL =
      'sum(increase(node_cpu_seconds_total{mode!="idle", PLACE_HOLDER}[3m])) by (instance) / sum(increase(node_cpu_seconds_total{PLACE_HOLDER}[3m])) by (instance)';
    expect(genNewPromQL(promQLBys, placeHolder)).toBe(targetPromQL);
  });

  it("should handle `<` correctly", function() {
    const targetPromQL =
      'delta(tikv_raftstore_region_count{type="leader", PLACE_HOLDER}[30s]) < -10';
    expect(genNewPromQL(promQLLt, placeHolder)).toBe(targetPromQL);
  });

  it("should handle `==` correctly", function() {
    const targetPromQL =
      'count(probe_success{group="tidb", PLACE_HOLDER} == 1)';
    expect(genNewPromQL(promQLEqual, placeHolder)).toBe(targetPromQL);
  });
});
