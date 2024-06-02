import * as constants from './constants.mjs'

export default function isReserveEligible({ nfl_status, injury_status } = {}) {
  return (
    (nfl_status && nfl_status !== constants.player_nfl_status.ACTIVE) ||
    injury_status === constants.player_nfl_injury_status.OUT ||
    injury_status === constants.player_nfl_injury_status.DOUBTFUL ||
    (injury_status && constants.season.week === 0)
  )
}
