import BaseAdapter from './base-adapter.mjs'
import AuthenticatedApiClient from '../utils/authenticated-api-client.mjs'
import { platform_authenticator } from '../utils/platform-authenticator.mjs'

/**
 * Fleaflicker adapter
 * Handles integration with Fleaflicker fantasy leagues (no authentication required)
 * Implements ffscrapr-compatible authentication patterns
 */
export default class FleaflickerAdapter extends BaseAdapter {
  constructor(config = {}) {
    super(config)

    this.sport = 'NFL'

    this.api_client = new AuthenticatedApiClient({
      base_url: 'https://www.fleaflicker.com/api',
      requests_per_minute: 100,
      requests_per_second: 30,
      window_ms: 2000,
      burst_limit: 50,
      auth_type: 'none', // Fleaflicker doesn't require authentication
      max_retries: 3,
      timeout: 30000,
      exponential_backoff: true,
      max_consecutive_failures: 5,
      circuit_breaker_timeout_ms: 60000
    })

    // Set no-auth authentication (Fleaflicker API is public)
    this.api_client.set_authentication({}, 'none')
    this.authenticated = true
    this.requires_authentication = false // Fleaflicker API is public
    this.supports_private_leagues = false // Fleaflicker doesn't support private league API access
  }

  /**
   * Authenticate with Fleaflicker (no authentication required - API is public)
   * @param {Object} credentials - Not used for Fleaflicker
   * @returns {Promise<boolean>} Always returns true
   */
  async authenticate(credentials = {}) {
    try {
      const auth_result = await platform_authenticator.authenticate(
        'fleaflicker',
        credentials
      )

      if (auth_result.success) {
        this.api_client.set_authentication(
          auth_result.credentials,
          auth_result.auth_type
        )
        this.authenticated = true

        this.log(
          'info',
          'Fleaflicker authentication successful (no auth required)',
          {
            auth_type: auth_result.auth_type,
            public_leagues: auth_result.public_leagues,
            private_leagues: auth_result.private_leagues
          }
        )

        platform_authenticator.cache_auth('fleaflicker', auth_result)
        return true
      }

      throw new Error('Fleaflicker authentication failed unexpectedly')
    } catch (error) {
      this.log('error', 'Fleaflicker authentication error', {
        error: error.message
      })
      return false
    }
  }

  async get_league(league_id, options = {}) {
    // TODO: Implement Fleaflicker league data fetching
    // Example endpoint: /FetchLeague?sport=NFL&league_id={league_id}
    this.log('warn', 'Fleaflicker get_league not yet implemented', {
      league_id,
      options
    })
    throw new Error('Fleaflicker adapter: get_league() is not yet implemented')
  }

  async get_teams(league_id) {
    // TODO: Implement Fleaflicker teams fetching
    this.log('warn', 'Fleaflicker get_teams not yet implemented', { league_id })
    throw new Error('Fleaflicker adapter: get_teams() is not yet implemented')
  }

  async get_rosters({ league_id, week = null, year = null }) {
    // TODO: Implement Fleaflicker rosters fetching
    // Example endpoint: /FetchRosters?sport=NFL&league_id={league_id}&scoring_period={week}
    this.log('warn', 'Fleaflicker get_rosters not yet implemented', {
      league_id,
      week,
      year
    })
    throw new Error('Fleaflicker adapter: get_rosters() is not yet implemented')
  }

  async get_players({ filters = {} } = {}) {
    // TODO: Implement Fleaflicker players fetching
    this.log('warn', 'Fleaflicker get_players not yet implemented', { filters })
    throw new Error('Fleaflicker adapter: get_players() is not yet implemented')
  }

  async get_transactions({ league_id, options = {}, year = null }) {
    // TODO: Implement Fleaflicker transactions fetching
    this.log('warn', 'Fleaflicker get_transactions not yet implemented', {
      league_id,
      options,
      year
    })
    throw new Error(
      'Fleaflicker adapter: get_transactions() is not yet implemented'
    )
  }

  async get_matchups({ league_id, week }) {
    // TODO: Implement Fleaflicker matchups fetching
    this.log('warn', 'Fleaflicker get_matchups not yet implemented', {
      league_id,
      week
    })
    throw new Error(
      'Fleaflicker adapter: get_matchups() is not yet implemented'
    )
  }

  async get_scoring_format(league_id) {
    // TODO: Implement Fleaflicker scoring format fetching
    this.log('warn', 'Fleaflicker get_scoring_format not yet implemented', {
      league_id
    })
    throw new Error(
      'Fleaflicker adapter: get_scoring_format() is not yet implemented'
    )
  }

  async get_draft_results(league_id) {
    // TODO: Implement Fleaflicker draft results fetching
    this.log('warn', 'Fleaflicker get_draft_results not yet implemented', {
      league_id
    })
    throw new Error(
      'Fleaflicker adapter: get_draft_results() is not yet implemented'
    )
  }

  async map_player_to_internal(external_player_id) {
    // TODO: Implement Fleaflicker player ID mapping
    this.log('warn', 'Fleaflicker map_player_to_internal not yet implemented', {
      external_player_id
    })
    return null
  }
}
