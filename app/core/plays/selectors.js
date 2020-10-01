import { List } from 'immutable'
import { fixTeam } from '@common'

export function getPlays (state) {
  return state.get('plays')
}

export function getPlaysForPlayer (state, { player, week }) {
  const plays = getPlays(state)
  let formatted = plays.valueSeq().toList()

  if (week) {
    formatted = formatted.filter(p => p.week === week)
  }

  if (player.pos1 === 'DST') {
    return formatted
      .filter(p => {
        if (fixTeam(p.homeTeamAbbr) !== player.team &&
          fixTeam(p.awayTeamAbbr) !== player.team) {
          return false
        }
        const pos = p.possessionTeam
        return pos && fixTeam(pos) !== player.team
      })
  }

  let filtered = new List()
  for (const play of formatted.valueSeq()) {
    const pos = play.possessionTeam
    if (!pos || fixTeam(pos) !== player.team) continue

    const playStats = play.playStats.filter(ps => (ps.gsisId && ps.gsisId === player.gsisid) ||
      (ps.gsispid && ps.gsispid === player.gsispid))

    if (!playStats.length) continue

    filtered = filtered.push({
      ...play,
      playStats
    })
  }
  return filtered
}
