import { getTeamById } from '@core/teams'
import { constants } from '@common'
import { getPointsByTeamId } from '@core/scoreboard'
import { createMatchup } from './matchup'

export function getMatchups(state) {
  return state.get('matchups')
}

export function getWeeksForSelectedYearMatchups(state) {
  const matchups = getMatchupsForSelectedYear(state)
  const weeks = matchups.map((m) => m.week)
  const playoffs = getMatchups(state)
    .get('playoffs')
    .map((m) => m.week)
  return [...new Set([...weeks, ...playoffs])]
}

export function getMatchupById(state, { mid }) {
  const matchups = state.get('matchups')
  const items = matchups.get('items')
  return items.find((m) => m.uid === mid)
}

export function getFilteredMatchups(state) {
  const matchups = state.get('matchups')
  const items = matchups.get('items')
  const teams = matchups.get('teams')
  const weeks = matchups.get('weeks')
  const filtered = items.filter(
    (m) => teams.includes(m.aid) || teams.includes(m.hid)
  )
  return filtered.filter((m) => weeks.includes(m.week))
}

export function getSelectedMatchup(state) {
  const matchups = state.get('matchups')
  const matchupId = matchups.get('selected')
  if (!matchupId) return createMatchup()

  // TODO - fix / derive based on season schedule
  const year = state.getIn(['app', 'year'], constants.year)
  const week = state.getIn(['scoreboard', 'week'])
  if (week <= constants.season.regularSeasonFinalWeek) {
    const items = matchups.get('items')
    return items.find((m) => m.uid === matchupId) || createMatchup()
  } else {
    const items = matchups.get('playoffs')
    return (
      items.find((m) => m.uid === matchupId && m.year === year) ||
      createMatchup()
    )
  }
}

export function getSelectedMatchupTeams(state) {
  const matchup = getSelectedMatchup(state)
  const teams = matchup.tids.map((tid) => getTeamById(state, { tid }))
  if (matchup.week === constants.season.finalWeek) {
    const prevWeek = constants.season.finalWeek - 1
    return teams.map((teamRecord) => {
      const previousWeekScore = getPointsByTeamId(state, {
        tid: teamRecord.uid,
        week: prevWeek
      })
      return { previousWeekScore, ...teamRecord.toJS() }
    })
  }
  return teams
}

export function getMatchupsForSelectedWeek(state) {
  const matchups = state.getIn(['matchups', 'items'])
  const week = state.getIn(['scoreboard', 'week'])
  return matchups.filter((m) => m.week === week)
}

export function getMatchupsForSelectedYear(state) {
  const matchups = state.getIn(['matchups', 'items'])
  const year = state.getIn(['app', 'year'], constants.year)
  return matchups.filter((m) => m.year === year)
}

export function getMatchupByTeamId(state, { tid, year, week }) {
  const matchups = state.getIn(['matchups', 'items'])
  return (
    matchups.find(
      (m) =>
        m.year === year && m.week === week && (m.hid === tid || m.aid === tid)
    ) || createMatchup()
  )
}
