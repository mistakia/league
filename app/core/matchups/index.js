export {
  getMatchups,
  getFilteredMatchups,
  getSelectedMatchup,
  getMatchupsForSelectedWeek,
  getMatchupById,
  getSelectedMatchupTeams,
  getWeeksForSelectedYearMatchups,
  getMatchupByTeamId
} from './selectors'
export { matchupsReducer } from './reducer'
export { matchupSagas } from './sagas'
export {
  matchupsActions,
  getMatchupsActions,
  postMatchupsActions
} from './actions'
export { Matchup, createMatchup } from './matchup'
