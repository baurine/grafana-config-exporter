import fetch, { Response } from "node-fetch";
import { genNewPromQL } from "./promql-parser";
import { getConfig } from "./config-parser";

const config = getConfig();
const BASE_URL = config.grafana_server;
const GRAFANA_API_KEY = config.grafana_api_key;
const PROM_TAG_PLACE_HOLDER = config.promql_tag_placeholder;
const CLEAN_VAR_IN_TAG = config.clean_variables_in_tag;

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
  return [];
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

export interface ISection {
  sectionKey: string;
  title: string;

  panels: IPanel[];
}

export interface IPanel {
  panelKey: string;
  title: string;

  subPanels: ISubPanel[];
}

export interface ISubPanel {
  subPanelKey: string;

  title: string;
  targets: ITarget[];
  yaxis: IYaxis;
}

export interface ITarget {
  _ori?: string;
  expr: string;
  legendFormat: string;
}

// rename to unitFormat?
export interface IYaxis {
  format: string;
  decimals?: number;
}

////////////////////////////////

export function convertDbDetail(dbDetail: any): ISection {
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
              format: yaxis.format
            }))[0]
          };
        })
      };
      if (panel.targets) {
        newPanel.subPanels.push({
          title: panel.title,
          targets: transformTargets(panel.targets),
          yaxis: (panel.yaxes || []).map((yaxis: any) => ({
            format: yaxis.format
          }))[0]
        });
      }
      return newPanel;
    })
  };
}

function transformTargets(targets: any[]): ITarget[] | undefined {
  if (targets === undefined) {
    return undefined;
  }
  return targets.map(target => ({
    _ori: config.keep_ori_expr ? target.expr : undefined,
    expr: genNewPromQL(target.expr, PROM_TAG_PLACE_HOLDER, CLEAN_VAR_IN_TAG),
    legendFormat: target.legendFormat
  }));
}
