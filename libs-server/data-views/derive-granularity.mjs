// granularity is the array of identity ids a column declares itself
// compatible with. It is declarative-only today (no runtime consumer reads
// it; the column-coverage spec validates it). Authoring rule:
//
//   1. If the column-def sets `granularity` explicitly, honor it. Use this
//      when the column attaches to a tighter or wider set than its source
//      descriptor's grain implies (e.g. player_season_* views of a
//      player_year_week source).
//   2. Otherwise fall back to `[source.grain]`. The four observed source
//      grains (player, player_year, team, team_year) are themselves valid
//      identity ids, so this fall-through is correct by construction.
//
// Returns [] when neither is set -- the spec treats that as a missing
// declaration.

export default function derive_granularity(def) {
  if (Array.isArray(def?.granularity) && def.granularity.length) {
    return def.granularity
  }
  const grain = def?.source?.grain
  return grain ? [grain] : []
}
