export {
  getMatchups,
  getFilteredMatchups,
  getSelectedMatchup,
  getMatchupsForCurrentWeek,
  getMatchupById
} from './selectors'
export { matchupsReducer } from './reducer'
export { matchupSagas } from './sagas'
export { matchupsActions, getMatchupsActions, postMatchupsActions } from './actions'
