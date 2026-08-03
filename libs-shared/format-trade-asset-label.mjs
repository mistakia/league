// One spelling of a traded asset's display label, shared by the grade-trades
// CLI and the trade review page so the two cannot drift. The engine returns
// structured identity; formatting is the caller's job, and this is the default.
//
// Note pick_draft_overall_position is the position across the WHOLE draft, not
// the slot within its round -- round 2 of a 2026 league 1 draft runs 11 through
// 20 -- so it is rendered as an overall pick number rather than a "1.05" slot,
// which would need the round size this record does not carry.
const format_trade_asset_label = ({
  player_id,
  pick_year,
  pick_round,
  pick_draft_overall_position
}) => {
  if (player_id) return player_id
  if (!pick_year) return 'unknown asset'
  const pick = `${pick_year} round ${pick_round} pick`
  return pick_draft_overall_position
    ? `${pick} (#${pick_draft_overall_position} overall)`
    : pick
}

export default format_trade_asset_label
