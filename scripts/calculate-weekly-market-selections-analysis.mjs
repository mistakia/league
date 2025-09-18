import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { constants } from '#libs-shared'
import { player_prop_types } from '#libs-shared/bookmaker-constants.mjs'
import { is_main, batch_insert, selection_result } from '#libs-server'
// import { job_types } from '#libs-shared/job-constants.mjs'

const argv = yargs(hideBin(process.argv)).argv
const log = debug('calculate-weekly-market-selections-analysis')
debug.enable('calculate-weekly-market-selections-analysis')

const prop_desc = {
  [player_prop_types.GAME_ALT_PASSING_YARDS]: 'pass',
  [player_prop_types.GAME_ALT_RUSHING_YARDS]: 'rush',
  [player_prop_types.GAME_ALT_RECEIVING_YARDS]: 'recv',

  [player_prop_types.GAME_PASSING_YARDS]: 'pass',
  [player_prop_types.GAME_RECEIVING_YARDS]: 'recv',
  [player_prop_types.GAME_RUSHING_YARDS]: 'rush',
  [player_prop_types.GAME_PASSING_COMPLETIONS]: 'comps',
  [player_prop_types.GAME_PASSING_TOUCHDOWNS]: 'pass tds',
  [player_prop_types.GAME_RECEPTIONS]: 'recs',
  [player_prop_types.GAME_PASSING_INTERCEPTIONS]: 'ints',
  [player_prop_types.GAME_RUSHING_ATTEMPTS]: 'rush atts',
  [player_prop_types.GAME_RUSHING_RECEIVING_YARDS]: 'rush + recv',
  [player_prop_types.GAME_RECEIVING_TOUCHDOWNS]: 'tds',
  [player_prop_types.GAME_RUSHING_TOUCHDOWNS]: 'tds',
  [player_prop_types.GAME_PASSING_ATTEMPTS]: 'pass atts',
  // player_prop_types.GAME_PASSING_LONGEST_COMPLETION,
  // player_prop_types.GAME_LONGEST_RECEPTION,
  [player_prop_types.ANYTIME_TOUCHDOWN]: 'tds',
  // player_prop_types.GAME_LONGEST_RUSH,
  [player_prop_types.GAME_PASSING_RUSHING_YARDS]: 'pass + rush',
  [player_prop_types.GAME_ALT_PASSING_COMPLETIONS]: 'comps',
  [player_prop_types.GAME_ALT_PASSING_TOUCHDOWNS]: 'pass tds',
  [player_prop_types.GAME_ALT_RECEPTIONS]: 'recs',
  [player_prop_types.GAME_ALT_RUSHING_ATTEMPTS]: 'rush atts',
  [player_prop_types.GAME_FIRST_QUARTER_ALT_PASSING_YARDS]: '1q pass',
  [player_prop_types.GAME_FIRST_QUARTER_ALT_RUSHING_YARDS]: '1q rush',
  [player_prop_types.GAME_FIRST_QUARTER_ALT_RECEIVING_YARDS]: '1q recv'
}

const get_hits = ({
  line,
  market_type,
  player_gamelogs,
  strict,
  selection_type = 'OVER'
}) =>
  player_gamelogs.filter((player_gamelog) =>
    selection_result.is_hit({
      line,
      market_type,
      player_gamelog,
      strict,
      selection_type
    })
  )

