import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { is_main } from '#libs-server'
import { current_season } from '#constants'

const log = debug('validate-charting-import')

async function validate_play_match_rates({ year }) {
  log('checking play match rates per game...')

  const games = await db('nfl_games')
    .select('nfl_games.esbid', 'nfl_games.week', 'nfl_games.h', 'nfl_games.v')
    .whereNotNull('nfl_games.shieldid')
    .where('nfl_games.season_year', year)

  const results = []

  for (const game of games) {
    const total_plays = await db('nfl_plays')
      .where({ esbid: game.esbid })
      .count('* as count')
      .first()

    const charting_plays = await db('nfl_plays')
      .where({ esbid: game.esbid })
      .whereNotNull('epa_charting')
      .count('* as count')
      .first()

    const total = parseInt(total_plays.count)
    const charted = parseInt(charting_plays.count)
    const rate = total > 0 ? ((charted / total) * 100).toFixed(1) : 0

    results.push({
      esbid: game.esbid,
      week: game.week,
      matchup: `${game.v}@${game.h}`,
      total_plays: total,
      charted_plays: charted,
      match_rate: parseFloat(rate)
    })
  }

  // Report games with zero matched plays
  const zero_match_games = results.filter((r) => r.charted_plays === 0)
  if (zero_match_games.length > 0) {
    log(`WARNING: ${zero_match_games.length} games with zero charted plays:`)
    for (const game of zero_match_games) {
      log(
        `  week ${game.week}: ${game.matchup} (esbid: ${game.esbid}, ${game.total_plays} total plays)`
      )
    }
  }

  // Report games below 95% match rate
  const low_match_games = results.filter(
    (r) => r.charted_plays > 0 && r.match_rate < 95
  )
  if (low_match_games.length > 0) {
    log(`WARNING: ${low_match_games.length} games below 95% match rate:`)
    for (const game of low_match_games) {
      log(
        `  week ${game.week}: ${game.matchup} - ${game.match_rate}% (${game.charted_plays}/${game.total_plays})`
      )
    }
  }

  const total_charted = results.reduce((sum, r) => sum + r.charted_plays, 0)
  const total_all = results.reduce((sum, r) => sum + r.total_plays, 0)
  const overall_rate =
    total_all > 0 ? ((total_charted / total_all) * 100).toFixed(1) : 0
  log(`overall: ${total_charted}/${total_all} plays charted (${overall_rate}%)`)

  return results
}

async function validate_player_match_rates({ year }) {
  log('checking player match rates...')

  const total_sumer_ids = await db('player')
    .whereNotNull('sumer_id')
    .count('* as count')
    .first()

  log(`total players with sumer_id: ${total_sumer_ids.count}`)

  // Check matchup stats player coverage
  const matchup_stats_count = await db('nfl_matchup_stats')
    .join('nfl_games', 'nfl_matchup_stats.esbid', 'nfl_games.esbid')
    .where('nfl_games.season_year', year)
    .count('* as count')
    .first()

  const null_offense = await db('nfl_matchup_stats')
    .join('nfl_games', 'nfl_matchup_stats.esbid', 'nfl_games.esbid')
    .where('nfl_games.season_year', year)
    .whereNull('nfl_matchup_stats.offense_player_id')
    .count('* as count')
    .first()

  const null_defense = await db('nfl_matchup_stats')
    .join('nfl_games', 'nfl_matchup_stats.esbid', 'nfl_games.esbid')
    .where('nfl_games.season_year', year)
    .whereNull('nfl_matchup_stats.defense_player_id')
    .count('* as count')
    .first()

  log(`matchup stats for ${year}: ${matchup_stats_count.count} total`)
  log(`  null offense_player_id: ${null_offense.count}`)
  log(`  null defense_player_id: ${null_defense.count}`)
}

async function validate_column_coverage({ year }) {
  log('checking charting column null rates...')

  const charting_columns = [
    'epa_charting',
    'dropback_depth',
    'play_action_concept',
    'run_concept',
    'run_gap_intent',
    'mofc_played',
    'mofc_look',
    'pass_width',
    'charting_play_type',
    'coverage_type',
    'man_zone'
  ]

  const games_with_charting = await db('nfl_plays')
    .join('nfl_games', 'nfl_plays.esbid', 'nfl_games.esbid')
    .where('nfl_games.season_year', year)
    .whereNotNull('nfl_plays.epa_charting')
    .count('* as count')
    .first()

  const total_charted = parseInt(games_with_charting.count)
  if (total_charted === 0) {
    log('no charted plays found for this year')
    return
  }

  log(`total charted plays: ${total_charted}`)

  for (const column of charting_columns) {
    const non_null = await db('nfl_plays')
      .join('nfl_games', 'nfl_plays.esbid', 'nfl_games.esbid')
      .where('nfl_games.season_year', year)
      .whereNotNull('nfl_plays.epa_charting')
      .whereNotNull(`nfl_plays.${column}`)
      .count('* as count')
      .first()

    const non_null_count = parseInt(non_null.count)
    const fill_rate = ((non_null_count / total_charted) * 100).toFixed(1)
    const status = parseFloat(fill_rate) < 10 ? 'LOW' : 'OK'
    log(
      `  ${column}: ${fill_rate}% filled (${non_null_count}/${total_charted}) [${status}]`
    )
  }
}

async function validate_epa_correlation({ year }) {
  log('comparing charting EPA vs nflfastR EPA...')

  const plays_with_both = await db('nfl_plays')
    .join('nfl_games', 'nfl_plays.esbid', 'nfl_games.esbid')
    .where('nfl_games.season_year', year)
    .whereNotNull('nfl_plays.epa')
    .whereNotNull('nfl_plays.epa_charting')
    .select('nfl_plays.epa', 'nfl_plays.epa_charting')

  if (plays_with_both.length === 0) {
    log('no plays with both EPA values found')
    return
  }

  // Calculate simple correlation stats
  const n = plays_with_both.length
  let sum_diff = 0
  let sum_diff_sq = 0

  for (const play of plays_with_both) {
    const diff = parseFloat(play.epa) - parseFloat(play.epa_charting)
    sum_diff += diff
    sum_diff_sq += diff * diff
  }

  const mean_diff = sum_diff / n
  const rmse = Math.sqrt(sum_diff_sq / n)

  log(`plays with both EPA values: ${n}`)
  log(`mean difference (nflfastr - charting): ${mean_diff.toFixed(4)}`)
  log(`RMSE: ${rmse.toFixed(4)}`)
}

export async function validate_charting_import({
  year = current_season.year
} = {}) {
  console.time('validate-charting-import')
  log(`validating charting import for year ${year}`)

  await validate_play_match_rates({ year })
  await validate_player_match_rates({ year })
  await validate_column_coverage({ year })
  await validate_epa_correlation({ year })

  console.timeEnd('validate-charting-import')
}

const main = async () => {
  try {
    const argv = yargs(hideBin(process.argv)).option('year', {
      type: 'number',
      description: 'Year to validate',
      default: current_season.year
    }).argv

    debug.enable('validate-charting-import')

    await validate_charting_import({ year: argv.year })
  } catch (error) {
    console.error(error)
  }

  process.exit()
}

if (is_main(import.meta.url)) {
  main()
}

export default validate_charting_import
