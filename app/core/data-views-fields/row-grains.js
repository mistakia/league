// Row-grain compatibility for each per-file fields group. Mirrors the
// server-side source.grain -> row_grain inference (libs-server/data-views/
// derive-column-row-grains.mjs). Authored per file rather than per field --
// every file's contents have a uniform grain today, and file-of-origin is
// the most stable axis for row-grain membership.

export const PLAYER_ROW_GRAINS = ['player']
// Team columns are dual-grain: every player has a team, so a team-level
// value resolves cleanly under player row_grain (repeated across each
// player on that team). The reverse is not true -- player columns under
// team grain require aggregation and stay single-grain.
export const TEAM_ROW_GRAINS = ['player', 'team']

// Returns a new fields object with each entry shallow-cloned and tagged
// with the given `row_grains` array. Pure: does not mutate the source.
export const with_row_grains = (fields_obj, row_grains) => {
  const out = {}
  for (const [key, value] of Object.entries(fields_obj)) {
    out[key] = { ...value, row_grains }
  }
  return out
}

// Mixed-grain files (espn-line-win-rates carries both player_espn_* and
// team_espn_* columns). Derives row_grain from the column_id prefix.
export const with_row_grains_by_prefix = (fields_obj) => {
  const out = {}
  for (const [key, value] of Object.entries(fields_obj)) {
    let row_grains
    if (key.startsWith('player_')) row_grains = PLAYER_ROW_GRAINS
    else if (key.startsWith('team_')) row_grains = TEAM_ROW_GRAINS
    else
      throw new Error(
        `with_row_grains_by_prefix: column_id '${key}' does not start with 'player_' or 'team_'`
      )
    out[key] = { ...value, row_grains }
  }
  return out
}

export const derive_column_row_grains = (def) => {
  if (Array.isArray(def?.row_grains) && def.row_grains.length)
    return def.row_grains
  return []
}
