import { constants } from '@common'
import { getPlayerById } from '@core/players'

export function getSchedule(state) {
  return state.get('schedule')
}

export function getGameByPlayerId(state, { pid, week }) {
  const playerMap = getPlayerById(state, { pid })
  return getGameByTeam(state, { team: playerMap.get('team'), week })
}

export function getByeByTeam(state, { team }) {
  return state.getIn(['schedule', 'teams', team, 'bye'])
}

const currentWeek = Math.max(constants.season.week, 1)
export function getGameByTeam(state, { team, week = currentWeek }) {
  const nflTeam = state.getIn(['schedule', 'teams', team])
  if (!nflTeam) {
    return null
  }

  return nflTeam.games.find((g) => g.wk === week)
}

export function getGamesByTeam(state, { team }) {
  const nflTeam = state.getIn(['schedule', 'teams', team])
  if (!nflTeam) {
    return []
  }

  return nflTeam.games
}
