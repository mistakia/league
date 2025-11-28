import { roster_slot_types, player_tag_types } from '#constants'

const getFranchiseAmount = ({ pos, league }) => {
  switch (pos) {
    case 'QB':
      return league.fqb || 0

    case 'RB':
      return league.frb || 0

    case 'WR':
      return league.fwr || 0

    case 'TE':
      return league.fte || 0
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
      return bid || value

    case player_tag_types.REGULAR:
    default:
      return value + (extensions + 1) * 5
  }
}
