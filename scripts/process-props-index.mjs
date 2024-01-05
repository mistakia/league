import debug from 'debug'
import oddslib from 'oddslib'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { constants } from '#libs-shared'
import { isMain } from '#libs-server'

const argv = yargs(hideBin(process.argv)).argv
const log = debug('process-props-index')
debug.enable('process-props-index')

const prop_desc = {
  [constants.player_prop_types.GAME_ALT_PASSING_YARDS]: 'pass',
  [constants.player_prop_types.GAME_ALT_RUSHING_YARDS]: 'rush',
  [constants.player_prop_types.GAME_ALT_RECEIVING_YARDS]: 'recv',

  [constants.player_prop_types.GAME_PASSING_YARDS]: 'pass',
  [constants.player_prop_types.GAME_RECEIVING_YARDS]: 'recv',
  [constants.player_prop_types.GAME_RUSHING_YARDS]: 'rush',
  [constants.player_prop_types.GAME_PASSING_COMPLETIONS]: 'comps',
  [constants.player_prop_types.GAME_PASSING_TOUCHDOWNS]: 'pass tds',
  [constants.player_prop_types.GAME_RECEPTIONS]: 'recs',
  [constants.player_prop_types.GAME_PASSING_INTERCEPTIONS]: 'ints',
  [constants.player_prop_types.GAME_RUSHING_ATTEMPTS]: 'rush atts',
  [constants.player_prop_types.GAME_RUSHING_RECEIVING_YARDS]: 'rush + recv',
  [constants.player_prop_types.GAME_RECEIVING_TOUCHDOWNS]: 'tds',
  [constants.player_prop_types.GAME_RUSHING_TOUCHDOWNS]: 'tds',
  [constants.player_prop_types.GAME_PASSING_ATTEMPTS]: 'pass atts',
  // constants.player_prop_types.GAME_PASSING_LONGEST_COMPLETION,
  // constants.player_prop_types.GAME_LONGEST_RECEPTION,
  [constants.player_prop_types.GAME_RUSHING_RECEIVING_TOUCHDOWNS]: 'tds',
  // constants.player_prop_types.GAME_LONGEST_RUSH,
  [constants.player_prop_types.GAME_PASSING_RUSHING_YARDS]: 'pass + rush',
  [constants.player_prop_types.GAME_ALT_PASSING_COMPLETIONS]: 'comps',
  [constants.player_prop_types.GAME_ALT_PASSING_TOUCHDOWNS]: 'pass tds',
  [constants.player_prop_types.GAME_ALT_RECEPTIONS]: 'recs',
  [constants.player_prop_types.GAME_ALT_RUSHING_ATTEMPTS]: 'rush atts'
}

const get_hits = ({ line, prop_type, player_gamelogs, strict }) =>
  player_gamelogs.filter((player_gamelog) =>
    is_hit({ line, prop_type, player_gamelog, strict })
  )

