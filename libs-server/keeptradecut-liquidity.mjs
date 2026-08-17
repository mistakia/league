import fs from 'fs/promises'
import path from 'path'

import { JSDOM } from 'jsdom'
import dayjs from 'dayjs'

import { fetch_with_retry } from './proxy-manager.mjs'

export const DYNASTY_RANKINGS_URL = 'https://keeptradecut.com/dynasty-rankings'

// Routed through the shared proxy pool rather than the process's own egress,
// matching the other keeptradecut fetches.
export const fetch_dynasty_rankings_players = async () => {
  const html = await fetch_with_retry({
    url: DYNASTY_RANKINGS_URL,
    response_type: 'text',
    use_proxy: true
  })
  const dom = new JSDOM(html, { runScripts: 'dangerously' })
  return dom.window.playersArray || []
}

// KTC publishes rawLiquidity/stdLiquidity/tradeCount inline on the dynasty-rankings
// page, for every player, on every request. Intermittently it serves that page with
// all three fields zeroed for every player, which is indistinguishable, row by row,
// from a player KTC genuinely reports no trades for. A stored zero must mean "KTC
// reported zero", never "we did not collect it", so a wholly-zeroed payload is
// treated as uncollected and no liquidity rows are written for that run.
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

// Preserve the offending payload. The caller's shortfall makes the skip
// DETECTABLE; without this it is not DIAGNOSABLE -- the page is fetched fresh
// each run, so by the time anyone looks the evidence is gone and the cause stays
// a hypothesis. Best-effort: a forensics write must never be able to fail the
// import it is describing.
//
// Beside the league logs, not /tmp: this evidence must survive a reboot to be
// worth writing, and the next occurrence may be weeks out. One small JSON per
// zeroed run; not matched by the *.log logrotate glob, so it is not rotated away
// before anyone reads it.
export const write_zero_liquidity_payload_summary = async (players_array) => {
  try {
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
      JSON.stringify(summarize_zero_liquidity_payload(players_array), null, 2)
    )
    console.log(`zero-liquidity payload summary written to ${forensics_path}`)
    return forensics_path
  } catch (err) {
    console.error(
      `failed to persist zero-liquidity payload summary: ${err.message}`
    )
    return null
  }
}

export const build_liquidity_inserts = ({
  pid,
  keeptradecut_player,
  observed_at
}) => {
  const rows = []
  const by_format = [
    [false, keeptradecut_player.oneQBValues],
    [true, keeptradecut_player.superflexValues]
  ]

  for (const [is_superflex, values] of by_format) {
    if (!values) continue

    const raw_liquidity = Number(values.rawLiquidity)
    const standardized_liquidity = Number(values.stdLiquidity)
    const trade_count = Number(values.tradeCount)

    // absent fields arrive as undefined; writing them as 0 would fabricate a
    // measurement, so skip the row entirely
    if (
      !Number.isFinite(raw_liquidity) ||
      !Number.isFinite(standardized_liquidity) ||
      !Number.isFinite(trade_count)
    ) {
      continue
    }

    rows.push({
      pid,
      is_superflex,
      observed_at,
      raw_liquidity,
      standardized_liquidity,
      trade_count
    })
  }

  return rows
}

// The day a run's liquidity is filed under. Liquidity is a same-day snapshot
// rather than a history -- KTC exposes only the current value -- so every run on
// a given calendar day writes the same observed_at, which is what lets a later
// recovery run fill the slot the 04:30 run could not. The league host runs
// TZ=America/New_York, so this is local midnight.
export const liquidity_observed_at = () => dayjs().startOf('day').toDate()
