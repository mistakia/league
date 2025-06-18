import { actions_utils } from '@core/utils'
import { constants } from '@libs-shared'
const { 
  create_api_actions, 
  create_api_action_types, 
  create_toggle_action
} = actions_utils

export const rosterActions = {
  // Websocket Events
  ROSTER_TRANSACTION: 'ROSTER_TRANSACTION',
  ROSTER_TRANSACTIONS: 'ROSTER_TRANSACTIONS',

  ...create_api_action_types('POST_TAG'),
  ...create_api_action_types('DELETE_TAG'),

  ...create_api_action_types('POST_TRANSITION_TAG'),
  ...create_api_action_types('DELETE_TRANSITION_TAG'),
  ...create_api_action_types('PUT_TRANSITION_TAG'),

  ...create_api_action_types('GET_ROSTERS'),
  ...create_api_action_types('POST_ROSTERS'),
  ...create_api_action_types('PUT_ROSTERS'),
  ...create_api_action_types('DELETE_ROSTERS'),

  ...create_api_action_types('PUT_ROSTER'),

  ...create_api_action_types('POST_ACTIVATE'),
  ...create_api_action_types('POST_DEACTIVATE'),

  ...create_api_action_types('POST_PROTECT'),

  ...create_api_action_types('POST_ADD_FREE_AGENT'),
  ...create_api_action_types('POST_RESERVE'),
  ...create_api_action_types('POST_RELEASE'),

  ...create_api_action_types('POST_RESTRICTED_FREE_AGENT_NOMINATION'),
  ...create_api_action_types('DELETE_RESTRICTED_FREE_AGENT_NOMINATION'),

  LOAD_ROSTERS: 'LOAD_ROSTERS',
  loadRosters: (leagueId) => ({
    type: rosterActions.LOAD_ROSTERS,
    payload: { leagueId: Number(leagueId) }
  }),

  LOAD_ROSTERS_FOR_YEAR: 'LOAD_ROSTERS_FOR_YEAR',
  loadRostersForYear: ({ lid, year = constants.year }) => ({
    type: rosterActions.LOAD_ROSTERS_FOR_YEAR,
    payload: { lid: Number(lid), year: Number(year) }
  }),

  EXPORT_ROSTERS: 'EXPORT_ROSTERS',
  exportRosters: create_toggle_action('EXPORT_ROSTERS'),

  ADD_FREE_AGENT: 'ADD_FREE_AGENT',
  addFreeAgent: ({ pid, release, slot }) => ({
    type: rosterActions.ADD_FREE_AGENT,
    payload: { pid, release, slot }
  }),

  RELEASE_PLAYER: 'RELEASE_PLAYER',
  release: (pid) => ({
    type: rosterActions.RELEASE_PLAYER,
    payload: { pid }
  }),

  SET_ROSTER_RESERVE: 'SET_ROSTER_RESERVE',
  reserve: ({ reserve_pid, slot, activate_pid }) => ({
    type: rosterActions.SET_ROSTER_RESERVE,
    payload: { reserve_pid, slot, activate_pid }
  }),

  // rookie, franchise tag
  ADD_TAG: 'ADD_TAG',
  addTag: ({ pid, tag, remove }) => ({
    type: rosterActions.ADD_TAG,
    payload: { pid, tag, remove }
  }),

  REMOVE_TAG: 'REMOVE_TAG',
  removeTag: ({ pid, teamId }) => ({
    type: rosterActions.REMOVE_TAG,
    payload: { pid, teamId }
  }),

  PROJECT_LINEUPS: 'PROJECT_LINEUPS',
  projectLineups: create_toggle_action('PROJECT_LINEUPS'),

  // USER
  SET_LINEUPS: 'SET_LINEUPS',
  setLineupProjections: (lineups) => ({
    type: rosterActions.SET_LINEUPS,
    payload: { lineups }
  }),

  ACTIVATE_PLAYER: 'ACTIVATE_PLAYER',
  activate: ({ activate_pid, release_pid, reserve_pid, slot }) => ({
    type: rosterActions.ACTIVATE_PLAYER,
    payload: { activate_pid, release_pid, reserve_pid, slot }
  }),

  DEACTIVATE_PLAYER: 'DEACTIVATE_PLAYER',
  deactivate: ({ deactivate_pid, release_pid }) => ({
    type: rosterActions.DEACTIVATE_PLAYER,
    payload: { deactivate_pid, release_pid }
  }),

  PROTECT_PLAYER: 'PROTECT_PLAYER',
  protect: (pid) => ({
    type: rosterActions.PROTECT_PLAYER,
    payload: { pid }
  }),

  UPDATE_ROSTER_PLAYER_SLOT: 'UPDATE_ROSTER_PLAYER_SLOT',
  update: (players) => ({
    type: rosterActions.UPDATE_ROSTER_PLAYER_SLOT,
    payload: { players }
  }),

  // COMMISH / ADMIN
  ADD_PLAYER_ROSTER: 'ADD_PLAYER_ROSTER',
  add: ({ pid, value, teamId }) => ({
    type: rosterActions.ADD_PLAYER_ROSTER,
    payload: { pid, value, teamId }
  }),

  REMOVE_PLAYER_ROSTER: 'REMOVE_PLAYER_ROSTER',
  remove: ({ pid, teamId }) => ({
    type: rosterActions.REMOVE_PLAYER_ROSTER,
    payload: { pid, teamId }
  }),

  NOMINATE_RESTRICTED_FREE_AGENT: 'NOMINATE_RESTRICTED_FREE_AGENT',
  nominateRestrictedFreeAgent: (pid) => ({
    type: rosterActions.NOMINATE_RESTRICTED_FREE_AGENT,
    payload: { pid }
  }),

  UNNOMINATE_RESTRICTED_FREE_AGENT: 'UNNOMINATE_RESTRICTED_FREE_AGENT',
  unnominateRestrictedFreeAgent: (pid) => ({
    type: rosterActions.UNNOMINATE_RESTRICTED_FREE_AGENT,
    payload: { pid }
  }),

  // TODO - currently not used
  // commish
  UPDATE_PLAYER_ROSTER: 'UPDATE_PLAYER_ROSTER',
  updateValue: ({ pid, value, teamId }) => ({
    type: rosterActions.UPDATE_PLAYER_ROSTER,
    payload: { pid, teamId }
  }),

  ADD_TRANSITION_TAG: 'ADD_TRANSITION_TAG',
  addTransitionTag: ({ pid, release, playerTid, teamId, bid, remove }) => ({
    type: rosterActions.ADD_TRANSITION_TAG,
    payload: { pid, release, teamId, playerTid, bid, remove }
  }),
  UPDATE_TRANSITION_TAG: 'UPDATE_TRANSITION_TAG',
  updateTransitionTag: ({ pid, release, playerTid, teamId, bid }) => ({
    type: rosterActions.UPDATE_TRANSITION_TAG,
    payload: { pid, release, teamId, playerTid, bid }
  }),

  REMOVE_TRANSITION_TAG: 'REMOVE_TRANSITION_TAG',
  removeTransitionTag: ({ pid, teamId }) => ({
    type: rosterActions.REMOVE_TRANSITION_TAG,
    payload: { pid, teamId }
  })
}

