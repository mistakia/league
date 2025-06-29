import * as constants from './constants.mjs'

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
    (slot === constants.slots.PS ||
      slot === constants.slots.PSP ||
      slot === constants.slots.PSD ||
      slot === constants.slots.PSDP)
  ) {
    return value
  }

  switch (tag) {
    case constants.tags.FRANCHISE:
      return getFranchiseAmount({ pos, league })

    case constants.tags.ROOKIE:
      return value

    case constants.tags.RESTRICTED_FREE_AGENCY:
      return bid || value

    case constants.tags.REGULAR:
    default:
      return value + (extensions + 1) * 5
  }
}
