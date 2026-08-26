import debug from 'debug'

const log = debug('play-enrichment:team-assignment')

/**
 * Enriches plays with offensive and defensive team assignments
 *
 * Calculates which team has possession (offense_nfl_team) and which team is
 * defending (defense_nfl_team) based on the play's possession_nfl_team and the
 * game's home/visitor teams.
 *
 * @param {object[]} plays - Array of play objects with esbid and possession_nfl_team
 * @param {Map<number, object>|object} games_map - Map or object of game data keyed by esbid with home_nfl_team and away_nfl_team properties
 * @returns {object[]} Plays with offense_nfl_team and defense_nfl_team fields populated
 */
export const enrich_team_assignments = (plays, games_map) => {
  let enriched_count = 0
  let skipped_count = 0

  const enriched_plays = plays.map((play) => {
    // Skip plays without possession_nfl_team (likely timeout or two minute warning)
    if (!play.possession_nfl_team || !play.esbid) {
      skipped_count++
      return play
    }

    // Get game data from map
    const game =
      games_map instanceof Map
        ? games_map.get(play.esbid)
        : games_map[play.esbid]

    if (!game) {
      log(`No game data found for esbid: ${play.esbid}`)
      skipped_count++
      return play
    }

    // These read the PHYSICAL nfl_games column names. They were `h` and `v`
    // until 8619abb2b (2026-07-29) renamed the team roles, and this module was
    // missed by that sweep -- no spec executes it, so nothing went red. The
    // failure was silent by construction: an undefined property is falsy, so
    // every play took the skip branch below, logged one debug line on a cron
    // job nobody reads, and returned unchanged with offense_nfl_team NULL. All
    // 6,027 plays of the 2026 preseason landed that way, which is what starved
    // generate-player-snaps of the team totals it keys on.
    if (!game.home_nfl_team || !game.away_nfl_team) {
      log(
        `Invalid game data for esbid: ${play.esbid} - missing home_nfl_team or away_nfl_team`
      )
      skipped_count++
      return play
    }

    // Calculate team assignments
    const offense_nfl_team = play.possession_nfl_team
    const defense_nfl_team =
      offense_nfl_team === game.home_nfl_team
        ? game.away_nfl_team
        : game.home_nfl_team

    enriched_count++

    return {
      ...play,
      offense_nfl_team,
      defense_nfl_team
    }
  })

  log(
    `Team assignment enrichment: ${enriched_count} enriched, ${skipped_count} skipped`
  )

  return enriched_plays
}
