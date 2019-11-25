import { checkConfig, getConfig } from "./config-parser";
import { fetchDbDetail, convertDbDetail } from "./grafana-api";
import fs from "fs";

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
      const filePath = `./output/${convertedDb.title.toLowerCase()}.json`;
      fs.writeFile(filePath, jsonContent, (err: any) => {
        if (err) {
          console.log(err);
        }
        console.log(`write result to ${filePath}`);
      });
    }
  }
}

main();
