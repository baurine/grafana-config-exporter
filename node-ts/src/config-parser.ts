interface IConfig {
  grafana_server: string;
  grafana_api_key: string;

  db_uids: "all" | string[];
  promql_tag_placeholder: string;
  clean_variables_in_tag: boolean;
  keep_ori_expr: boolean; // used to compare with transformed expr
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
    console.log("db_uids is not defined, set default to all");
    config.db_uids = [];
  }
  if (config.promql_tag_placeholder === undefined) {
    console.log("promql_tag_placeholder is not defined, set default to empty");
    config.promql_tag_placeholder = "";
  }
  if (config.clean_variables_in_tag === undefined) {
    console.log("clean_variables_in_tag is not defined, set default to true");
    config.clean_variables_in_tag = true;
  }
  if (config.keep_ori_expr === undefined) {
    console.log("clean_variables_in_tag is not defined, set default to false");
    config.clean_variables_in_tag = false;
  }
  return ok;
}

export function getConfig(): IConfig {
  return config as IConfig;
}