const is_hit = ({ line, prop_type, player_gamelog, strict = false }) => {
  switch (prop_type) {
    case constants.player_prop_types.GAME_PASSING_YARDS:
    case constants.player_prop_types.GAME_ALT_PASSING_YARDS:
      if (strict) {
        return player_gamelog.py >= line
      } else {
        const cushion = Math.min(Math.round(line * 0.06), 16)
        return player_gamelog.py >= line - cushion
      }

    case constants.player_prop_types.GAME_RUSHING_YARDS:
    case constants.player_prop_types.GAME_ALT_RUSHING_YARDS: {
      if (strict) {
        return player_gamelog.ry >= line
      } else {
        const cushion = Math.min(Math.round(line * 0.12), 9)
        return player_gamelog.ry >= line - cushion
      }
    }

    case constants.player_prop_types.GAME_RECEIVING_YARDS:
    case constants.player_prop_types.GAME_ALT_RECEIVING_YARDS:
      if (strict) {
        return player_gamelog.recy >= line
      } else {
        const cushion = Math.min(Math.round(line * 0.12), 9)
        return player_gamelog.recy >= line - cushion
      }

    case constants.player_prop_types.GAME_ALT_PASSING_COMPLETIONS:
    case constants.player_prop_types.GAME_PASSING_COMPLETIONS:
      return player_gamelog.pc >= (strict ? line : line - 1)

    case constants.player_prop_types.GAME_ALT_PASSING_TOUCHDOWNS:
    case constants.player_prop_types.GAME_PASSING_TOUCHDOWNS:
      return player_gamelog.tdp >= (strict ? line : line)

    case constants.player_prop_types.GAME_ALT_RECEPTIONS:
    case constants.player_prop_types.GAME_RECEPTIONS: {
      if (strict) {
        return player_gamelog.rec >= line
      } else {
        const cushion = Math.round(line * 0.15)
        return player_gamelog.rec >= line - cushion
      }
    }

    case constants.player_prop_types.GAME_PASSING_INTERCEPTIONS:
      return player_gamelog.ints >= (strict ? line : line)

    case constants.player_prop_types.GAME_ALT_RUSHING_ATTEMPTS:
    case constants.player_prop_types.GAME_RUSHING_ATTEMPTS:
      return player_gamelog.ra >= (strict ? line : line - 1)

    case constants.player_prop_types.GAME_RUSHING_RECEIVING_YARDS:
      return (
        player_gamelog.ry + player_gamelog.recy >= (strict ? line : line - 14)
      )

    case constants.player_prop_types.GAME_RECEIVING_TOUCHDOWNS:
      return player_gamelog.tdrec >= (strict ? line : line)

    case constants.player_prop_types.GAME_RUSHING_TOUCHDOWNS:
      return player_gamelog.tdr >= (strict ? line : line)

    case constants.player_prop_types.GAME_PASSING_ATTEMPTS:
      return player_gamelog.pa >= (strict ? line : line - 2)

    // constants.player_prop_types.GAME_PASSING_LONGEST_COMPLETION,
    // constants.player_prop_types.GAME_LONGEST_RECEPTION,

    case constants.player_prop_types.GAME_RUSHING_RECEIVING_TOUCHDOWNS:
      return player_gamelog.tdr + player_gamelog.tdrec >= (strict ? line : line)

    // constants.player_prop_types.GAME_LONGEST_RUSH,

    case constants.player_prop_types.GAME_PASSING_RUSHING_YARDS: {
      if (strict) {
        return player_gamelog.py + player_gamelog.ry >= line
      } else {
        const cushion = Math.min(Math.round(line * 0.06), 20)
        return player_gamelog.py + player_gamelog.ry >= line - cushion
      }
    }
  }

  return false
}

