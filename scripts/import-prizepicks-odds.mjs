import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import fs from 'node:fs/promises'

import db from '#db'
import { current_season } from '#constants'
import {
  is_main,
  prizepicks,
  find_player_row,
  insert_prop_markets,
  report_job
} from '#libs-server'
import { normalize_selection_metric_line } from '#libs-server/normalize-selection-metric-line.mjs'
import { touchdown_market_types } from '#libs-server/prizepicks.mjs'
import { job_types } from '#libs-shared/job-constants.mjs'
import { enable_debug_namespaces } from '#libs-shared/enable-debug-namespaces.mjs'
import { fixTeam } from '#libs-shared'

const initialize_cli = () => {
  return yargs(hideBin(process.argv)).argv
}

const log = debug('import-prizepicks-odds')

enable_debug_namespaces('import-prizepicks-odds,get-player,prizepicks')

// An ordered (away, home) pair recurs at most once in a season, so the kickoff
// window only has to separate a regular-season meeting from a postseason
// rematch. Two days is wide enough to absorb a rescheduled game and far
// narrower than any gap between two meetings of the same pairing.
const KICKOFF_MATCH_WINDOW_MS = 2 * 24 * 60 * 60 * 1000

// The payload's `included` array carries a `game` entity alongside the
// `new_player` entity this importer already reads, keyed to a projection by
// attributes.game_id. It holds the book's game id, both team abbreviations and
// the kickoff -- everything needed to name our game, and none of it moves after
// the game is published.
export const extract_prizepicks_games = (included = []) => {
  const games_by_prizepicks_game_id = new Map()

  for (const item of included) {
    if (item?.type !== 'game') {
      continue
    }

    const prizepicks_game_id =
      item.attributes?.external_game_id || item.attributes?.metadata?.game_id

    if (prizepicks_game_id) {
      games_by_prizepicks_game_id.set(prizepicks_game_id, item)
    }
  }

  return games_by_prizepicks_game_id
}

// Resolve a PrizePicks game entity to one of our games by the two teams and the
// kickoff. This is strictly stronger than the team-based match below, which
// reads the PLAYER's CURRENT team against the CURRENT week's games -- both of
// which move after first observation, which is what re-stamps a settled
// market's esbid onto a later week's game or onto a traded player's new team.
export const match_prizepicks_game = ({ prizepicks_game, nfl_games = [] }) => {
  const teams = prizepicks_game?.attributes?.metadata?.game_info?.teams
  const away_nfl_team = teams?.away?.abbreviation
    ? fixTeam(teams.away.abbreviation)
    : null
  const home_nfl_team = teams?.home?.abbreviation
    ? fixTeam(teams.home.abbreviation)
    : null
  const start_time = prizepicks_game?.attributes?.start_time

  if (!away_nfl_team || !home_nfl_team || !start_time) {
    return null
  }

  const start_time_ms = new Date(start_time).getTime()
  if (Number.isNaN(start_time_ms)) {
    return null
  }

  const matches = nfl_games.filter(
    (game) =>
      game.away_nfl_team === away_nfl_team &&
      game.home_nfl_team === home_nfl_team &&
      game.kickoff_at &&
      Math.abs(new Date(game.kickoff_at).getTime() - start_time_ms) <
        KICKOFF_MATCH_WINDOW_MS
  )

  // Ambiguity is a reason to decline, not to pick one. A crosswalk entry is
  // durable and stamps every future observation of every market on that game,
  // so a wrong entry is worse than no entry -- a miss merely falls back.
  return matches.length === 1 ? matches[0] : null
}

const load_prizepicks_game_crosswalk = async (prizepicks_game_ids) => {
  if (!prizepicks_game_ids.length) {
    return new Map()
  }

  const rows = await db('nfl_games').whereIn(
    'prizepicks_game_id',
    prizepicks_game_ids
  )

  return new Map(rows.map((row) => [row.prizepicks_game_id, row]))
}

