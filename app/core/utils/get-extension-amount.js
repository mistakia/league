import { constants } from '@common'

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

export const getExtensionAmount = ({ extensions, tag, pos, league, value }) => {
  switch (tag) {
    case constants.tags.FRANCHISE:
      return getFranchiseAmount({ pos, league })

    case constants.tags.ROOKIE:
      return value

    case constants.tags.TRANSITION:
      return value

    case constants.tags.REGULAR:
    default:
      return value + (extensions + 1) * 5
  }
}
