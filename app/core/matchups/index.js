export {
  getMatchups,
  getFilteredMatchups,
  getSelectedMatchup,
  getMatchupsForSelectedWeek,
  getMatchupById,
  getSelectedMatchupTeams
} from './selectors'
export { matchupsReducer } from './reducer'
export { matchupSagas } from './sagas'
export { matchupsActions, getMatchupsActions, postMatchupsActions } from './actions'
export { Matchup, createMatchup } from './matchup'