// Write a newly resolved pairing back, so the next import reads it from the
// crosswalk instead of re-deriving it.
const persist_prizepicks_game_crosswalk = async (pairs) => {
  let stamped_count = 0

  for (const { prizepicks_game_id, esbid } of pairs) {
    try {
      // Never overwrite an existing entry. The crosswalk is the authority once
      // written, and re-deriving over it would reintroduce exactly the drift
      // this replaces.
      stamped_count += await db('nfl_games')
        .where({ esbid })
        .whereNull('prizepicks_game_id')
        .update({ prizepicks_game_id })
    } catch (err) {
      // The unique index rejected it, so another game already holds this id.
      // Decline rather than repoint: a durable wrong crosswalk entry is worse
      // than the fallback path this market takes instead.
      log(
        `could not stamp prizepicks_game_id ${prizepicks_game_id} on esbid ${esbid}: ${err.message}`
      )
    }
  }

  return stamped_count
}

const format_market = async ({
  prizepicks_market,
  observed_at,
  prizepicks_player,
  crosswalk_nfl_game = null,
  nfl_games = []
}) => {
  const selections = []
  let player_row
  let nfl_game

  const params = {
    name: prizepicks_player.attributes.name,
    team: prizepicks_player.attributes.team,
    ignore_free_agent: true,
    ignore_retired: true
  }

  try {
    player_row = await find_player_row(params)
  } catch (err) {
    log(err)
  }

  // The crosswalk is the authority. Fall back to the player's current team
  // against the current week's games only when it misses -- that match is
  // correct on FIRST observation and wrong on every later one, so it may open a
  // pairing but must never be allowed to revise one.
  if (crosswalk_nfl_game) {
    nfl_game = crosswalk_nfl_game
  } else if (player_row) {
    nfl_game = nfl_games.find(
      (game) =>
        game.away_nfl_team === player_row.current_nfl_team ||
        game.home_nfl_team === player_row.current_nfl_team
    )
  }

  // Extract and normalize the line
  const raw_line = Number(prizepicks_market.attributes?.line_score) || null
  const normalized_line = normalize_selection_metric_line({
    raw_value: raw_line,
    selection_name: prizepicks_market.attributes?.stat_type || ''
  })

  // Get market type with line context for proper routing
  const market_type = prizepicks.get_market_type(
    prizepicks_market.attributes?.stat_type,
    { selection_metric_line: normalized_line }
  )

  // Normalize selection types for touchdown markets (OVER/UNDER -> YES/NO)
  const is_touchdown_market = touchdown_market_types.has(market_type)
  const over_selection_type = is_touchdown_market ? 'YES' : 'OVER'
  const under_selection_type = is_touchdown_market ? 'NO' : 'UNDER'

  selections.push({
    source_id: 'PRIZEPICKS',
    source_market_id: prizepicks_market.id,
    source_selection_id: `${prizepicks_market.id}-over`,
    selection_type: over_selection_type,

    selection_pid: player_row?.pid || null,
    selection_name: is_touchdown_market ? 'yes' : 'over',
    selection_metric_line: normalized_line,
    odds_decimal: null,
    odds_american: null
  })

  selections.push({
    source_id: 'PRIZEPICKS',
    source_market_id: prizepicks_market.id,
    source_selection_id: `${prizepicks_market.id}-under`,
    selection_type: under_selection_type,

    selection_pid: player_row?.pid || null,
    selection_name: is_touchdown_market ? 'no' : 'under',
    selection_metric_line: normalized_line,
    odds_decimal: null,
    odds_american: null
  })

  return {
    market_type,

    source_id: 'PRIZEPICKS',
    source_market_id: prizepicks_market.id,
    source_market_name: `${prizepicks_market.attributes?.projection_type} - ${prizepicks_market.attributes?.stat_type}`,

    esbid: nfl_game?.esbid || null,
    source_event_id: prizepicks_market.attributes?.game_id || null,
    source_event_name: null,

    is_open: true,
    is_live: false,
    selection_count: 2,
    // season_year travels with esbid and has the same failure mode, so it is
    // read off the resolved game rather than off the clock.
    season_year: nfl_game?.season_year || current_season.year,

    observed_at,
    selections
  }
}

