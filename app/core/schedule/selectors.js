import { constants } from '@common'

export function getSchedule (state) {
  return state.get('schedule')
}

export function getByeByTeam (state, { team }) {
  return state.getIn(['schedule', 'teams', team, 'bye'])
}

export function getGameForWeekByTeam (state, { team }) {
  const nflTeam = state.getIn(['schedule', 'teams', team])
  if (!nflTeam) {
    return null
  }

  return nflTeam.games.find(g => g.wk === constants.season.week)
}
