import { player_nfl_status } from '#constants'

export default function isReserveCovEligible({ roster_status } = {}) {
  return roster_status === player_nfl_status.INJURED_RESERVE_COVID
}
