import { player_nfl_status } from './constants.mjs'

export default function isReserveCovEligible({ nfl_status } = {}) {
  return nfl_status === player_nfl_status.RESERVE_COVID_19
}
