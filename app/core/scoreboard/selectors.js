import { getStartersByTeamId } from '@core/rosters'
import { constants } from '@common'

export function getScoreboard (state) {
  return state.get('scoreboard')
}

export function getProjectedScoreByTeamId (state, { tid }) {
  const starters = getStartersByTeamId(state, { tid })
  return starters.reduce((sum, s) => {
    const pts = s.getIn(['points', `${constants.season.week}`, 'total'], 0)
    return pts + sum
  }, 0)
}

export function getScoreboardUpdated (state) {
  const scoreboard = getScoreboard(state)
  const plays = scoreboard.get('plays')
  const play = plays.minBy(x => x.updated)
  return play ? play.updated : 0
}
