import { constants } from '@common'
import { getPlayerById } from '@core/players'

export function getSchedule(state) {
  return state.get('schedule')
}

export function getGameByPlayerId(state, { pid, week }) {
  const playerMap = getPlayerById(state, { pid })
  return getGameByTeam(state, { nfl_team: playerMap.get('team'), week })
}

export function getByeByTeam(state, { nfl_team }) {
  return state.getIn(['schedule', 'teams', nfl_team, 'bye'])
}

const currentWeek = Math.max(constants.week, 1)
export function getGameByTeam(state, { nfl_team, week = currentWeek }) {
  const team = state.getIn(['schedule', 'teams', nfl_team])
  if (!team) {
    return null
  }

  return team.games.find((g) => g.week === week)
}

export function getGamesByTeam(state, { nfl_team }) {
  const team = state.getIn(['schedule', 'teams', nfl_team])
  if (!team) {
    return []
  }

  return team.games
}
