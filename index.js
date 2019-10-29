const fetch = require('node-fetch')
const fs = require('fs')

const config = require('./config.json')
const BASE_URL = config.grafana_server
const GRAFANA_API_KEY = config.grafana_api_key
const TARGET_DB_UIDS = config.target_db_uids

function parseResponse(res) {
  if (res.status === 204) {
    return {}
  } else if (res.status >= 200 && res.status < 300) {
    return res.json()
  } else {
    return res.json().then(resData => {
      const errMsg = resData.message || res.statusText
      const error = new Error(errMsg)
      throw error
    })
  }
}

async function request(apiPath) {
  return fetch(`${BASE_URL}/api/${apiPath}`, {
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${GRAFANA_API_KEY}`
    }
  })
    .then(parseResponse)
    .then(data => ({ data }))
    .catch(err => ({ err }))
}

async function searchDashboards() {
  const url = 'search?folderIds=0&type=dash-db'
  const dbs = await request(url)
  return dbs.map(db => db.uid)
}

async function fetchDbDetail(dbUid) {
  const url = `dashboards/uid/${dbUid}`
  const detail = await request(url)
  if (detail.err) {
    return undefined
  }

  const dbDetail = detail.data.dashboard
  return {
    uid: dbDetail.uid,
    title: dbDetail.title,
    panels: (dbDetail.panels || []).map(panel => ({
      id: panel.id,
      title: panel.title,
      targets: panel.targets,
      subPanels: (panel.panels || []).map(subPanel => ({
        id: subPanel.id,
        title: subPanel.title,
        description: subPanel.description,
        targets: subPanel.targets,
        yaxes: subPanel.yaxes
      }))
    }))
  }
}

function parseArgv() {
  const arguments = {}
  process.argv.slice(2).map(element => {
    const matches = element.match('--([a-zA-Z0-9_]+)=(.*)')
    if (matches) {
      const key = matches[1]
      let value = matches[2].replace(/^['"]/, '').replace(/['"]$/, '')
      if (key === 'db_uids') {
        value = value.split(',')
      }
      arguments[key] = value
    }
  })
  return arguments
}

async function main() {
  const argv = parseArgv()
  console.log('argv:', argv)
  const dbUids = argv['db_uids'] || TARGET_DB_UIDS || []
  console.log('db_uids:', dbUids)

  for (let i = 0; i < dbUids.length; i++) {
    const dbDetail = await fetchDbDetail(dbUids[i])
    const jsonContent = JSON.stringify(dbDetail, null, 2)
    const filePath = `./output/${dbDetail.title.toLowerCase()}.json`
    fs.writeFile(filePath, jsonContent, err => {
      if (err) {
        console.log(err)
      }
      console.log(`write result to ${filePath}`)
    })
  }
}

main()
