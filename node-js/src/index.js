const fetch = require("node-fetch");
const fs = require("fs");

const config = require("../config.json");
const BASE_URL = config.grafana_server;
const GRAFANA_API_KEY = config.grafana_api_key;
const TARGET_DB_UIDS = config.target_db_uids;

const { genNewPromQL } = require("./promql_parser");

function parseResponse(res) {
  if (res.status === 204) {
    return {};
  } else if (res.status >= 200 && res.status < 300) {
    return res.json();
  } else {
    return res.json().then(resData => {
      const errMsg = resData.message || res.statusText;
      const error = new Error(errMsg);
      throw error;
    });
  }
}

async function request(apiPath) {
  return fetch(`${BASE_URL}/api/${apiPath}`, {
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${GRAFANA_API_KEY}`
    }
  })
    .then(parseResponse)
    .then(data => ({ data }))
    .catch(err => ({ err }));
}

async function searchDashboards() {
  const url = "search?folderIds=0&type=dash-db";
  const dbs = await request(url);
  return dbs.map(db => db.uid);
}

async function fetchDbDetail(dbUid) {
  const url = `dashboards/uid/${dbUid}`;
  const detail = await request(url);
  if (detail.err) {
    return undefined;
  }

  const dbDetail = detail.data.dashboard;

  const simplifiedDetail = {
    sectionKey: dbDetail.uid,
    title: dbDetail.title,

    panels: (dbDetail.panels || []).map(panel => {
      let newPanel = {
        panelKey: panel.id,
        title: panel.title,

        subPanels: (panel.panels || []).map(subPanel => {
          return {
            subPanelKey: subPanel.id,
            title: subPanel.title,

            targets: transformTargets(subPanel.targets),
            yaxis: (subPanel.yaxes || []).map(yaxis => ({
              format: yaxis.format,
              logBase: yaxis.logBase
            }))[0]
          };
        })
      };
      if (panel.targets) {
        newPanel.subPanels.push({
          title: panel.title,
          targets: transformTargets(panel.targets),
          yaxis: (panel.yaxes || []).map(yaxis => ({
            format: yaxis.format,
            logBase: yaxis.logBase
          }))[0]
        });
      }
      return newPanel;
    })
  };
  return simplifiedDetail;
}

function parseArgv() {
  let argus = {};
  process.argv.slice(2).map(element => {
    const matches = element.match("--([a-zA-Z0-9_]+)=(.*)");
    if (matches) {
      const key = matches[1];
      let value = matches[2].replace(/^['"]/, "").replace(/['"]$/, "");
      if (key === "db_uids") {
        value = value.split(",");
      }
      argus[key] = value;
    }
  });
  return argus;
}

function transformTargets(targets) {
  if (targets === undefined) {
    return undefined;
  }
  return targets.map(target => ({
    // expr: genNewPromQL(target.expr, 'inspectionid="{{inspectionId}}"'),
    expr: genNewPromQL(target.expr, ""),
    // oriExpr: target.expr,
    // newExpr: genNewPromQL(target.expr, 'inspectionid="{{inspectionId}}"'),
    // format: target.format,
    legendFormat: target.legendFormat
  }));
}

async function main() {
  const argv = parseArgv();
  console.log("argv:", argv);
  const dbUids = argv["db_uids"] || TARGET_DB_UIDS || [];
  console.log("db_uids:", dbUids);

  for (let i = 0; i < dbUids.length; i++) {
    const dbDetail = await fetchDbDetail(dbUids[i]);
    const jsonContent = JSON.stringify(dbDetail, null, 2);
    const filePath = `./output/${dbDetail.title.toLowerCase()}.json`;
    fs.writeFile(filePath, jsonContent, err => {
      if (err) {
        console.log(err);
      }
      console.log(`write result to ${filePath}`);
    });
  }
}

main();
