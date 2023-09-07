import * as constants from './constants.mjs'

export default function isReserveEligible({ status, injury_status } = {}) {
  return (
    (status && status !== 'Active') ||
    injury_status === 'PUP' ||
    injury_status === 'IR' ||
    injury_status === 'Doubtful' ||
    injury_status === 'Sus' ||
    injury_status === 'Out' ||
    (injury_status && constants.season.week === 0)
  )
}
