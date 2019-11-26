import { checkConfig, getConfig } from "./config-parser";
import { fetchDbDetail, convertDbDetail } from "./grafana-api";
import fs, { mkdir, exists, existsSync, mkdirSync } from "fs";
import { dirname } from "path";

async function main() {
  if (!checkConfig()) {
    return;
  }

  const config = getConfig();
  const dbUids = config.db_uids;
  if (dbUids !== "all") {
    for (let i = 0; i < dbUids.length; i++) {
      const dbDetail = await fetchDbDetail(dbUids[i]);
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
  }
}

main();
