import { DEFAULT_SCORING_FORMAT_ID } from '#libs-shared'

// Ensure the default scoring format row exists for every test run.
// Identity is now opaque (slug); the row is upserted by id. The config values
// here must match the catalog entry for DEFAULT_SCORING_FORMAT_ID in
// libs-shared/league-format-definitions.mjs (currently the 'draftkings' /
// 'ppr_lower_turnover' shared config -- both source keys collapse to id
// 'draftkings' under the alphabetical-first canonical rule).
export default async function (knex) {
  await knex('league_scoring_formats')
    .insert({
      id: DEFAULT_SCORING_FORMAT_ID,
      passing_attempts: 0,
      passing_completions: 0,
      passing_yards: 0.04,
      passing_interceptions: -1,
      passing_touchdowns: 4,
      rushing_attempts: 0,
      rushing_yards: 0.1,
      rushing_touchdowns: 6,
      receptions: 1,
      running_back_reception: 1,
      wide_receiver_reception: 1,
      tight_end_reception: 1,
      receiving_yards: 0.1,
      receiving_touchdowns: 6,
      two_point_conversions: 2,
      fumbles_lost: -1,
      punt_return_touchdowns: 6,
      kickoff_return_touchdowns: 6,
      fumble_return_touchdowns: 6,
      targets: 0,
      rushing_first_downs: 0,
      receiving_first_downs: 0,
      exclude_quarterback_kneels: false
    })
    .onConflict('id')
    .ignore()

  // A TE-premium (non-uniform reception) format so tests can exercise the
  // position CASE in the projected-points in-query scorer (terec != rec). Config
  // mirrors the sfb15_mfl entry in libs-shared/league-format-definitions.mjs.
  await knex('league_scoring_formats')
    .insert({
      id: 'sfb15_mfl',
      passing_attempts: 0,
      passing_completions: 0,
      passing_yards: 0.04,
      passing_interceptions: 0,
      passing_touchdowns: 6,
      rushing_attempts: 0.5,
      rushing_yards: 0.1,
      rushing_touchdowns: 6,
      receptions: 1,
      running_back_reception: 1,
      wide_receiver_reception: 1,
      tight_end_reception: 2,
      receiving_yards: 0.1,
      receiving_touchdowns: 6,
      two_point_conversions: 2,
      fumbles_lost: 0,
      punt_return_touchdowns: 6,
      kickoff_return_touchdowns: 6,
      fumble_return_touchdowns: 6,
      targets: 1,
      rushing_first_downs: 1,
      receiving_first_downs: 1,
      exclude_quarterback_kneels: false
    })
    .onConflict('id')
    .ignore()
}
