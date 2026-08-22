import {
  scrimmage_play_types,
  stat_countable_play_types,
  non_nullified_play_types
} from '#libs-shared/constants/play-type-constants.mjs'

const play_type_sets = {
  scrimmage: scrimmage_play_types,
  stat_countable: stat_countable_play_types,
  non_nullified: non_nullified_play_types
}

/**
 * Apply a named play-type predicate to a knex query.
 *
 * The set names are the ones in libs-shared/constants/play-type-constants.mjs,
 * which is also where the ruling on each of them lives. Read it before picking
 * one -- the three are not interchangeable, and the failure mode of choosing
 * wrong is silent (a zeroed kicker, or a rate denominator inflated with the
 * special-teams population).
 *
 * An unknown set name throws rather than filtering nothing, because a
 * predicate that quietly matches everything reads exactly like a clean result.
 *
 * @param {object} args
 * @param {object} args.query - knex query builder
 * @param {string} args.play_type_set - 'scrimmage' | 'stat_countable' | 'non_nullified'
 * @param {string} [args.table_name] - table to qualify the column with
 * @returns {object} the same query builder, for chaining
 */
export const apply_play_type_filter = ({
  query,
  play_type_set,
  table_name = 'nfl_plays'
}) => {
  const play_types = play_type_sets[play_type_set]
  if (!play_types) {
    throw new Error(
      `apply_play_type_filter: unknown play_type_set '${play_type_set}' (expected one of ${Object.keys(play_type_sets).join(', ')})`
    )
  }

  return query.whereIn(`${table_name}.play_type`, play_types)
}
