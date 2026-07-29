import fs from 'fs/promises'
import path from 'path'

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

// KTC publishes rawLiquidity/stdLiquidity/tradeCount inline on the dynasty-rankings
// page, for every player, on every request. Intermittently — 15 of the first 70
// collected days — it serves that page with all three fields zeroed for every player,
// which is indistinguishable, row by row, from a player KTC genuinely reports no
// trades for. A stored zero must mean "KTC reported zero", never "we did not
// collect it", so a wholly-zeroed payload is treated as uncollected and no liquidity
// rows are written for that run.
export const has_liquidity_data = (players_array) =>
  (players_array || []).some(
    (player) =>
      Number(player?.oneQBValues?.tradeCount) > 0 ||
      Number(player?.superflexValues?.tradeCount) > 0
  )

// Summarise a zeroed liquidity payload so the NEXT occurrence is diagnosable
// rather than merely detectable. has_liquidity_data tells us the payload was
// uncollectable; it cannot tell us WHY, and the leading hypothesis (KTC's
// liquidity recompute is mid-flight when the 04:30 ET cron fires) is inference,
// not evidence. The distinguishing question is whether the fields were present
// and zero, or absent entirely -- a recompute-in-flight should look different
// from a schema change or a stripped response. Counting the shapes separates
// them; the sample carries a handful of verbatim value objects for the case
// where neither explanation fits.
export const summarize_zero_liquidity_payload = (
  players_array,
  sample_size = 5
) => {
  const players = players_array || []
  // Buckets are mutually exclusive and must describe what was OBSERVED, not what
  // we expect. all_three_zero is deliberately distinct from present_nonzero:
  // KTC legitimately serves rawLiquidity=0 alongside a nonzero stdLiquidity and
  // tradeCount, so collapsing every finite triple into a single "zero" bucket
  // would record a claim the data does not support.
  const shape_counts = {
    missing_values_object: 0,
    fields_absent: 0,
    all_three_zero: 0,
    present_nonzero: 0,
    fields_non_numeric: 0
  }

  for (const player of players) {
    for (const values of [player?.oneQBValues, player?.superflexValues]) {
      if (!values) {
        shape_counts.missing_values_object++
        continue
      }
      const has_all_keys =
        'rawLiquidity' in values &&
        'stdLiquidity' in values &&
        'tradeCount' in values
      if (!has_all_keys) {
        shape_counts.fields_absent++
        continue
      }
      const numbers = [
        Number(values.rawLiquidity),
        Number(values.stdLiquidity),
        Number(values.tradeCount)
      ]
      if (numbers.some((n) => !Number.isFinite(n))) {
        shape_counts.fields_non_numeric++
      } else if (numbers.every((n) => n === 0)) {
        shape_counts.all_three_zero++
      } else {
        shape_counts.present_nonzero++
      }
    }
  }

  return {
    captured_at: new Date().toISOString(),
    player_count: players.length,
    shape_counts,
    sample: players.slice(0, sample_size).map((player) => ({
      playerID: player?.playerID,
      playerName: player?.playerName,
      oneQBValues: player?.oneQBValues,
      superflexValues: player?.superflexValues
    }))
  }
}

export const build_liquidity_inserts = ({ pid, keeptradecut_player, d }) => {
  const rows = []
  const by_format = [
    [false, keeptradecut_player.oneQBValues],
    [true, keeptradecut_player.superflexValues]
  ]

  for (const [superflex, values] of by_format) {
    if (!values) continue

    const raw_liquidity = Number(values.rawLiquidity)
    const std_liquidity = Number(values.stdLiquidity)
    const trade_count = Number(values.tradeCount)

    // absent fields arrive as undefined; writing them as 0 would fabricate a
    // measurement, so skip the row entirely
    if (
      !Number.isFinite(raw_liquidity) ||
      !Number.isFinite(std_liquidity) ||
      !Number.isFinite(trade_count)
    ) {
      continue
    }

    rows.push({ pid, superflex, d, raw_liquidity, std_liquidity, trade_count })
  }

  return rows
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

  const liquidity_collected = has_liquidity_data(playersArray)
  if (!liquidity_collected) {
    log(
      'keeptradecut published zero liquidity for every player; skipping liquidity writes for this run'
    )
    // Preserve the offending payload. The shortfall below makes the skip
    // DETECTABLE; without this it is not DIAGNOSABLE -- the page is fetched
    // fresh each run, so by the time anyone looks the evidence is gone and the
    // cause stays a hypothesis. Best-effort: a forensics write must never be
    // able to fail the import it is describing.
    try {
      // Beside the league logs, not /tmp: this evidence must survive a reboot to
      // be worth writing, and the next occurrence may be weeks out. One small
      // JSON per zeroed run; not matched by the *.log logrotate glob, so it is
      // not rotated away before anyone reads it.
      const forensics_dir =
        process.env.LEAGUE_FORENSICS_DIR ||
        '/var/log/league/keeptradecut-zero-liquidity'
      await fs.mkdir(forensics_dir, { recursive: true })
      const forensics_path = path.join(
        forensics_dir,
        `${dayjs().format('YYYY-MM-DD-HHmmss')}.json`
      )
      await fs.writeFile(
        forensics_path,
        JSON.stringify(summarize_zero_liquidity_payload(playersArray), null, 2)
      )
      log(`zero-liquidity payload summary written to ${forensics_path}`)
    } catch (err) {
      log(`failed to persist zero-liquidity payload summary: ${err.message}`)
    }
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
      const now = dayjs().toDate()
      if (!dry) {
        await db('keeptradecut_pick')
          .insert({
            pid,
            ktc_player_id: item.playerID,
            ktc_player_name: keeptradecut_player.playerName,
            season_year: meta.year,
            round: meta.round,
            slot: meta.slot,
            created_at: now,
            updated_at: now
          })
          .onConflict('pid')
          .merge([
            'ktc_player_name',
            'season_year',
            'round',
            'slot',
            'updated_at'
          ])
      }
    } else {
      let player_row
      try {
        player_row = await find_player_row({
          keeptradecut_player_id: item.playerID
        })
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
              update: { keeptradecut_player_id: item.playerID },
              source: 'keeptradecut'
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

    // Liquidity is a same-day snapshot, not a history: KTC exposes only the current
    // value on the dynasty-rankings payload, so there is nothing to backfill.
    if (liquidity_collected && keeptradecut_player.position !== 'RDP') {
      const liquidity_inserts = build_liquidity_inserts({
        pid,
        keeptradecut_player,
        d: liquidity_d
      })

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

  const shortfalls = []

  if (!liquidity_collected) {
    shortfalls.push(
      `liquidity: keeptradecut published zero liquidity for all ${playersArray.length} players; no rows written for d=${dayjs.unix(liquidity_d).format('YYYY-MM-DD')}`
    )
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
      shortfalls.push('no rows found in keeptradecut_rankings after run')
    } else {
      const stale_hours = dayjs().diff(dayjs.unix(max_d), 'hour')
      if (stale_hours > freshness_threshold_hours) {
        shortfalls.push(
          `staleness: max(d)=${dayjs.unix(max_d).format('YYYY-MM-DD')} is ${stale_hours}h > threshold=${freshness_threshold_hours}h`
        )
      }
    }
  }

  return { shortfall: shortfalls.length ? shortfalls.join('; ') : null }
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
