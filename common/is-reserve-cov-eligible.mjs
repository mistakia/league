export default function isReserveCovEligible({ status, injury_status } = {}) {
  return status === 'Reserve/COVID-19' || injury_status === 'COV'
}
