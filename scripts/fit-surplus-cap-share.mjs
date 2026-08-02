import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import {
  calculateBaselines,
  calculateValues,
  calibrate_projected_points,
  getRosterSize
} from '#libs-shared'
import { current_season } from '#constants'
import {
  is_main,
  getLeague,
  getPlayers,
  get_projection_calibration
} from '#libs-server'

const log = debug('fit-surplus-cap-share')
debug.enable('fit-surplus-cap-share')

const initialize_cli = () => yargs(hideBin(process.argv)).argv

// What fraction of the salary cap actually reaches above-replacement players?
//
// calculatePrices used to assume the answer is 1 -- that the cap is exhausted in
// proportion to surplus. It is not, because teams must fill every roster spot,
// and the players filling the back half have zero surplus by construction. The
// assumption is what made every baseline improvement break prices: raising the
// baseline shrinks the denominator and concentrates the same fixed pool.
//
// This fits the share directly: least squares of observed contract value on
// pts_added through the origin, over the rostered players of the hosted
// leagues, against the same calibrated board the pipeline builds. The board is
// assembled with the production helpers rather than a local reimplementation
// precisely so the fitted number cannot drift from what it is fitted for.
//
// Note the observations are dynasty contract values, not fresh auction clears,
// so they carry cheap long-term deals that pull the fit DOWN. That is a
// conservative direction for a ceiling check and is worth re-examining if this
// ever runs against a redraft league.
const WEEK = 0

const fit_league_share = async ({ lid, year }) => {
  const league = await getLeague({ lid, year })
  if (!league || !league.league_format_id) {
    log(`lid=${lid} has no league format for ${year}, skipping`)
    return null
  }

  const projection_rows = await db('projections_index')
    .distinct('pid')
    .where({ season_year: year, sourceid: 18, season_type: 'REG', week: WEEK })
  const projection_pids = projection_rows.map((row) => row.pid)

  const players = await getPlayers({
    pids: projection_pids,
    leagueId: lid,
    scoring_format_id: league.scoring_format_id
  })

  const calibration = await get_projection_calibration({
    scoring_format_id: league.scoring_format_id,
    period: 'season'
  })
  if (!calibration) {
    log(
      `lid=${lid} scoring format ${league.scoring_format_id} has no season calibration; fitting against the RAW board`
    )
  }

  calibrate_projected_points({ players, calibration, week: WEEK })

  const baselines = calculateBaselines({ players, league, week: WEEK })
  const total_pts_added = calculateValues({
    players,
    baselines,
    week: WEEK
  })

  const roster_size = getRosterSize(league)
  const league_total_salary_cap =
    league.num_teams * league.cap -
    league.num_teams * roster_size * league.min_bid
  const proportional_rate = league_total_salary_cap / total_pts_added

  // Observed price of every currently rostered player.
  const max_week_row = await db('rosters_players')
    .where({ lid, year })
    .max('week as week')
    .first()
  if (!max_week_row || max_week_row.week === null) {
    log(`lid=${lid} has no rosters for ${year}, skipping`)
    return null
  }

  const rostered = await db('rosters_players').where({
    lid,
    year,
    week: max_week_row.week
  })

  const pts_added_by_pid = {}
  for (const player of players) {
    pts_added_by_pid[player.pid] = player.pts_added[WEEK]
  }

  const observations = []
  for (const roster_row of rostered) {
    const player = players.find((p) => p.pid === roster_row.pid)
    // getPlayers resolves `value` to the player's current contract value in
    // this league.
    if (!player || player.value === null || player.value === undefined) continue
    const pts_added = pts_added_by_pid[roster_row.pid]
    if (pts_added === undefined || !(pts_added > 0)) continue
    observations.push({ salary: Number(player.value), pts_added })
  }

  if (observations.length < 10) {
    log(`lid=${lid} only ${observations.length} priced observations, skipping`)
    return null
  }

  const numerator = observations.reduce(
    (sum, o) => sum + o.salary * o.pts_added,
    0
  )
  const denominator = observations.reduce(
    (sum, o) => sum + o.pts_added * o.pts_added,
    0
  )
  const fitted_rate = numerator / denominator
  const share = fitted_rate / proportional_rate

  log(
    `lid=${lid} format=${league.league_format_id} observations=${observations.length} ` +
      `total_pts_added=${total_pts_added.toFixed(0)} ` +
      `proportional_rate=$${proportional_rate.toFixed(3)}/pt ` +
      `fitted_rate=$${fitted_rate.toFixed(3)}/pt share=${share.toFixed(3)}`
  )

  const top = [...players]
    .filter((p) => pts_added_by_pid[p.pid] > 0)
    .sort((a, b) => pts_added_by_pid[b.pid] - pts_added_by_pid[a.pid])
    .slice(0, 5)
  for (const player of top) {
    const pts_added = pts_added_by_pid[player.pid]
    log(
      `  ${(player.short_name || player.pid).padEnd(20)} ${player.primary_position.padEnd(4)} ` +
        `pts_added=${pts_added.toFixed(1).padStart(6)} ` +
        `fitted=$${Math.round(pts_added * fitted_rate)
          .toString()
          .padStart(3)} ` +
        `(uncorrected=$${Math.round(pts_added * proportional_rate)})`
    )
  }

  return { league_format_id: league.league_format_id, share }
}

export const fit_surplus_cap_share = async ({
  year = current_season.year
} = {}) => {
  const leagues = await db('leagues')
    .select('uid')
    .where({ hosted: true })
    .whereNull('archived_at')

  const results = []
  for (const league_row of leagues) {
    const result = await fit_league_share({ lid: league_row.uid, year })
    if (result) results.push(result)
  }

  return results
}

const main = async () => {
  const argv = initialize_cli()
  const year = argv.year ? Number(argv.year) : current_season.year

  const results = await fit_surplus_cap_share({ year })
  if (!results.length) {
    log('no leagues produced a fit')
    process.exit()
  }

  if (argv.save) {
    for (const { league_format_id, share } of results) {
      // Only formats with their own observations are written. Every other
      // format keeps the column default, which is this same figure -- applying
      // a share fitted elsewhere would dress up a default as evidence.
      await db('league_formats')
        .update({ surplus_cap_share: Number(share.toFixed(3)) })
        .where({ id: league_format_id })
      log(`saved surplus_cap_share=${share.toFixed(3)} for ${league_format_id}`)
    }
  } else {
    log('dry run — pass --save to persist')
  }

  process.exit()
}

if (is_main(import.meta.url)) {
  main()
}

export default fit_surplus_cap_share
