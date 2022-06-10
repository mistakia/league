import { List, Map } from 'immutable'
import { fixTeam } from '@common'

export function getPlays(state, { week }) {
  return state.getIn(['plays', week], new Map())
}

export function getPlaysForPlayer(state, { playerMap, week }) {
  const plays = getPlays(state, { week })
  const formatted = plays.valueSeq().toList()

  const playerTeam = playerMap.get('team')
  if (playerMap.get('pos') === 'DST') {
    return formatted.filter((p) => {
      if (fixTeam(p.h) !== playerTeam && fixTeam(p.v) !== playerTeam) {
        return false
      }

      return (
        (Boolean(p.pos_team) &&
          fixTeam(p.pos_team) !== playerMap.get('player')) ||
        p.type_nfl === 'PUNT' ||
        p.type_nfl === 'KICK_OFF' ||
        p.type_nfl === 'XP_KICK'
      )
    })
  }

  let filtered = new List()
  for (const play of formatted.valueSeq()) {
    const pos = play.pos_team
    if (
      !pos ||
      (fixTeam(pos) !== playerTeam &&
        play.type_nfl !== 'PUNT' &&
        play.type_nfl !== 'KICK_OFF' &&
        play.type_nfl !== 'XP_KICK')
    )
      continue

    const playStats = play.playStats.filter(
      (ps) =>
        (ps.gsisId && ps.gsisId === playerMap.get('gsisid')) ||
        (ps.gsispid && ps.gsispid === playerMap.get('gsispid'))
    )

    if (!playStats.length) continue

    filtered = filtered.push({
      ...play,
      playStats
    })
  }
  return filtered
}
