import db from '#db'

// Pinnacle encodes the whole market in source_market_id:
//
//   <event_id>/s;<period>;tt;<line>;<home|away>
//
// There is no team column and source_market_name is literally
// "description: undefined" on these rows, so this string IS the only place the
// side and the line live.
//
// Period 0 is the FULL GAME. Periods 1 and 3 are the first half and a quarter,
// and their lines (3.5, 9.5, 12.5) look enough like a plausible team total that
// reading them as one is silent and wrong -- a 3.5 "team total" would score as a
// shutout. Anchoring on period 0 is the load-bearing part of this parser.
const GAME_TEAM_TOTAL_PATTERN = /\/s;(\d+);tt;([\d.]+);(home|away)$/

export const parse_game_team_total_market_id = (source_market_id) => {
  const match = GAME_TEAM_TOTAL_PATTERN.exec(source_market_id || '')
  if (!match) return null
  if (match[1] !== '0') return null
  return { line: Number(match[2]), side: match[3] }
}

// Returns { [esbid]: { [nfl_team]: implied_total } } for the requested games.
//
// Books are averaged. CLOSE is preferred over OPEN where both exist, since the
// closing line is the sharper forecast, but OPEN is kept for games that have not
// closed yet -- which is every upcoming game, and therefore the only case that
// matters for a forward projection.
export const get_game_team_implied_totals = async ({
  season_year,
  season_type = 'REG',
  esbids
}) => {
  const games_query = db('nfl_games').select(
    'esbid',
    'week',
    'home_nfl_team',
    'away_nfl_team'
  )
  if (esbids) {
    games_query.whereIn('esbid', esbids)
  } else {
    games_query
      .where('season_year', season_year)
      .where('season_type', season_type)
  }
  const games = await games_query
  if (!games.length) return {}

  const markets = await db('prop_markets_index')
    .where('market_type', 'GAME_TEAM_TOTAL')
    .whereIn(
      'esbid',
      games.map((game) => game.esbid)
    )
    .select('esbid', 'source_market_id', 'source_id', 'time_type')

  const lines_by_key = {}
  for (const market of markets) {
    const parsed = parse_game_team_total_market_id(market.source_market_id)
    if (!parsed) continue
    const key = `${market.esbid}:${parsed.side}`
    if (!lines_by_key[key]) lines_by_key[key] = { CLOSE: [], OPEN: [] }
    const bucket = lines_by_key[key][market.time_type]
    if (bucket) bucket.push(parsed.line)
  }

  const resolve = (key) => {
    const entry = lines_by_key[key]
    if (!entry) return null
    const lines = entry.CLOSE.length ? entry.CLOSE : entry.OPEN
    if (!lines.length) return null
    return lines.reduce((sum, value) => sum + value, 0) / lines.length
  }

  const result = {}
  for (const game of games) {
    const home = resolve(`${game.esbid}:home`)
    const away = resolve(`${game.esbid}:away`)
    if (home === null && away === null) continue
    result[game.esbid] = { week: game.week }
    if (home !== null) result[game.esbid][game.home_nfl_team] = home
    if (away !== null) result[game.esbid][game.away_nfl_team] = away
  }

  return result
}

export default get_game_team_implied_totals