const format_prop_row = ({
  prop_row,
  all_player_gamelogs,
  week,
  opponent,
  player_row,
  seas_type,
  year,
  all_plays = []
}) => {
  const player_gamelogs = all_player_gamelogs.filter(
    (p) => p.pid === prop_row.selection_pid
  )

  // Group plays by game and calculate quarter stats
  const quarter_gamelogs = Object.values(
    all_plays
      .filter(
        (p) =>
          p.psr_pid === prop_row.selection_pid ||
          p.bc_pid === prop_row.selection_pid ||
          p.trg_pid === prop_row.selection_pid
      )
      .reduce((acc, play) => {
        if (!acc[play.esbid]) {
          acc[play.esbid] = {
            esbid: play.esbid,
            pid: prop_row.selection_pid,
            year: play.year,
            week: play.week,
            seas_type: play.seas_type,
            pos: player_row.pos,
            first_quarter_stats: {
              passing_yards: 0,
              rushing_yards: 0,
              receiving_yards: 0
            }
          }
        }

        if (play.qtr === 1) {
          if (play.psr_pid === prop_row.selection_pid) {
            acc[play.esbid].first_quarter_stats.passing_yards +=
              play.pass_yds || 0
          }
          if (play.bc_pid === prop_row.selection_pid) {
            acc[play.esbid].first_quarter_stats.rushing_yards +=
              play.rush_yds || 0
          }
          if (
            play.trg_pid === prop_row.selection_pid &&
            play.bc_pid === prop_row.selection_pid
          ) {
            acc[play.esbid].first_quarter_stats.receiving_yards +=
              play.recv_yds || 0
          }
        }

        return acc
      }, {})
  )

  // Sort quarter gamelogs to match the order of regular gamelogs
  quarter_gamelogs.sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year
    if (a.seas_type !== b.seas_type)
      return b.seas_type.localeCompare(a.seas_type)
    return a.week - b.week
  })

  const current_season_opponent_player_gamelogs = all_player_gamelogs.filter(
    (p) => {
      if (p.opp !== opponent) return false
      if (p.pos !== player_row.pos) return false
      if (p.year !== year) return false
      if (seas_type === 'REG' && p.seas_type === 'POST') return false
      if (seas_type === p.seas_type && p.week >= week) return false
      return true
    }
  )

  const format_week = (year, seas_type, week) => `/${year}/${seas_type}/${week}`

  const current_season_gamelogs = player_gamelogs.filter(
    (p) => p.year === year && p.seas_type === seas_type
  )
  const current_season_quarter_gamelogs = quarter_gamelogs.filter(
    (p) => p.year === year && p.seas_type === seas_type
  )

  const last_season_gamelogs = player_gamelogs.filter(
    (p) => p.year === year - 1
  )
  const last_season_quarter_gamelogs = quarter_gamelogs.filter(
    (p) => p.year === year - 1
  )

  const last_five_gamelogs = player_gamelogs.slice(-5)
  const last_five_quarter_gamelogs = quarter_gamelogs.slice(-5)

  const last_ten_gamelogs = player_gamelogs.slice(-10)
  const last_ten_quarter_gamelogs = quarter_gamelogs.slice(-10)

  const get_hit_data = (gamelogs, quarter_gamelogs = []) => {
    const merged_gamelogs = gamelogs.map((g) => ({
      ...(quarter_gamelogs.find((q) => q.esbid === g.esbid) || {}),
      ...g
    }))

    const hits_soft = get_hits({
      line: prop_row.selection_metric_line,
      market_type: prop_row.market_type,
      player_gamelogs: merged_gamelogs,
      selection_type: prop_row.selection_type
    })
    const hits_hard = get_hits({
      line: prop_row.selection_metric_line,
      market_type: prop_row.market_type,
      player_gamelogs: merged_gamelogs,
      strict: true,
      selection_type: prop_row.selection_type
    })

    return {
      hits_soft: hits_soft.length,
      hit_weeks_soft: hits_soft.length
        ? JSON.stringify(
            hits_soft
              .map((p) => format_week(p.year, p.seas_type, p.week))
              .sort()
          )
        : null,
      hits_hard: hits_hard.length,
      hit_weeks_hard: hits_hard.length
        ? JSON.stringify(
            hits_hard
              .map((p) => format_week(p.year, p.seas_type, p.week))
              .sort()
          )
        : null,
      weeks_played: JSON.stringify(
        merged_gamelogs
          .map((p) => format_week(p.year, p.seas_type, p.week))
          .sort()
      )
    }
  }

  const current_season_data = get_hit_data(
    current_season_gamelogs,
    current_season_quarter_gamelogs
  )
  const last_season_data = get_hit_data(
    last_season_gamelogs,
    last_season_quarter_gamelogs
  )
  const last_five_data = get_hit_data(
    last_five_gamelogs,
    last_five_quarter_gamelogs
  )
  const last_ten_data = get_hit_data(
    last_ten_gamelogs,
    last_ten_quarter_gamelogs
  )
  const overall_data = get_hit_data(player_gamelogs, quarter_gamelogs)

  const opponent_allowed_hits = get_hits({
    line: prop_row.selection_metric_line,
    market_type: prop_row.market_type,
    player_gamelogs: current_season_opponent_player_gamelogs,
    selection_type: prop_row.selection_type
  })
  const opponent_hit_weeks = [
    ...new Set(
      opponent_allowed_hits.map((p) => format_week(p.year, p.seas_type, p.week))
    )
  ]
  const opponent_weeks_played = [
    ...new Set(
      current_season_opponent_player_gamelogs.map((p) =>
        format_week(p.year, p.seas_type, p.week)
      )
    )
  ]

  return {
    source_id: prop_row.source_id,
    source_market_id: prop_row.source_market_id,
    source_selection_id: prop_row.source_selection_id,
    market_type: prop_row.market_type,
    esbid: prop_row.esbid,
    selection_pid: prop_row.selection_pid,

    name: `${player_row.fname} ${player_row.lname} ${prop_row.selection_metric_line} ${
      prop_desc[prop_row.market_type]
    } ${prop_row.selection_type || 'OVER'}`,
    team: player_row.current_nfl_team,
    opp: opponent,
    pos: player_row.pos,

    current_season_hits_soft: current_season_data.hits_soft,
    current_season_hit_weeks_soft: current_season_data.hit_weeks_soft,
    current_season_hits_hard: current_season_data.hits_hard,
    current_season_hit_weeks_hard: current_season_data.hit_weeks_hard,
    current_season_weeks_played: current_season_data.weeks_played,

    last_five_hits_soft: last_five_data.hits_soft,
    last_five_hit_weeks_soft: last_five_data.hit_weeks_soft,
    last_five_hits_hard: last_five_data.hits_hard,
    last_five_hit_weeks_hard: last_five_data.hit_weeks_hard,
    last_five_weeks_played: last_five_data.weeks_played,

    last_ten_hits_soft: last_ten_data.hits_soft,
    last_ten_hit_weeks_soft: last_ten_data.hit_weeks_soft,
    last_ten_hits_hard: last_ten_data.hits_hard,
    last_ten_hit_weeks_hard: last_ten_data.hit_weeks_hard,
    last_ten_weeks_played: last_ten_data.weeks_played,

    last_season_hits_soft: last_season_data.hits_soft,
    last_season_hit_weeks_soft: last_season_data.hit_weeks_soft,
    last_season_hits_hard: last_season_data.hits_hard,
    last_season_hit_weeks_hard: last_season_data.hit_weeks_hard,
    last_season_weeks_played: last_season_data.weeks_played,

    overall_hits_soft: overall_data.hits_soft,
    overall_hit_weeks_soft: overall_data.hit_weeks_soft,
    overall_hits_hard: overall_data.hits_hard,
    overall_hit_weeks_hard: overall_data.hit_weeks_hard,
    overall_weeks_played: overall_data.weeks_played,

    current_season_hits_opp: opponent_hit_weeks.length,
    current_season_opp_hit_weeks: opponent_hit_weeks.length
      ? JSON.stringify(opponent_hit_weeks.sort())
      : null,
    current_season_opp_weeks_played: JSON.stringify(
      opponent_weeks_played.sort()
    )
  }
}

