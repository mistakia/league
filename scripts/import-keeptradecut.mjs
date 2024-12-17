import fetch from 'node-fetch'
import { JSDOM } from 'jsdom'
import dayjs from 'dayjs'
import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { constants } from '#libs-shared'
import {
  is_main,
  find_player_row,
  updatePlayer,
  wait,
  report_job
} from '#libs-server'
import { job_types } from '#libs-shared/job-constants.mjs'

const argv = yargs(hideBin(process.argv)).argv
const log = debug('import-keeptradecut')
debug.enable('import-keeptradecut,get-player,update-player')

const parse_keeptradecut_date = (date_str) => {
  const formatted_date =
    '20' +
    date_str.substring(0, 2) +
    '-' +
    date_str.substring(2, 4) +
    '-' +
    date_str.substring(4, 6)
  return dayjs(formatted_date, 'YYYY-MM-DD').unix()
}

const parse_compressed_value = (compressed_str) => {
  return {
    d: parse_keeptradecut_date(compressed_str),
    v: Number(compressed_str.substring(6))
  }
}

const get_keeptradecut_config = async () => {
  const config_row = await db('config')
    .where('key', 'keeptradecut_config')
    .first()
  return config_row.value
}

const importKeepTradeCut = async ({ full = false, dry = false } = {}) => {
  const dynasty_rankings_html = await fetch(
    'https://keeptradecut.com/dynasty-rankings'
  ).then((res) => res.text())
  const dynasty_rankings_dom = new JSDOM(dynasty_rankings_html, {
    runScripts: 'dangerously'
  })

  const { playersArray } = dynasty_rankings_dom.window
  const players_index = {}
  for (const player of playersArray) {
    players_index[player.playerID] = player
  }

  const keeptradecut_config = await get_keeptradecut_config()

  const data = await fetch(keeptradecut_config.dynasty_rankings_url, {
    method: 'POST',
    headers: keeptradecut_config.dynasty_rankings_headers,
    body: null
  }).then((res) => res.json())

  log(`Processing ${data.length} players`)

  for (const item of data) {
    let player_row
    const keeptradecut_player = players_index[item.playerID]

    if (keeptradecut_player.position === 'RDP') {
      // skip draft pick values for now
      continue
    }

    try {
      player_row = await find_player_row({ keeptradecut_id: item.playerID })
      if (!player_row) {
        player_row = await find_player_row({
          name: keeptradecut_player.playerName,
          pos: keeptradecut_player.position,
          team: keeptradecut_player.team,
          start: keeptradecut_player.draftYear
        })

        if (player_row) {
          await updatePlayer({
            player_row,
            update: { keeptradecut_id: item.playerID }
          })
        } else {
          log(
            `PlayerID ${keeptradecut_player.playerID} not found, name: ${keeptradecut_player.playerName}, team: ${keeptradecut_player.team}, slug: ${keeptradecut_player.slug}, draft year: ${keeptradecut_player.draftYear}`
          )
          continue
        }
      }
    } catch (err) {
      log(`Error getting player ${item.playerID}: ${err}`)
      continue
    }

    const inserts = []
    const { pid } = player_row

    if (full) {
      const slug = keeptradecut_player.slug
      const html = await fetch(
        `https://keeptradecut.com/dynasty-rankings/players/${slug}`
      ).then((res) => res.text())

      const dom = new JSDOM(html, { runScripts: 'dangerously' })
      dom.window.playerOneQB.overallValue.forEach((i) => {
        inserts.push({
          qb: 1,
          pid,
          d: dayjs(i.d, 'YYYY-MM-DD').unix(),
          v: i.v,
          type: constants.KEEPTRADECUT.VALUE
        })
      })

      dom.window.playerOneQB.overallRankHistory.forEach((i) => {
        inserts.push({
          qb: 1,
          pid,
          d: dayjs(i.d, 'YYYY-MM-DD').unix(),
          v: i.v,
          type: constants.KEEPTRADECUT.OVERALL_RANK
        })
      })

      dom.window.playerOneQB.positionalRankHistory.forEach((i) => {
        inserts.push({
          qb: 1,
          pid,
          d: dayjs(i.d, 'YYYY-MM-DD').unix(),
          v: i.v,
          type: constants.KEEPTRADECUT.POSITION_RANK
        })
      })

      dom.window.playerSuperflex.overallValue.forEach((i) => {
        inserts.push({
          qb: 2,
          pid,
          d: dayjs(i.d, 'YYYY-MM-DD').unix(),
          v: i.v,
          type: constants.KEEPTRADECUT.VALUE
        })
      })

      dom.window.playerSuperflex.overallRankHistory.forEach((i) => {
        inserts.push({
          qb: 2,
          pid,
          d: dayjs(i.d, 'YYYY-MM-DD').unix(),
          v: i.v,
          type: constants.KEEPTRADECUT.OVERALL_RANK
        })
      })

      dom.window.playerSuperflex.positionalRankHistory.forEach((i) => {
        inserts.push({
          qb: 2,
          pid,
          d: dayjs(i.d, 'YYYY-MM-DD').unix(),
          v: i.v,
          type: constants.KEEPTRADECUT.POSITION_RANK
        })
      })
    } else {
      item.oneQB?.valueHistory?.forEach((compressed_str) => {
        const { d, v } = parse_compressed_value(compressed_str)
        inserts.push({
          qb: 1,
          pid,
          d,
          v,
          type: constants.KEEPTRADECUT.VALUE
        })
      })

      item.superflex?.valueHistory?.forEach((compressed_str) => {
        const { d, v } = parse_compressed_value(compressed_str)
        inserts.push({
          qb: 2,
          pid,
          d,
          v,
          type: constants.KEEPTRADECUT.VALUE
        })
      })
    }

    if (dry) {
      log(`ktc playerID ${item.playerID} values: ${inserts.length}`)
      log(inserts[0])
      continue
    }

    await db('keeptradecut_rankings')
      .insert(inserts)
      .onConflict(['pid', 'd', 'qb', 'type'])
      .ignore()

    log(`Inserted ${inserts.length} values for playerID ${item.playerID}`)

    if (full) await wait(4000)
  }
}

const main = async () => {
  let error
  try {
    await importKeepTradeCut({ full: argv.full, dry: argv.dry })
  } catch (err) {
    error = err
    log(err)
  }

  await report_job({
    job_type: job_types.IMPORT_KEEPTRADECUT,
    error
  })

  process.exit()
}

if (is_main(import.meta.url)) {
  main()
}

export default importKeepTradeCut
