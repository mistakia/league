import { roster_slot_types, player_tag_types } from '#constants'

const getFranchiseAmount = ({ pos, league }) => {
  switch (pos) {
    case 'QB':
      return league.franchise_tag_salary_qb || 0

    case 'RB':
      return league.franchise_tag_salary_rb || 0

    case 'WR':
      return league.franchise_tag_salary_wr || 0

    case 'TE':
      return league.franchise_tag_salary_te || 0

    // A position with no franchise amount prices at $0, matching what each branch
    // above already does for an unconfigured league. Falling out of the switch
    // returned `undefined`, which reaches the cap arithmetic as NaN rather than as
    // a wrong-but-visible number.
    default:
      return 0
  }
}

export default function ({ extensions, tag, pos, league, value, bid, slot }) {
  if (
    slot &&
    (slot === roster_slot_types.PS ||
      slot === roster_slot_types.PSP ||
      slot === roster_slot_types.PSD ||
      slot === roster_slot_types.PSDP)
  ) {
    return value
  }

  switch (tag) {
    case player_tag_types.FRANCHISE:
      return getFranchiseAmount({ pos, league })

    case player_tag_types.ROOKIE:
      return value

    case player_tag_types.RESTRICTED_FREE_AGENCY:
      // `??`, not `||` — a $0 bid is a real bid, and coalescing on falsiness
      // prices the player at their prior salary instead of the committed $0.
      return bid ?? value

    case player_tag_types.REGULAR:
    default:
      return value + (extensions + 1) * 5
  }
}
