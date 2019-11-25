import fetch, { Response } from "node-fetch";
import { genNewPromQL } from "./promql-parser";
import { getConfig } from "./config-parser";

const config = getConfig();
const BASE_URL = config.grafana_server;
const GRAFANA_API_KEY = config.grafana_api_key;
const PROM_PLACE_HOLDER = config.promql_placeholder;

interface IRes {
  data?: any;
  err?: any;
}

function parseResponse(res: Response) {
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

async function request(apiPath: string): Promise<IRes> {
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

////////////////////////////////

export async function searchDashboards() {
  const url = "search?folderIds=0&type=dash-db";
  const res = await request(url);
  if (res.data) {
    return (res.data as any[]).map(db => db.uid);
  }
  return undefined;
}

export async function fetchDbDetail(dbUid: string) {
  const url = `dashboards/uid/${dbUid}`;
  const res = await request(url);
  if (res.err) {
    return undefined;
  }
  return res.data.dashboard;
}

////////////////////////////////

export function convertDbDetail(dbDetail: any) {
  return {
    sectionKey: dbDetail.uid,
    title: dbDetail.title,

    panels: (dbDetail.panels || []).map((panel: any) => {
      let newPanel = {
        panelKey: panel.id,
        title: panel.title,

        subPanels: (panel.panels || []).map((subPanel: any) => {
          return {
            subPanelKey: subPanel.id,
            title: subPanel.title,

            targets: transformTargets(subPanel.targets),
            yaxis: (subPanel.yaxes || []).map((yaxis: any) => ({
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
          yaxis: (panel.yaxes || []).map((yaxis: any) => ({
            format: yaxis.format,
            logBase: yaxis.logBase
          }))[0]
        });
      }
      return newPanel;
    })
  };
}

function transformTargets(targets: any[]) {
  if (targets === undefined) {
    return undefined;
  }
  return targets.map(target => ({
    expr: genNewPromQL(target.expr, PROM_PLACE_HOLDER),
    legendFormat: target.legendFormat
  }));
}