const calculate_weekly_market_selections_analysis = async ({
  prop_rows,
  seas_type = constants.season.nfl_seas_type,
  week = constants.season.nfl_seas_week,
  year = constants.season.year,
  dry_run = false
} = {}) => {
  log(`calculating analysis for ${prop_rows.length} prop rows`)

  if (!prop_rows.length) {
    return
  }

  const nfl_games = await db('nfl_games').where({
    year,
    week,
    seas_type
  })
  log(
    `loaded ${nfl_games.length} nfl games for week ${week} ${constants.season.year}`
  )

  const current_year = year
  const previous_year = year - 1

  const all_player_gamelogs = await db('player_gamelogs')
    .select(
      'player_gamelogs.*',
      'nfl_games.esbid',
      'nfl_games.week',
      'nfl_games.seas_type',
      'nfl_games.year'
    )
    .join('nfl_games', 'nfl_games.esbid', 'player_gamelogs.esbid')
    .whereIn('nfl_games.year', [current_year, previous_year])
    .whereNot('nfl_games.seas_type', 'PRE')
    .orderBy([
      { column: 'nfl_games.year', order: 'asc' },
      { column: 'nfl_games.seas_type', order: 'desc' },
      { column: 'nfl_games.week', order: 'asc' }
    ])

  log(`loaded ${all_player_gamelogs.length} gamelogs`)

  const player_pids = prop_rows.map((p) => p.selection_pid).filter(Boolean)
  const player_rows = await db('player')
    .select('pid', 'fname', 'lname', 'current_nfl_team', 'pos')
    .whereIn('pid', player_pids)

  log(`loaded ${player_rows.length} players`)

  const props_index_inserts = []

  const nfl_plays = await db('nfl_plays')
    .select(
      'esbid',
      'week',
      'year',
      'seas_type',
      'qtr',
      'pass_yds',
      'recv_yds',
      'rush_yds',
      'psr_pid',
      'trg_pid',
      'bc_pid'
    )
    .where({
      year,
      seas_type
    })
    .whereNot('play_type', 'NOPL')
    .orderBy('esbid')

  log(`loaded ${nfl_plays.length} plays`)

  for (const prop_row of prop_rows) {
    if (!prop_row.selection_pid) {
      continue
    }

    if (prop_row.selection_metric_line === 0) {
      console.log(prop_row)
      process.exit()
    }

    const player_row = player_rows.find(
      (player) => player.pid === prop_row.selection_pid
    )
    const nfl_game = nfl_games.find((g) => g.esbid === prop_row.esbid)

    if (!nfl_game) {
      continue
    }

    const opponent =
      player_row.current_nfl_team === nfl_game.h ? nfl_game.v : nfl_game.h

    // skip props on bye
    if (!opponent) {
      continue
    }

    const formatted_prop_row = format_prop_row({
      prop_row,
      all_player_gamelogs,
      week,
      opponent,
      player_row,
      seas_type,
      year,
      all_plays: nfl_plays || []
    })

    props_index_inserts.push(formatted_prop_row)
  }

  if (dry_run) {
    console.log(props_index_inserts[0])
    return
  }

  if (props_index_inserts.length) {
    await db('weekly_market_selections_analysis_cache').del()

    log(`saving ${props_index_inserts.length} prop rows`)
    await batch_insert({
      items: props_index_inserts,
      save: async (chunk) => {
        await db('weekly_market_selections_analysis_cache')
          .insert(chunk)
          .onConflict(['source_id', 'source_market_id', 'source_selection_id'])
          .merge()
      },
      batch_size: 500
    })
  }
}

