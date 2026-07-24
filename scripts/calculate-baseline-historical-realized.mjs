import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { calculateBaselines } from '#libs-shared'
import { current_season, fantasy_positions } from '#constants'
import { is_main, getLeague, get_league_format } from '#libs-server'

const log = debug('calculate-baseline-historical-realized')
debug.enable('calculate-baseline-historical-realized')

const initialize_cli = () => yargs(hideBin(process.argv)).argv

// Synthetic single-week key: calculateBaselines optimizes one "week" of points.
// Feeding it realized full-season totals makes it optimize the full-season
// starting lineup and return the worst starter per position — the demand-anchored
// replacement level (flex/superflex allocated by the same optimizer the live
// pricing path uses), measured on what the free pool ACTUALLY produced rather
// than on this year's compression-biased projections.
const SEASON_KEY = 'season'

// Per-position realized replacement level, per game, averaged over the last
// `years` completed seasons. Written to BOTH pts_base_season_* (the season
// projection multiplies it back by nflFinalWeek-1) and pts_base_week_* (per-week
// pricing uses it directly) so the season and weekly boards share one baseline.
const calculate_baseline_historical_realized = async ({
  league_format,
  years = 2
}) => {
  const scoring_format_id = league_format.scoring_format_id
  const games = current_season.nflFinalWeek - 1

  const per_game_samples = {}
  fantasy_positions.forEach((pos) => (per_game_samples[pos] = []))

  const start_year = current_season.year - years
  for (let year = start_year; year < current_season.year; year++) {
    const rows = await db('scoring_format_player_seasonlogs')
      .join('player', 'player.pid', 'scoring_format_player_seasonlogs.pid')
      .where(
        'scoring_format_player_seasonlogs.scoring_format_id',
        scoring_format_id
      )
      .where('scoring_format_player_seasonlogs.year', year)
      .whereIn('player.primary_position', fantasy_positions)
      .select(
        'player.pid',
        'player.primary_position',
        'scoring_format_player_seasonlogs.points'
      )

    if (!rows.length) {
      log(`no realized seasonlogs for ${scoring_format_id} ${year}, skipping`)
      continue
    }

    const players = rows.map((row) => ({
      pid: row.pid,
      primary_position: row.primary_position,
      points: { [SEASON_KEY]: { total: Number(row.points) || 0 } }
    }))

    const baseline = calculateBaselines({
      players,
      league: league_format,
      week: SEASON_KEY
    })

    for (const pos of fantasy_positions) {
      const starter = baseline[pos] && baseline[pos].starter
      const season_total = starter && (starter.points[SEASON_KEY] || {}).total
      if (season_total) {
        per_game_samples[pos].push(season_total / games)
        log(
          `${year} ${pos} replacement ${starter.pid} season=${season_total.toFixed(1)} per_game=${(season_total / games).toFixed(2)}`
        )
      }
    }
  }

  const update = {}
  for (const pos of fantasy_positions) {
    const samples = per_game_samples[pos]
    if (!samples.length) continue
    const avg = samples.reduce((sum, value) => sum + value, 0) / samples.length
    const rounded = Math.round(avg * 10) / 10
    const key = pos.toLowerCase()
    update[`pts_base_season_${key}`] = rounded
    update[`pts_base_week_${key}`] = rounded
    log(`${pos} realized per-game baseline ${avg.toFixed(2)} -> ${rounded}`)
  }

  return update
}

const main = async () => {
  const argv = initialize_cli()
  const lid = argv.lid
  const league_format_id =
    argv.league_format_id ||
    (typeof lid === 'number'
      ? (await getLeague({ lid })).league_format_id
      : null)

  if (!league_format_id) {
    console.log('missing --lid or --league_format_id')
    process.exit()
  }

  const league_format = await get_league_format({ league_format_id })
  if (!league_format) {
    throw new Error(`league format ${league_format_id} not found`)
  }

  const update = await calculate_baseline_historical_realized({ league_format })
  log(update)

  if (argv.save) {
    await db('league_formats')
      .update(update)
      .where({ id: league_format.league_format_id })
    log(`saved baselines for ${league_format.league_format_id}`)
  } else {
    log('dry run — pass --save to persist')
  }

  process.exit()
}

if (is_main(import.meta.url)) {
  main()
}

export default calculate_baseline_historical_realized