const import_prizepicks_odds = async ({
  dry_run = false,
  write_file = false
} = {}) => {
  // do not pull in reports outside of the NFL season
  if (
    !current_season.now.isBetween(
      current_season.regular_season_start,
      current_season.end
    )
  ) {
    return
  }

  console.time('import-prizepicks-odds')

  const timestamp = Math.round(Date.now() / 1000)
  const observed_at = new Date()
  const formatted_markets = []
  const all_markets = []
  const missing_market_types = new Set()

  // The fallback path only. This is deliberately still scoped to the current
  // week, because the player's current team is only a usable signal against the
  // games of the week that team is playing -- widening it would make the
  // fallback MORE willing to guess, not less.
  const nfl_games = await db('nfl_games').where({
    week: current_season.nfl_seas_week,
    season_year: current_season.year,
    season_type: current_season.nfl_seas_type
  })

  // Candidates for resolving a game entity from the payload. Keyed on teams and
  // kickoff rather than on the current week, so a market observed in a later
  // week still resolves to the game it was offered on.
  const crosswalk_candidate_games = await db('nfl_games').whereIn(
    'season_year',
    [current_season.year, current_season.year - 1]
  )

  let page = 1
  let data
  do {
    data = await prizepicks.getPlayerProps({ page })

    const prizepicks_games = extract_prizepicks_games(data.included)
    const page_prizepicks_game_ids = [
      ...new Set(
        data.data.map((item) => item.attributes?.game_id).filter(Boolean)
      )
    ]

    const crosswalk = await load_prizepicks_game_crosswalk(
      page_prizepicks_game_ids
    )

    // Resolve whatever the crosswalk missed from the payload's own game entity,
    // and write those pairings back so the next import reads them instead.
    const newly_resolved = []
    for (const prizepicks_game_id of page_prizepicks_game_ids) {
      if (crosswalk.has(prizepicks_game_id)) {
        continue
      }

      const matched_game = match_prizepicks_game({
        prizepicks_game: prizepicks_games.get(prizepicks_game_id),
        nfl_games: crosswalk_candidate_games
      })

      if (matched_game) {
        crosswalk.set(prizepicks_game_id, matched_game)
        newly_resolved.push({ prizepicks_game_id, esbid: matched_game.esbid })
      }
    }

    if (newly_resolved.length) {
      const stamped_count =
        await persist_prizepicks_game_crosswalk(newly_resolved)
      log(
        `stamped ${stamped_count} of ${newly_resolved.length} newly resolved prizepicks game ids`
      )
    }

    for (const item of data.data) {
      all_markets.push(item)

      const prizepicks_player = data.included.find(
        (d) =>
          d.type === 'new_player' &&
          d.id === item.relationships.new_player.data.id
      )

      if (!prizepicks_player) {
        // TODO log warning
        continue
      }

      const market = await format_market({
        prizepicks_market: item,
        prizepicks_player,
        observed_at,
        crosswalk_nfl_game: crosswalk.get(item.attributes?.game_id) || null,
        nfl_games
      })

      if (!market.market_type) {
        missing_market_types.add(item.attributes?.stat_type)
      }

      formatted_markets.push(market)
    }

    page += 1
  } while (!data || data.meta.current_page < data.meta.total_pages)

  if (write_file) {
    await fs.writeFile(
      `./tmp/prizepick-markets-${timestamp}.json`,
      JSON.stringify(all_markets, null, 2)
    )
  }

  if (missing_market_types.size > 0) {
    log('Stat types with missing market types:')
    missing_market_types.forEach((stat_type) => log(stat_type))
  }

  if (dry_run) {
    log(formatted_markets[0])
    console.timeEnd('import-prizepicks-odds')
    return
  }

  if (formatted_markets.length) {
    log(`Inserting ${formatted_markets.length} markets into database`)
    await insert_prop_markets(formatted_markets)
  }

  console.timeEnd('import-prizepicks-odds')
}

export const job = async () => {
  const argv = initialize_cli()
  let error
  try {
    await import_prizepicks_odds({
      dry_run: argv.dry,
      write_file: argv.write
    })
  } catch (err) {
    error = err
    log(error)
  }

  await report_job({
    job_type: job_types.PRIZEPICKS_PROJECTIONS,
    error
  })

  // Rethrow so the exit code matches the outcome -- reporting the error and
  // then returning normally made main() exit 0, writing a failed import to the
  // runs ledger as a success.
  if (error) throw error
}

const main = async () => {
  try {
    await job()
  } catch (err) {
    console.error(err)
    process.exit(1)
  }
  process.exit()
}

if (is_main(import.meta.url)) {
  main()
}

export default import_prizepicks_odds
