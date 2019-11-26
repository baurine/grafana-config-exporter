# Grafana Config Extractor

(only used for personal project)

Extract grafana panel config (the data source is prometheus) by grafana API, save to local json file.

- support to remove variables from PromQL tags
- support to insert extra tag into PromQL tags

Samples (copy from test file):

```ts
it("should handle math signs which included in the regex correctly", function() {
  const promQLRegex =
    'sum(rate(tikv_thread_cpu_seconds_total{instance=~"$instance", name=~"apply_[0-9]+"}[1m])) by (instance)';
  const targetPromQL =
    'sum(rate(tikv_thread_cpu_seconds_total{name=~"apply_[0-9]+", PLACE_HOLDER}[1m])) by (instance)';
  expect(genNewPromQL(promQLRegex, "PLACE_HOLDER")).toBe(targetPromQL);
});
```

One saved json file:

```json
{
  "sectionKey": "000000012",
  "title": "Test-Cluster-TiDB-Summary",
  "panels": [
    {
      "panelKey": 140,
      "title": "Server",
      "subPanels": [
        {
          "subPanelKey": 184,
          "title": "Uptime",
          "targets": [
            {
              "_ori": "(time() - process_start_time_seconds{job=\"tidb\"})",
              "expr": "(time() - process_start_time_seconds{job=\"tidb\", PLACE_HOLDER})",
              "legendFormat": "{{instance}}"
            }
          ],
          "yaxis": {
            "format": "dtdurations"
          }
        },
        {
          "subPanelKey": 8,
          "title": "Connection Count",
          "targets": [
            {
              "_ori": "tidb_server_connections",
              "expr": "tidb_server_connections{PLACE_HOLDER}",
              "legendFormat": "{{instance}}"
            },
            {
              "_ori": "sum(tidb_server_connections)",
              "expr": "sum(tidb_server_connections{PLACE_HOLDER})",
              "legendFormat": "total"
            }
          ],
          "yaxis": {
            "format": "short"
          }
        },
        // ...
```

## How to Run

1.  enter node-ts foler, copy config.json.example to config.json, fill the config file

    ```json
    {
      // required
      "grafana_server": "",
      "grafana_api_key": "",

      // optional
      "db_uids": "all",
      "promql_tag_placeholder": "",
      "clean_variables_in_tag": true,
      "keep_ori_expr": true
    }
    ```

1.  install depedencies by `yarn`

1.  run test by `yarn test`

1.  start work by `yarn start`
