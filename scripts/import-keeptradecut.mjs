import fetch from 'node-fetch'
import { JSDOM } from 'jsdom'
import dayjs from 'dayjs'
import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { keeptradecut_metric_types } from '#constants'
import {
  is_main,
  find_player_row,
  updatePlayer,
  wait,
  report_job,
  fetch_with_retry,
  batch_insert,
  throw_if_shortfall
} from '#libs-server'
import { job_types } from '#libs-shared/job-constants.mjs'

const initialize_cli = () => {
  return yargs(hideBin(process.argv)).argv
}

const log = debug('import-keeptradecut')
debug.enable('import-keeptradecut,get-player,update-player,fetch')

const KTC_PICK_SLOT = { Early: 1, Mid: 2, Late: 3 }
const KTC_PICK_ROUND = { '1st': 1, '2nd': 2, '3rd': 3, '4th': 4 }
const KTC_PICK_NAME_RE = /^(\d{4}) (Early|Mid|Late) (1st|2nd|3rd|4th)$/

const parse_ktc_pick_name = (name) => {
  const m = KTC_PICK_NAME_RE.exec(name)
  if (!m) return null
  return {
    year: Number(m[1]),
    slot: KTC_PICK_SLOT[m[2]],
    round: KTC_PICK_ROUND[m[3]]
  }
}

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
  const dynasty_rankings_html = await fetch_with_retry({
    url: 'https://keeptradecut.com/dynasty-rankings',
    response_type: 'text'
  })
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

  const liquidity_d = dayjs().startOf('day').unix()

  for (const item of data) {
    const keeptradecut_player = players_index[item.playerID]
    const inserts = []
    let pid

    if (keeptradecut_player.position === 'RDP') {
      const meta = parse_ktc_pick_name(keeptradecut_player.playerName)
      if (!meta) {
        log(
          `unparseable RDP playerName: ${keeptradecut_player.playerName} (id=${item.playerID})`
        )
        continue
      }
      pid = `KTCPICK-${item.playerID}`
      const now = dayjs().unix()
      if (!dry) {
        await db('keeptradecut_pick')
          .insert({
            pid,
            ktc_player_id: item.playerID,
            ktc_player_name: keeptradecut_player.playerName,
            year: meta.year,
            round: meta.round,
            slot: meta.slot,
            created_at: now,
            updated_at: now
          })
          .onConflict('pid')
          .merge(['ktc_player_name', 'year', 'round', 'slot', 'updated_at'])
      }
    } else {
      let player_row
      try {
        player_row = await find_player_row({ keeptradecut_id: item.playerID })
        if (!player_row) {
          player_row = await find_player_row({
            name: keeptradecut_player.playerName,
            pos: keeptradecut_player.position,
            team: keeptradecut_player.team,
            nfl_draft_year: keeptradecut_player.draftYear
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
      pid = player_row.pid
    }

    if (full) {
      const slug = keeptradecut_player.slug
      const html = await fetch_with_retry({
        url: `https://keeptradecut.com/dynasty-rankings/players/${slug}`,
        response_type: 'text'
      })

      const dom = new JSDOM(html, { runScripts: 'dangerously' })
      if (keeptradecut_player.position === 'RDP') {
        dom.window.playerOneQB?.overallValue?.forEach((i) => {
          inserts.push({
            qb: 1,
            pid,
            d: parse_keeptradecut_date(i.d),
            v: i.v,
            type: keeptradecut_metric_types.VALUE
          })
        })

        dom.window.playerOneQB?.overallRankHistory?.forEach((i) => {
          inserts.push({
            qb: 1,
            pid,
            d: parse_keeptradecut_date(i.d),
            v: i.v,
            type: keeptradecut_metric_types.OVERALL_RANK
          })
        })

        dom.window.playerSuperflex?.overallValue?.forEach((i) => {
          inserts.push({
            qb: 2,
            pid,
            d: parse_keeptradecut_date(i.d),
            v: i.v,
            type: keeptradecut_metric_types.VALUE
          })
        })

        dom.window.playerSuperflex?.overallRankHistory?.forEach((i) => {
          inserts.push({
            qb: 2,
            pid,
            d: parse_keeptradecut_date(i.d),
            v: i.v,
            type: keeptradecut_metric_types.OVERALL_RANK
          })
        })
      } else {
        dom.window.playerOneQB.overallValue.forEach((i) => {
          inserts.push({
            qb: 1,
            pid,
            d: parse_keeptradecut_date(i.d),
            v: i.v,
            type: keeptradecut_metric_types.VALUE
          })
        })

        dom.window.playerOneQB.overallRankHistory.forEach((i) => {
          inserts.push({
            qb: 1,
            pid,
            d: parse_keeptradecut_date(i.d),
            v: i.v,
            type: keeptradecut_metric_types.OVERALL_RANK
          })
        })

        dom.window.playerOneQB.positionalRankHistory.forEach((i) => {
          inserts.push({
            qb: 1,
            pid,
            d: parse_keeptradecut_date(i.d),
            v: i.v,
            type: keeptradecut_metric_types.POSITION_RANK
          })
        })

        dom.window.playerSuperflex.overallValue.forEach((i) => {
          inserts.push({
            qb: 2,
            pid,
            d: parse_keeptradecut_date(i.d),
            v: i.v,
            type: keeptradecut_metric_types.VALUE
          })
        })

        dom.window.playerSuperflex.overallRankHistory.forEach((i) => {
          inserts.push({
            qb: 2,
            pid,
            d: parse_keeptradecut_date(i.d),
            v: i.v,
            type: keeptradecut_metric_types.OVERALL_RANK
          })
        })

        dom.window.playerSuperflex.positionalRankHistory.forEach((i) => {
          inserts.push({
            qb: 2,
            pid,
            d: parse_keeptradecut_date(i.d),
            v: i.v,
            type: keeptradecut_metric_types.POSITION_RANK
          })
        })
      }
    } else {
      item.oneQB?.valueHistory?.forEach((compressed_str) => {
        const { d, v } = parse_compressed_value(compressed_str)
        inserts.push({
          qb: 1,
          pid,
          d,
          v,
          type: keeptradecut_metric_types.VALUE
        })
      })

      item.superflex?.valueHistory?.forEach((compressed_str) => {
        const { d, v } = parse_compressed_value(compressed_str)
        inserts.push({
          qb: 2,
          pid,
          d,
          v,
          type: keeptradecut_metric_types.VALUE
        })
      })
    }

    // Liquidity is cheap-path-only; KTC publishes no liquidityHistory on per-slug HTML.
    if (keeptradecut_player.position !== 'RDP') {
      const liquidity_inserts = []

      if (keeptradecut_player.oneQBValues) {
        liquidity_inserts.push({
          pid,
          superflex: false,
          d: liquidity_d,
          raw_liquidity: keeptradecut_player.oneQBValues.rawLiquidity,
          std_liquidity: keeptradecut_player.oneQBValues.stdLiquidity,
          trade_count: keeptradecut_player.oneQBValues.tradeCount
        })
      }
      if (keeptradecut_player.superflexValues) {
        liquidity_inserts.push({
          pid,
          superflex: true,
          d: liquidity_d,
          raw_liquidity: keeptradecut_player.superflexValues.rawLiquidity,
          std_liquidity: keeptradecut_player.superflexValues.stdLiquidity,
          trade_count: keeptradecut_player.superflexValues.tradeCount
        })
      }

      log(
        `liquidity playerID ${item.playerID} rows: ${liquidity_inserts.length}`
      )

      if (!dry && liquidity_inserts.length) {
        await batch_insert({
          items: liquidity_inserts,
          batch_size: 5000,
          save: (batch) =>
            db('keeptradecut_liquidity')
              .insert(batch)
              .onConflict(['pid', 'superflex', 'd'])
              .merge(['raw_liquidity', 'std_liquidity', 'trade_count'])
        })
      }
    }

    if (dry) {
      log(`ktc playerID ${item.playerID} values: ${inserts.length}`)
      log(inserts[0])
      continue
    }

    await batch_insert({
      items: inserts,
      batch_size: 5000,
      save: (batch) =>
        db('keeptradecut_rankings')
          .insert(batch)
          .onConflict(['pid', 'd', 'qb', 'type'])
          .ignore()
    })

    log(`Inserted ${inserts.length} values for playerID ${item.playerID}`)

    if (full) await wait(4000)
  }

  // Freshness oracle: after running, max(d) in keeptradecut_rankings should be
  // within 48h of now. Cron runs daily at 04:30; a stale max means the script
  // completed without writing any new rows — silent partial-success.
  if (!dry) {
    const freshness_threshold_hours = 48
    const max_row = await db('keeptradecut_rankings')
      .max({ max_d: 'd' })
      .first()
    const max_d = max_row?.max_d
    if (!max_d) {
      return {
        shortfall: 'no rows found in keeptradecut_rankings after run'
      }
    }
    const stale_hours = dayjs().diff(dayjs.unix(max_d), 'hour')
    if (stale_hours > freshness_threshold_hours) {
      return {
        shortfall: `staleness: max(d)=${dayjs.unix(max_d).format('YYYY-MM-DD')} is ${stale_hours}h > threshold=${freshness_threshold_hours}h`
      }
    }
  }
  return { shortfall: null }
}

const main = async () => {
  let error
  try {
    const argv = initialize_cli()
    const shortfalls = []
    const result = await importKeepTradeCut({ full: argv.full, dry: argv.dry })
    if (result?.shortfall) shortfalls.push(result.shortfall)
    throw_if_shortfall(shortfalls.length > 0 ? shortfalls.join('; ') : null)
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
