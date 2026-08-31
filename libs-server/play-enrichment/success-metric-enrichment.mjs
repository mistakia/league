import debug from 'debug'

import { is_successful_play } from '#libs-server/play-stats-utils.mjs'

const log = debug('play-enrichment:success-metric')

/**
 * Enriches plays with successful_play metric
 *
 * Calculates whether a play was "successful" based on down, distance, and yards gained.
 * Success criteria:
 * - 1st down: gain 40% of yards to go
 * - 2nd down: gain 60% of yards to go
 * - 3rd/4th down: gain 100% of yards to go (convert)
 *
 * Plays whose verdict cannot be computed come back with no `is_successful_play`
 * key at all rather than a null one, so a writer downstream leaves any stored
 * value alone.
 *
 * @param {object[]} plays - Array of play objects with yards_gained, yards_to_go, and down_number
 * @returns {object[]} Plays with is_successful_play set where computable, omitted where not
 */
export const enrich_play_success = (plays) => {
  let enriched_count = 0
  let skipped_count = 0

  const enriched_plays = plays.map((play) => {
    const successful_play = is_successful_play({
      yards_gained: play.yards_gained,
      yards_to_go: play.yards_to_go,
      down_number: play.down_number
    })

    // A null verdict means "no opinion" -- the play is missing down_number,
    // yards_to_go or yards_gained -- and must be expressed by OMITTING the key,
    // exactly as enrich_yardage_stats omits yards_gained it cannot compute.
    // Setting the key to null instead writes an authoritative null: upsert_plays
    // carries it into the merge, it overwrites a stored true/false that another
    // pass computed from richer inputs, and nfl_plays.updated advances past the
    // finalization watermark on every run. Measured 2026-08-31: 1,113 rows held
    // a stored yards_gained the importer payload lacked, and the identical 1,113
    // rows were computable-but-null here -- the last column still changing on an
    // otherwise-identical --final pass.
    //
    // Omitting is only safe because upsert_plays groups rows by column set
    // (group_rows_by_column_set). Before that, knex unioned a batch's keys into
    // one statement and filled DEFAULT for rows missing one, so an absent key
    // still wrote NULL and this design was wrong.
    if (successful_play === null) {
      skipped_count++
      return play
    }

    enriched_count++

    return {
      ...play,
      is_successful_play: successful_play
    }
  })

  log(
    `Success metric enrichment: ${enriched_count} enriched, ${skipped_count} skipped`
  )

  return enriched_plays
}