const format_prop_row = ({
  prop_row,
  all_player_gamelogs,
  week,
  opponent,
  player_row,
  esbid,
  seas_type
}) => {
  const formatted_prop_row = {
    pid: prop_row.selection_pid,
    esbid: prop_row.esbid,
    week: prop_row.week,
    year: prop_row.year,
    prop_type: prop_row.market_type,
    ln: prop_row.selection_metric_line,
    o: prop_row.odds_decimal,
    o_am: prop_row.odds_american,
    source_id: prop_row.source_id,
    timestamp: prop_row.timestamp,
    time_type: prop_row.time_type
  }

  // prop_row properties
  // - pid
  // - esbid
  // - week
  // - year
  // - prop_type
  // - ln
  // - o
  // - u
  // - o_am
  // - u_am
  // - source_id
  // - timestamp
  // - time_type

  const odds = formatted_prop_row.o_am
    ? oddslib.from('moneyline', formatted_prop_row.o_am)
    : null
  const market_prob = formatted_prop_row.o_am
    ? odds.to('impliedProbability')
    : null

  const player_gamelogs = all_player_gamelogs.filter(
    (p) => p.pid === formatted_prop_row.pid
  )
  const all_weeks = player_gamelogs.map((p) => p.week)
  const current_week = player_gamelogs.find((p) => p.esbid === esbid)
  const previous_weeks = player_gamelogs.filter((p) => {
    if (seas_type === 'POST' && p.seas_type === 'REG') {
      return true
    }

    if (seas_type === p.seas_type && p.week < week) {
      return true
    }

    return false
  })
  const is_success = current_week
    ? is_hit({
        line: formatted_prop_row.ln,
        prop_type: formatted_prop_row.prop_type,
        player_gamelog: current_week,
        strict: true
      })
    : null

  const hits_soft = get_hits({
    line: formatted_prop_row.ln,
    prop_type: formatted_prop_row.prop_type,
    player_gamelogs: previous_weeks
  })
  const hits_hard = get_hits({
    line: formatted_prop_row.ln,
    prop_type: formatted_prop_row.prop_type,
    player_gamelogs: previous_weeks,
    strict: true
  })

  const opponent_player_gamelogs = all_player_gamelogs.filter((p) => {
    if (p.opp !== opponent) {
      return false
    }
    if (p.pos !== player_row.pos) {
      return false
    }

    if (seas_type === 'REG' && p.seas_type === 'POST') {
      return false
    }

    if (seas_type === p.seas_type && p.week >= week) {
      return false
    }

    return true
  })
  const opponent_total_weeks = [
    ...new Set(opponent_player_gamelogs.map((p) => p.week))
  ]
  const opponent_allowed_hits = get_hits({
    line: formatted_prop_row.ln,
    prop_type: formatted_prop_row.prop_type,
    player_gamelogs: opponent_player_gamelogs
  })
  const opponent_hit_weeks = [
    ...new Set(opponent_allowed_hits.map((p) => p.week))
  ]

  const hist_rate_soft = hits_soft.length / player_gamelogs.length || 0
  const hist_rate_hard = hits_hard.length / player_gamelogs.length || 0
  let risk = formatted_prop_row.o_am ? 1 / odds.to('hongKong') : null
  if (risk > 100) {
    risk = null
  }
  const is_pending = !current_week

  return {
    ...formatted_prop_row,
    name: `${player_row.fname} ${player_row.lname} ${formatted_prop_row.ln} ${
      prop_desc[formatted_prop_row.prop_type]
    }`,
    team: player_row.cteam,
    opp: opponent,
    esbid,
    pos: player_row.pos,

    hits_soft: hits_soft.length,
    hit_weeks_soft: hits_soft.length
      ? JSON.stringify(hits_soft.map((p) => p.week).sort())
      : null,
    hits_hard: hits_hard.length,
    hit_weeks_hard: hits_hard.length
      ? JSON.stringify(hits_hard.map((p) => p.week).sort())
      : null,
    hits_opp: opponent_hit_weeks.length,
    opp_hit_weeks: opponent_hit_weeks.length
      ? JSON.stringify(opponent_hit_weeks.sort())
      : null,

    hist_rate_soft,
    hist_rate_hard,
    opp_allow_rate:
      opponent_hit_weeks.length / opponent_total_weeks.length || 0,

    hist_edge_soft: hist_rate_soft - market_prob,
    hist_edge_hard: hist_rate_hard - market_prob,
    market_prob,

    is_pending,
    is_success,
    risk,
    payout: is_pending ? 0 : is_success ? 1 : -risk,

    all_weeks: all_weeks.length ? JSON.stringify(all_weeks.sort()) : null,
    opp_weeks: opponent_total_weeks.length
      ? JSON.stringify(opponent_total_weeks.sort())
      : null
  }
}

const process_props_index = async ({
  prop_rows,
  seas_type = constants.season.nfl_seas_type,
  week = constants.season.nfl_seas_week,
  year = constants.season.year
} = {}) => {
  log(`processing ${prop_rows.length} prop rows`)

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

  const all_player_gamelogs = await db('player_gamelogs')
    .select(
      'player_gamelogs.*',
      'nfl_games.esbid',
      'nfl_games.week',
      'nfl_games.seas_type'
    )
    .join('nfl_games', 'nfl_games.esbid', 'player_gamelogs.esbid')
    .where('nfl_games.year', year)
    .whereNot('nfl_games.seas_type', 'PRE')

  log(`loaded ${all_player_gamelogs.length} gamelogs`)

  const player_pids = prop_rows.map((p) => p.selection_pid).filter(Boolean)
  const player_rows = await db('player')
    .select('pid', 'fname', 'lname', 'cteam', 'pos')
    .whereIn('pid', player_pids)

  log(`loaded ${player_rows.length} players`)

  const props_index_inserts = []

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

    const opponent = player_row.cteam === nfl_game.h ? nfl_game.v : nfl_game.h

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
      esbid: nfl_game.esbid,
      seas_type
    })

    props_index_inserts.push(formatted_prop_row)
  }

  if (argv.dry) {
    log(props_index_inserts[0])
    return
  }

  if (props_index_inserts.length) {
    log(`saving ${props_index_inserts.length} prop rows`)
    await db('props_index').insert(props_index_inserts).onConflict().merge()
  }
}

