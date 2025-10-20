import debug from 'debug'

const log = debug('play-enrichment:team-assignment')

/**
 * Enriches plays with offensive and defensive team assignments
 *
 * Calculates which team has possession (off) and which team is defending (def)
 * based on the play's pos_team and the game's home/visitor teams.
 *
 * @param {Array} plays - Array of play objects with esbid and pos_team
 * @param {Map|Object} games_map - Map or object of game data keyed by esbid with h (home) and v (visitor) properties
 * @returns {Array} Plays with off and def fields populated
 */
export const enrich_team_assignments = (plays, games_map) => {
  let enriched_count = 0
  let skipped_count = 0

  const enriched_plays = plays.map((play) => {
    // Skip plays without pos_team (likely timeout or two minute warning)
    if (!play.pos_team || !play.esbid) {
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

    if (!game.h || !game.v) {
      log(`Invalid game data for esbid: ${play.esbid} - missing h or v`)
      skipped_count++
      return play
    }

    // Calculate team assignments
    const off = play.pos_team
    const def = off === game.h ? game.v : game.h

    enriched_count++

    return {
      ...play,
      off,
      def
    }
  })

  log(
    `Team assignment enrichment: ${enriched_count} enriched, ${skipped_count} skipped`
  )

  return enriched_plays
}
