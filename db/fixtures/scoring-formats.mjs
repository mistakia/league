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
      pa: 0,
      pc: 0,
      py: 0.04,
      ints: -1,
      tdp: 4,
      ra: 0,
      ry: 0.1,
      tdr: 6,
      rec: 1,
      rbrec: 1,
      wrrec: 1,
      terec: 1,
      recy: 0.1,
      tdrec: 6,
      twoptc: 2,
      fuml: -1,
      prtd: 6,
      krtd: 6,
      fum_ret_td: 6,
      trg: 0,
      rush_first_down: 0,
      rec_first_down: 0,
      exclude_qb_kneels: false
    })
    .onConflict('id')
    .ignore()
}
