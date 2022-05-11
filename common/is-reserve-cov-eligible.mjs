export default function isReserveCovEligible(player) {
  return player.status === 'Reserve/COVID-19' || player.injury_status === 'COV'
}
