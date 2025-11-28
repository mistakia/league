import { player_nfl_status } from '#constants'

export default function isReserveCovEligible({ nfl_status } = {}) {
  return nfl_status === player_nfl_status.INJURED_RESERVE_COVID
}
