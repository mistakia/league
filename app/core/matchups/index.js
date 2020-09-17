export {
  getMatchups,
  getFilteredMatchups,
  getSelectedMatchup,
  getMatchupsForSelectedWeek,
  getMatchupById,
  getSelectedMatchupHomeTeam,
  getSelectedMatchupAwayTeam
} from './selectors'
export { matchupsReducer } from './reducer'
export { matchupSagas } from './sagas'
export { matchupsActions, getMatchupsActions, postMatchupsActions } from './actions'
