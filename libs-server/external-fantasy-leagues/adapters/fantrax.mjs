import BaseAdapter from './base-adapter.mjs'
import AuthenticatedApiClient from '../utils/authenticated-api-client.mjs'
import {
  stub_authenticate,
  stub_get_method,
  stub_map_player_to_internal
} from './stub-adapter-helpers.mjs'

/**
 * Fantrax adapter
 *
 * Handles integration with Fantrax fantasy leagues.
 *
 * Status: STUB - Not yet implemented
 * This adapter provides the interface structure but requires implementation
 * of all methods for full functionality.
 */
export default class FantraxAdapter extends BaseAdapter {
  constructor(config = {}) {
    super(config)

    // Initialize API client for consistency with other adapters
    this.api_client = new AuthenticatedApiClient({
      base_url: 'https://www.fantrax.com/api',
      requests_per_minute: 60,
      requests_per_second: 10,
      window_ms: 1000,
      auth_type: 'none',
      max_retries: 3,
      timeout: 30000
    })

    this.authenticated = false
    this.requires_authentication = true
    this.supports_private_leagues = true
  }

  async authenticate(credentials) {
    return stub_authenticate(this.log.bind(this), 'Fantrax')
  }

  async get_league(league_id, options = {}) {
    stub_get_method(this.log.bind(this), 'Fantrax', 'get_league', {
      league_id,
      options
    })
  }

  async get_teams(league_id) {
    stub_get_method(this.log.bind(this), 'Fantrax', 'get_teams', { league_id })
  }

  async get_rosters({ league_id, week = null, year = null }) {
    stub_get_method(this.log.bind(this), 'Fantrax', 'get_rosters', {
      league_id,
      week,
      year
    })
  }

  async get_players({ filters = {} } = {}) {
    stub_get_method(this.log.bind(this), 'Fantrax', 'get_players', { filters })
  }

  async get_transactions({ league_id, options = {}, year = null }) {
    stub_get_method(this.log.bind(this), 'Fantrax', 'get_transactions', {
      league_id,
      options,
      year
    })
  }

  async get_matchups({ league_id, week }) {
    stub_get_method(this.log.bind(this), 'Fantrax', 'get_matchups', {
      league_id,
      week
    })
  }

  async get_scoring_format(league_id) {
    stub_get_method(this.log.bind(this), 'Fantrax', 'get_scoring_format', {
      league_id
    })
  }

  async get_draft_results(league_id) {
    stub_get_method(this.log.bind(this), 'Fantrax', 'get_draft_results', {
      league_id
    })
  }

  async map_player_to_internal(external_player_id) {
    return stub_map_player_to_internal(
      this.log.bind(this),
      'Fantrax',
      external_player_id
    )
  }
}
