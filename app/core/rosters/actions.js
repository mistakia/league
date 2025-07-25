import { actions_utils } from '@core/utils'
import { constants } from '@libs-shared'
const { create_api_actions, create_api_action_types, create_toggle_action } =
  actions_utils

export const roster_actions = {
  // Websocket Events
  ROSTER_TRANSACTION: 'ROSTER_TRANSACTION',
  ROSTER_TRANSACTIONS: 'ROSTER_TRANSACTIONS',

  ...create_api_action_types('POST_TAG'),
  ...create_api_action_types('DELETE_TAG'),

  ...create_api_action_types('POST_RESTRICTED_FREE_AGENCY_TAG'),
  ...create_api_action_types('DELETE_RESTRICTED_FREE_AGENCY_TAG'),
  ...create_api_action_types('PUT_RESTRICTED_FREE_AGENCY_TAG'),

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
  load_rosters: (leagueId) => ({
    type: roster_actions.LOAD_ROSTERS,
    payload: { leagueId: Number(leagueId) }
  }),

  LOAD_ROSTERS_FOR_YEAR: 'LOAD_ROSTERS_FOR_YEAR',
  load_rosters_for_year: ({ lid, year = constants.year }) => ({
    type: roster_actions.LOAD_ROSTERS_FOR_YEAR,
    payload: { lid: Number(lid), year: Number(year) }
  }),

  EXPORT_ROSTERS: 'EXPORT_ROSTERS',
  export_rosters: create_toggle_action('EXPORT_ROSTERS'),

  ADD_FREE_AGENT: 'ADD_FREE_AGENT',
  add_free_agent: ({ pid, release, slot }) => ({
    type: roster_actions.ADD_FREE_AGENT,
    payload: { pid, release, slot }
  }),

  RELEASE_PLAYER: 'RELEASE_PLAYER',
  release: (pid) => ({
    type: roster_actions.RELEASE_PLAYER,
    payload: { pid }
  }),

  SET_ROSTER_RESERVE: 'SET_ROSTER_RESERVE',
  reserve: ({ reserve_pid, slot, activate_pid }) => ({
    type: roster_actions.SET_ROSTER_RESERVE,
    payload: { reserve_pid, slot, activate_pid }
  }),

  // rookie, franchise tag
  ADD_TAG: 'ADD_TAG',
  add_tag: ({ pid, tag, remove }) => ({
    type: roster_actions.ADD_TAG,
    payload: { pid, tag, remove }
  }),

  REMOVE_TAG: 'REMOVE_TAG',
  remove_tag: ({ pid, teamId }) => ({
    type: roster_actions.REMOVE_TAG,
    payload: { pid, teamId }
  }),

  PROJECT_LINEUPS: 'PROJECT_LINEUPS',
  project_lineups: create_toggle_action('PROJECT_LINEUPS'),

  // USER
  SET_LINEUPS: 'SET_LINEUPS',
  set_lineup_projections: (lineups) => ({
    type: roster_actions.SET_LINEUPS,
    payload: { lineups }
  }),

  ACTIVATE_PLAYER: 'ACTIVATE_PLAYER',
  activate: ({ activate_pid, release_pid, reserve_pid, slot }) => ({
    type: roster_actions.ACTIVATE_PLAYER,
    payload: { activate_pid, release_pid, reserve_pid, slot }
  }),

  DEACTIVATE_PLAYER: 'DEACTIVATE_PLAYER',
  deactivate: ({ deactivate_pid, release_pid }) => ({
    type: roster_actions.DEACTIVATE_PLAYER,
    payload: { deactivate_pid, release_pid }
  }),

  PROTECT_PLAYER: 'PROTECT_PLAYER',
  protect: (pid) => ({
    type: roster_actions.PROTECT_PLAYER,
    payload: { pid }
  }),

  UPDATE_ROSTER_PLAYER_SLOT: 'UPDATE_ROSTER_PLAYER_SLOT',
  update: (players) => ({
    type: roster_actions.UPDATE_ROSTER_PLAYER_SLOT,
    payload: { players }
  }),

  // COMMISH / ADMIN
  ADD_PLAYER_ROSTER: 'ADD_PLAYER_ROSTER',
  add: ({ pid, value, teamId }) => ({
    type: roster_actions.ADD_PLAYER_ROSTER,
    payload: { pid, value, teamId }
  }),

  REMOVE_PLAYER_ROSTER: 'REMOVE_PLAYER_ROSTER',
  remove: ({ pid, teamId }) => ({
    type: roster_actions.REMOVE_PLAYER_ROSTER,
    payload: { pid, teamId }
  }),

  NOMINATE_RESTRICTED_FREE_AGENT: 'NOMINATE_RESTRICTED_FREE_AGENT',
  nominate_restricted_free_agent: (pid) => ({
    type: roster_actions.NOMINATE_RESTRICTED_FREE_AGENT,
    payload: { pid }
  }),

  UNNOMINATE_RESTRICTED_FREE_AGENT: 'UNNOMINATE_RESTRICTED_FREE_AGENT',
  unnominate_restricted_free_agent: (pid) => ({
    type: roster_actions.UNNOMINATE_RESTRICTED_FREE_AGENT,
    payload: { pid }
  }),

  // TODO - currently not used
  // commish
  UPDATE_PLAYER_ROSTER: 'UPDATE_PLAYER_ROSTER',
  update_value: ({ pid, value, teamId }) => ({
    type: roster_actions.UPDATE_PLAYER_ROSTER,
    payload: { pid, teamId }
  }),

  ADD_RESTRICTED_FREE_AGENCY_TAG: 'ADD_RESTRICTED_FREE_AGENCY_TAG',
  add_restricted_free_agency_tag: ({
    pid,
    release,
    playerTid,
    teamId,
    bid,
    remove
  }) => ({
    type: roster_actions.ADD_RESTRICTED_FREE_AGENCY_TAG,
    payload: { pid, release, teamId, playerTid, bid, remove }
  }),
  UPDATE_RESTRICTED_FREE_AGENCY_TAG: 'UPDATE_RESTRICTED_FREE_AGENCY_TAG',
  update_restricted_free_agency_tag: ({
    pid,
    release,
    playerTid,
    teamId,
    bid
  }) => ({
    type: roster_actions.UPDATE_RESTRICTED_FREE_AGENCY_TAG,
    payload: { pid, release, teamId, playerTid, bid }
  }),

  REMOVE_RESTRICTED_FREE_AGENCY_TAG: 'REMOVE_RESTRICTED_FREE_AGENCY_TAG',
  remove_restricted_free_agency_tag: ({ pid, teamId }) => ({
    type: roster_actions.REMOVE_RESTRICTED_FREE_AGENCY_TAG,
    payload: { pid, teamId }
  })
}

