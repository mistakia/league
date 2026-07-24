// team_unit ('off'/'def') is stable data-view row-axis vocabulary -- the
// param value itself is never renamed. This maps it to the renamed physical
// nfl_plays column for the raw `nfl_plays.${team_unit}`-style SQL
// interpolation sites scattered across the play-by-play query engine.
export const TEAM_UNIT_COLUMN = {
  off: 'offense_nfl_team',
  def: 'defense_nfl_team'
}
