import { getStartersByTeamId } from '@core/rosters'
import { constants } from '@common'

export function getProjectedScoreByTeamId (state, { tid }) {
  const starters = getStartersByTeamId(state, { tid })
  return starters.reduce((sum, s) => {
    const pts = s.getIn(['points', `${constants.season.week}`, 'total'], 0)
    return pts + sum
  }, 0)
}