export const get_rosters_actions = create_api_actions('GET_ROSTERS')
export const put_roster_actions = create_api_actions('PUT_ROSTER')
export const post_activate_actions = create_api_actions('POST_ACTIVATE')
export const post_deactivate_actions = create_api_actions('POST_DEACTIVATE')
export const post_protect_actions = create_api_actions('POST_PROTECT')
export const put_rosters_actions = create_api_actions('PUT_ROSTERS')
export const post_rosters_actions = create_api_actions('POST_ROSTERS')
export const delete_rosters_actions = create_api_actions('DELETE_ROSTERS')
export const post_add_free_agent_actions = create_api_actions(
  'POST_ADD_FREE_AGENT'
)
export const post_reserve_actions = create_api_actions('POST_RESERVE')
export const post_release_actions = create_api_actions('POST_RELEASE')
export const post_tag_actions = create_api_actions('POST_TAG')
export const delete_tag_actions = create_api_actions('DELETE_TAG')
export const post_restricted_free_agency_tag_actions = create_api_actions(
  'POST_RESTRICTED_FREE_AGENCY_TAG'
)
export const put_restricted_free_agency_tag_actions = create_api_actions(
  'PUT_RESTRICTED_FREE_AGENCY_TAG'
)
export const delete_restricted_free_agency_tag_actions = create_api_actions(
  'DELETE_RESTRICTED_FREE_AGENCY_TAG'
)
export const post_restricted_free_agent_nomination_actions = create_api_actions(
  'POST_RESTRICTED_FREE_AGENT_NOMINATION'
)
export const delete_restricted_free_agent_nomination_actions =
  create_api_actions('DELETE_RESTRICTED_FREE_AGENT_NOMINATION')
