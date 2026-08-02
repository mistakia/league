import { actions_utils } from '@core/utils'
const { create_api_actions, create_api_action_types } = actions_utils

export const restricted_free_agency_actions = {
  ...create_api_action_types('GET_RESTRICTED_FREE_AGENCY_AUCTIONS'),

  LOAD_RESTRICTED_FREE_AGENCY_AUCTIONS: 'LOAD_RESTRICTED_FREE_AGENCY_AUCTIONS',
  load_restricted_free_agency_auctions: ({ leagueId, year }) => ({
    type: restricted_free_agency_actions.LOAD_RESTRICTED_FREE_AGENCY_AUCTIONS,
    payload: {
      leagueId: Number(leagueId),
      year: year ? Number(year) : undefined
    }
  }),

  SELECT_RESTRICTED_FREE_AGENCY_YEAR: 'SELECT_RESTRICTED_FREE_AGENCY_YEAR',
  select_restricted_free_agency_year: (year) => ({
    type: restricted_free_agency_actions.SELECT_RESTRICTED_FREE_AGENCY_YEAR,
    payload: {
      year: Number(year)
    }
  })
}

export const get_restricted_free_agency_auctions_actions = create_api_actions(
  'GET_RESTRICTED_FREE_AGENCY_AUCTIONS'
)
