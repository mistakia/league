import { List, Map } from 'immutable'
import { fixTeam } from '@common'

export function getPlays(state, { week }) {
  return state.getIn(['plays', week], new Map())
}

export function getPlaysForPlayer(state, { player, week }) {
  const plays = getPlays(state, { week })
  const formatted = plays.valueSeq().toList()

  if (player.pos === 'DST') {
    return formatted.filter((p) => {
      if (fixTeam(p.h) !== player.team && fixTeam(p.v) !== player.team) {
        return false
      }

      return (
        (Boolean(p.possessionTeam) &&
          fixTeam(p.possessionTeam) !== player.player) ||
        p.type_nfl === 'PUNT' ||
        p.type_nfl === 'KICK_OFF' ||
        p.type_nfl === 'XP_KICK'
      )
    })
  }

  let filtered = new List()
  for (const play of formatted.valueSeq()) {
    const pos = play.possessionTeam
    if (!pos || fixTeam(pos) !== player.team) continue

    const playStats = play.playStats.filter(
      (ps) =>
        (ps.gsisId && ps.gsisId === player.gsisid) ||
        (ps.gsispid && ps.gsispid === player.gsispid)
    )

    if (!playStats.length) continue

    filtered = filtered.push({
      ...play,
      playStats
    })
  }
  return filtered
}
