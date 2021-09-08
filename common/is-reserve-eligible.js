export default function isReserveEligible(player) {
  return (
    (player.status && player.status !== 'Active') ||
    player.injury_status === 'PUP' ||
    player.injury_status === 'IR'
  )
}