const main = async () => {
  let error
  try {
    const week = argv.week || constants.season.nfl_seas_week
    const year = argv.year || constants.season.year
    const seas_type = argv.seas_type || constants.season.nfl_seas_type
    const source = argv.source || 'FANDUEL'

    const prop_rows_query = db('prop_markets_index_new')
      .select(
        'prop_markets_index_new.*',
        'prop_market_selections_index.*',
        'nfl_games.week',
        'nfl_games.year'
      )
      .join('nfl_games', 'nfl_games.esbid', 'prop_markets_index_new.esbid')
      .join('prop_market_selections_index', function () {
        this.on(
          'prop_markets_index_new.source_market_id',
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
        constants.player_prop_types.GAME_ALT_PASSING_YARDS,
        constants.player_prop_types.GAME_ALT_RECEIVING_YARDS,
        constants.player_prop_types.GAME_ALT_RUSHING_YARDS,

        constants.player_prop_types.GAME_PASSING_YARDS,
        constants.player_prop_types.GAME_RECEIVING_YARDS,
        constants.player_prop_types.GAME_RUSHING_YARDS,
        constants.player_prop_types.GAME_PASSING_COMPLETIONS,
        constants.player_prop_types.GAME_PASSING_TOUCHDOWNS,
        constants.player_prop_types.GAME_RECEPTIONS,
        constants.player_prop_types.GAME_PASSING_INTERCEPTIONS,
        constants.player_prop_types.GAME_RUSHING_ATTEMPTS,
        constants.player_prop_types.GAME_RUSHING_RECEIVING_YARDS,
        constants.player_prop_types.GAME_RECEIVING_TOUCHDOWNS,
        constants.player_prop_types.GAME_RUSHING_TOUCHDOWNS,
        constants.player_prop_types.GAME_PASSING_ATTEMPTS,
        // constants.player_prop_types.GAME_PASSING_LONGEST_COMPLETION,
        // constants.player_prop_types.GAME_LONGEST_RECEPTION,
        constants.player_prop_types.GAME_RUSHING_RECEIVING_TOUCHDOWNS,
        // constants.player_prop_types.GAME_LONGEST_RUSH,
        constants.player_prop_types.GAME_PASSING_RUSHING_YARDS,
        constants.player_prop_types.GAME_ALT_PASSING_TOUCHDOWNS,
        constants.player_prop_types.GAME_ALT_PASSING_COMPLETIONS,
        constants.player_prop_types.GAME_ALT_RUSHING_ATTEMPTS,
        constants.player_prop_types.GAME_ALT_RECEPTIONS
      ])
      .where('prop_markets_index_new.time_type', 'CLOSE')
      .where('prop_markets_index_new.source_id', source)
      // .whereNot('prop_markets_index_new.source_id', constants.sources.PRIZEPICKS)
      .where('nfl_games.week', week)
      .where('nfl_games.seas_type', seas_type)
      .where('nfl_games.year', year)
      .whereRaw('LOWER(selection_name) NOT LIKE ?', ['%under%'])

    // log(prop_rows_query.toString())

    const prop_rows = await prop_rows_query

    await process_props_index({ prop_rows, week, year, seas_type })
  } catch (err) {
    error = err
    log(error)
  }

  /* await db('jobs').insert({
   *   type: constants.jobs.EXAMPLE,
   *   succ: error ? 0 : 1,
   *   reason: error ? error.message : null,
   *   timestamp: Math.round(Date.now() / 1000)
   * })
   */
  process.exit()
}

if (isMain(import.meta.url)) {
  main()
}

export default process_props_index
