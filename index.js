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
  let unitFormats = []
  const simplifiedDetail = {
    units: [],

    uid: dbDetail.uid,
    title: dbDetail.title,

    panels: (dbDetail.panels || []).map(panel => {
      if (panel.yaxes) {
        unitFormats.push(panel.yaxes[0].format)
      }
      return {
        id: panel.id,
        title: panel.title,

        targets: transformTargets(panel.targets),
        yaxes: panel.yaxes,

        subPanels: (panel.panels || []).map(subPanel => {
          if (subPanel.yaxes) {
            unitFormats.push(subPanel.yaxes[0].format)
          }
          return {
            id: subPanel.id,
            title: subPanel.title,
            description: subPanel.description,

            targets: transformTargets(subPanel.targets),
            yaxes: subPanel.yaxes
          }
        })
      }
    })
  }
  simplifiedDetail.units = [...new Set(unitFormats)]
  return simplifiedDetail
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

function transformTargets(targets) {
  if (targets === undefined) {
    return undefined
  }
  return targets.map(target => ({
    newExpr: genNewPromQL(target.expr, 'PLACE_HOLDER'),
    ...target,
  }))
}

// 在原始的 promQL 中添加额外的 label
// 比如 sum(load1) => sum(load1{inspectionId="xxx"})
function genNewPromQL(oriPromQL, toInjectStr) {
  // example: histogram_quantile(0.999, sum(rate(pd_client_cmd_handle_cmds_duration_seconds_bucket{type=\"tso\"}[1m])) by (le))
  // 1. 先找 {}: load1{instance="aaa"}[1m]
  // 2. 没有再找 []: load1[5m]
  // 3. 再找 ): sum(load1)
  // 4. 最后就是单独的 metric，比如 load1

  let pos1,
    pos2,
    newExpr = oriPromQL
  pos1 = oriPromQL.indexOf('{')
  if (pos1 > 0) {
    // {}
    pos2 = oriPromQL.indexOf('}')
    const labels = oriPromQL.slice(pos1 + 1, pos2)
    let labelArr = labels.split(',')
    labelArr = labelArr.filter(label => !label.split('=')[1].startsWith('"$'))
    labelArr.push(toInjectStr)
    console.log(labelArr)
    const newLabels = labelArr.join(',')
    newExpr =
      oriPromQL.slice(0, pos1) +
      '{' +
      newLabels +
      '}' +
      oriPromQL.slice(pos2 + 1)
    return newExpr
  }
  // []
  pos1 = oriPromQL.indexOf('[')
  if (pos1 > 0) {
    newExpr =
      oriPromQL.slice(0, pos1) + '{' + toInjectStr + '}' + oriPromQL.slice(pos1)
    return newExpr
  }
  // )
  pos1 = oriPromQL.indexOf(')')
  if (pos1 > 0) {
    newExpr =
      oriPromQL.slice(0, pos1) + '{' + toInjectStr + '}' + oriPromQL.slice(pos1)
    return newExpr
  }
  // only metric
  newExpr = oriPromQL + '{' + toInjectStr + '}'
  return newExpr
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