export const getRostersActions = create_api_actions('GET_ROSTERS')
export const putRosterActions = create_api_actions('PUT_ROSTER')
export const postActivateActions = create_api_actions('POST_ACTIVATE')
export const postDeactivateActions = create_api_actions('POST_DEACTIVATE')
export const postProtectActions = create_api_actions('POST_PROTECT')
export const putRostersActions = create_api_actions('PUT_ROSTERS')
export const postRostersActions = create_api_actions('POST_ROSTERS')
export const deleteRostersActions = create_api_actions('DELETE_ROSTERS')
export const postAddFreeAgentActions = create_api_actions('POST_ADD_FREE_AGENT')
export const postReserveActions = create_api_actions('POST_RESERVE')
export const postReleaseActions = create_api_actions('POST_RELEASE')
export const postTagActions = create_api_actions('POST_TAG')
export const deleteTagActions = create_api_actions('DELETE_TAG')
export const postTransitionTagActions = create_api_actions(
  'POST_TRANSITION_TAG'
)
export const putTransitionTagActions = create_api_actions('PUT_TRANSITION_TAG')
export const deleteTransitionTagActions = create_api_actions(
  'DELETE_TRANSITION_TAG'
)
export const postRestrictedFreeAgentNominationActions = create_api_actions(
  'POST_RESTRICTED_FREE_AGENT_NOMINATION'
)
export const deleteRestrictedFreeAgentNominationActions =
  create_api_actions('DELETE_RESTRICTED_FREE_AGENT_NOMINATION')
