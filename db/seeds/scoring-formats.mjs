import {
  DEFAULT_SCORING_FORMAT_HASH,
  generate_scoring_format_hash
} from '#libs-shared'

export default async function (knex) {
  // Ensure the default scoring format exists
  // This is needed for tests that use the default scoring format hash
  const default_scoring_format = generate_scoring_format_hash({
    pa: 0, // passing attempts
    pc: 0, // passing completions
    py: 0.04, // passing yards (points per yard)
    ints: -1, // interceptions (-1 point, less punitive)
    tdp: 4, // passing touchdowns
    ra: 0, // rushing attempts
    ry: 0.1, // rushing yards
    tdr: 6, // rushing touchdowns
    rec: 1, // receptions (full PPR)
    rbrec: 1, // RB receptions
    wrrec: 1, // WR receptions
    terec: 1, // TE receptions
    recy: 0.1, // receiving yards
    tdrec: 6, // receiving touchdowns
    twoptc: 2, // two-point conversions
    fuml: -1, // fumbles lost (-1 point, less punitive)
    prtd: 6, // punt return touchdowns
    krtd: 6, // kick return touchdowns
    trg: 0, // targets (no points in standard)
    rush_first_down: 0, // rushing first downs
    rec_first_down: 0, // receiving first downs
    exclude_qb_kneels: false
  })

  // Verify the hash matches the expected default
  if (
    default_scoring_format.scoring_format_hash !== DEFAULT_SCORING_FORMAT_HASH
  ) {
    throw new Error(
      `Generated scoring format hash does not match DEFAULT_SCORING_FORMAT_HASH. Expected ${DEFAULT_SCORING_FORMAT_HASH}, got ${default_scoring_format.scoring_format_hash}`
    )
  }

  // Insert the default scoring format, ignoring if it already exists
  await knex('league_scoring_formats')
    .insert(default_scoring_format)
    .onConflict('scoring_format_hash')
    .ignore()
}
