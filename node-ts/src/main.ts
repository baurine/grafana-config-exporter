import { checkConfig, getConfig } from "./config-parser";
import {
  fetchDbDetail,
  convertDbDetail,
  searchDashboards
} from "./grafana-api";
import fs, { existsSync, mkdirSync } from "fs";
import { dirname } from "path";

async function fetchAndSaveDashboard(dbUid: string) {
  const dbDetail = await fetchDbDetail(dbUid);
  if (dbDetail === undefined) {
    return;
  }
  const convertedDb = convertDbDetail(dbDetail);
  const jsonContent = JSON.stringify(convertedDb, null, 2);
  const filePath = `${__dirname}/output/${convertedDb.title.toLowerCase()}.json`;
  const folderPath = dirname(filePath);

  const folderExists = existsSync(folderPath);
  if (!folderExists) {
    mkdirSync(folderPath);
  }

  fs.writeFile(filePath, jsonContent, (err: any) => {
    if (err) {
      console.log(err);
      return;
    }
    console.log(`write result to ${filePath}`);
  });
}

async function main() {
  if (!checkConfig()) {
    return;
  }

  const config = getConfig();
  let dbUids: string[] = [];
  if (config.db_uids === "all") {
    dbUids = await searchDashboards();
  } else {
    dbUids = config.db_uids;
  }

  dbUids.forEach(fetchAndSaveDashboard);
}

main();
