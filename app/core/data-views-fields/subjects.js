// Subject compatibility for each per-file fields group. Mirrors the
// server-side source.grain -> subject inference (libs-server/data-views/
// derive-column-subjects.mjs). Authored per file rather than per field --
// every file's contents have a uniform grain today, and file-of-origin is
// the most stable axis for subject membership.

export const PLAYER_SUBJECT = ['player']
export const TEAM_SUBJECT = ['team']

// Returns a new fields object with each entry shallow-cloned and tagged
// with the given `subjects` array. Pure: does not mutate the source.
export const with_subjects = (fields_obj, subjects) => {
  const out = {}
  for (const [key, value] of Object.entries(fields_obj)) {
    out[key] = { ...value, subjects }
  }
  return out
}

// Mixed-grain files (espn-line-win-rates carries both player_espn_* and
// team_espn_* columns). Derives subject from the column_id prefix.
export const with_subjects_by_prefix = (fields_obj) => {
  const out = {}
  for (const [key, value] of Object.entries(fields_obj)) {
    let subjects
    if (key.startsWith('player_')) subjects = PLAYER_SUBJECT
    else if (key.startsWith('team_')) subjects = TEAM_SUBJECT
    else
      throw new Error(
        `with_subjects_by_prefix: column_id '${key}' does not start with 'player_' or 'team_'`
      )
    out[key] = { ...value, subjects }
  }
  return out
}

export const derive_column_subjects = (def) => {
  if (Array.isArray(def?.subjects) && def.subjects.length) return def.subjects
  return []
}
