import optimizeLineup from './optimize-lineup'

export default function ({
  activeRosterPlayers = [],
  player,
  players,
  baselines,
  roster,
  league
}) {
  const playerData = {
    starts: 0,
    sp: 0,
    bp: 0,
    weeks: {}
  }

  // run lineup optimizer without player
  const isActive = activeRosterPlayers.find((p) => p.player === player.player)
  const playerPool = isActive
    ? activeRosterPlayers.filter((p) => p.player !== player.player)
    : activeRosterPlayers.concat([player])
  const result = optimizeLineup({
    players: playerPool,
    league
  })

  for (const week in result) {
    const weekData = {
      start: 0,
      sp: 0,
      bp: 0
    }

    const projectedPoints = player.points[week] ? player.points[week].total : 0
    if (!projectedPoints) {
      playerData.weeks[week] = weekData
      continue
    }

    const currentProjectedWeek = roster.lineups[week]
    const isStarter = isActive
      ? currentProjectedWeek.starters.includes(player.player)
      : result[week].starters.includes(player.player)

    if (isStarter) {
      playerData.starts += 1
      weekData.start = 1
      // starter+ is difference between current lineup and lineup without player
      const diff = isActive
        ? currentProjectedWeek.total - result[week].total
        : result[week].total - currentProjectedWeek.total
      playerData.sp += diff
      weekData.sp = diff
    } else {
      const baselinePlayerId = baselines[week][player.pos].available
      const baselinePlayer = players.find((p) => p.player === baselinePlayerId)
      // bench+ is difference between player output and best available
      const diff =
        projectedPoints -
        (baselinePlayer.points[week] ? baselinePlayer.points[week].total : 0)
      if (diff > 0) {
        playerData.bp += diff
        weekData.bp = diff
      }
    }
    playerData.weeks[week] = weekData
  }

  return playerData
}
