import * as constants from './constants'

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

export default function ({ extensions, tag, pos, league, value, bid }) {
  switch (tag) {
    case constants.tags.FRANCHISE:
      return getFranchiseAmount({ pos, league })

    case constants.tags.ROOKIE:
      return value

    case constants.tags.TRANSITION:
      return bid

    case constants.tags.REGULAR:
    default:
      return value + (extensions + 1) * 5
  }
}
