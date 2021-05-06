import { constants } from '@common'
import { getPlayerById } from '@core/players'

export function getSchedule(state) {
  return state.get('schedule')
}

export function getGameByPlayerId(state, { playerId, week }) {
  const player = getPlayerById(state, { playerId })
  return getGameByTeam(state, { team: player.team, week })
}

export function getByeByTeam(state, { team }) {
  return state.getIn(['schedule', 'teams', team, 'bye'])
}

export function getGameByTeam(state, { team, week = constants.season.week }) {
  const nflTeam = state.getIn(['schedule', 'teams', team])
  if (!nflTeam) {
    return null
  }

  return nflTeam.games.find((g) => g.wk === week)
}
