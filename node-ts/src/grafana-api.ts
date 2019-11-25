import fetch, { Response } from "node-fetch";
import { genNewPromQL } from "./promql-parser";

const BASE_URL = "";
const GRAFANA_API_KEY = "";

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

async function searchDashboards() {
  const url = "search?folderIds=0&type=dash-db";
  const res = await request(url);
  if (res.data) {
    return (res.data as any[]).map(db => db.uid);
  }
  return undefined;
}

async function fetchDbDetail(dbUid: string) {
  const url = `dashboards/uid/${dbUid}`;
  const res = await request(url);
  if (res.err) {
    return undefined;
  }
  return res.data.dashboard;
}

////////////////////////////////

function convertDbDetail(dbDetail: any) {
  const simplifiedDetail = {
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
  return simplifiedDetail;
}

function transformTargets(targets: any[]) {
  if (targets === undefined) {
    return undefined;
  }
  return targets.map(target => ({
    expr: genNewPromQL(target.expr, ""),
    legendFormat: target.legendFormat
  }));
}