const main = async () => {
  let error
  try {
    const week = argv.week || constants.season.nfl_seas_week
    const year = argv.year || constants.season.year
    const seas_type = argv.seas_type || constants.season.nfl_seas_type
    const source = argv.source || 'FANDUEL'
    const dry_run = argv.dry || false
    log({
      week,
      year,
      seas_type,
      source
    })

    const prop_rows_query = db('prop_markets_index')
      .select(
        'prop_markets_index.*',
        'prop_market_selections_index.*',
        'nfl_games.week',
        'nfl_games.year'
      )
      .join('nfl_games', 'nfl_games.esbid', 'prop_markets_index.esbid')
      .join('prop_market_selections_index', function () {
        this.on(
          'prop_markets_index.source_market_id',
          '=',
          'prop_market_selections_index.source_market_id'
        )
        this.andOn(
          'prop_market_selections_index.source_id',
          '=',
          db.raw('?', [source])
        )
        this.andOn(
          'prop_market_selections_index.time_type',
          '=',
          db.raw('?', ['CLOSE'])
        )
      })
      .whereIn('market_type', [
        player_prop_types.GAME_ALT_PASSING_YARDS,
        player_prop_types.GAME_ALT_RECEIVING_YARDS,
        player_prop_types.GAME_ALT_RUSHING_YARDS,

        player_prop_types.GAME_PASSING_YARDS,
        player_prop_types.GAME_RECEIVING_YARDS,
        player_prop_types.GAME_RUSHING_YARDS,
        player_prop_types.GAME_PASSING_COMPLETIONS,
        player_prop_types.GAME_PASSING_TOUCHDOWNS,
        player_prop_types.GAME_RECEPTIONS,
        player_prop_types.GAME_PASSING_INTERCEPTIONS,
        player_prop_types.GAME_RUSHING_ATTEMPTS,
        player_prop_types.GAME_RUSHING_RECEIVING_YARDS,
        player_prop_types.GAME_RECEIVING_TOUCHDOWNS,
        player_prop_types.GAME_RUSHING_TOUCHDOWNS,
        player_prop_types.GAME_PASSING_ATTEMPTS,
        // player_prop_types.GAME_PASSING_LONGEST_COMPLETION,
        // player_prop_types.GAME_LONGEST_RECEPTION,
        player_prop_types.ANYTIME_TOUCHDOWN,
        // player_prop_types.GAME_LONGEST_RUSH,
        player_prop_types.GAME_PASSING_RUSHING_YARDS,
        player_prop_types.GAME_ALT_PASSING_TOUCHDOWNS,
        player_prop_types.GAME_ALT_PASSING_COMPLETIONS,
        player_prop_types.GAME_ALT_RUSHING_ATTEMPTS,
        player_prop_types.GAME_ALT_RECEPTIONS,
        player_prop_types.GAME_FIRST_QUARTER_ALT_PASSING_YARDS,
        player_prop_types.GAME_FIRST_QUARTER_ALT_RUSHING_YARDS,
        player_prop_types.GAME_FIRST_QUARTER_ALT_RECEIVING_YARDS
      ])
      .where('prop_markets_index.time_type', 'CLOSE')
      .where('prop_markets_index.source_id', source)
      .where('nfl_games.week', week)
      .where('nfl_games.seas_type', seas_type)
      .where('nfl_games.year', year)

    // log(prop_rows_query.toString())

    const prop_rows = await prop_rows_query

    await calculate_weekly_market_selections_analysis({ prop_rows, week, year, seas_type, dry_run })
  } catch (err) {
    error = err
    log(error)
  }

  process.exit()
}

if (is_main(import.meta.url)) {
  main()
}

export default calculate_weekly_market_selections_analysis
