interface IConfig {
  grafana_server: string;
  grafana_api_key: string;

  db_uids: "all" | string[];
  promql_placeholder: string;
}

let config = require("../config.json") as any;

export function checkConfig() {
  let ok = true;
  if (config.grafana_server === undefined || config.grafana_server === "") {
    console.log("err: grafana server is empty");
    ok = false;
  }
  if (config.grafana_api_key === undefined || config.grafana_api_key === "") {
    console.log("err: grafana api key is empty");
    ok = false;
  }
  if (config.db_uids === undefined || config.db_uids === "") {
    console.log("err: db_uids is empty");
    config.db_uids = [];
    ok = false;
  }
  if (config.promql_placeholder === undefined) {
    console.log("promql_placeholder is not defined");
    config.promql_placeholder = "";
  }
  return ok;
}

export function getConfig(): IConfig {
  return config as IConfig;
}
