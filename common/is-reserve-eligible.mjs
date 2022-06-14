export default function isReserveEligible({ status, injury_status } = {}) {
  return (
    (status && status !== 'Active') ||
    injury_status === 'PUP' ||
    injury_status === 'IR' ||
    injury_status === 'Doubtful'
  )
}
