import { BaseCollector } from './base-collector.mjs'

/**
 * ESPN Fantasy API response collector
 * Collects real API responses from ESPN Fantasy Football for fixture generation
 */
export class EspnCollector extends BaseCollector {
  constructor(options = {}) {
    super('espn', options)
    this.base_url = 'https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl'
    this.authenticated = false
    this.cookies = {}
    this.league_year = new Date().getFullYear()
  }

  /**
   * ESPN requires authentication for private leagues via cookies
   * @param {object} credentials - ESPN credentials
   * @param {string} credentials.espn_s2 - ESPN S2 cookie value
   * @param {string} credentials.swid - ESPN SWID cookie value
   * @returns {Promise<boolean>} Authentication success
   */
  async authenticate(credentials = {}) {
    const { espn_s2, swid } = credentials

    if (espn_s2 && swid) {
      this.cookies = {
        espn_s2,
        SWID: swid
      }
      this.authenticated = true
      console.log('ESPN authentication configured with cookies')
      return true
    }

    console.warn(
      'ESPN authentication not provided - only public leagues will be accessible'
    )
    this.authenticated = false
    return false
  }

  /**
   * Collect league configuration from ESPN API
   * @param {string} league_id - ESPN league ID
   * @param {number} season_year - Season year (defaults to current year)
   * @returns {Promise<object>} League configuration data
   */
  async collect_league_config(league_id, season_year = null) {
    const year = season_year || this.league_year
    const url = `${this.base_url}/seasons/${year}/segments/0/leagues/${league_id}`

    const params = new URLSearchParams({
      view: ['mSettings', 'mTeam', 'modular', 'mNav'].join(',')
    })

    const league_data = await this.safe_api_request(`${url}?${params}`, {
      headers: this.get_headers()
    })

    // Also collect scoring settings and roster positions
    const scoring_url = `${url}?view=kona_player_info`
    let scoring_settings = {}
    try {
      scoring_settings = await this.safe_api_request(scoring_url, {
        headers: this.get_headers()
      })
    } catch (error) {
      console.warn('Could not fetch scoring settings:', error.message)
    }

    return {
      league: league_data,
      scoring_settings,
      season_year: year
    }
  }

  /**
   * Collect roster/team data from ESPN API
   * @param {string} league_id - ESPN league ID
   * @param {number} season_year - Season year (defaults to current year)
   * @returns {Promise<object>} Roster data
   */
  async collect_rosters(league_id, season_year = null) {
    const year = season_year || this.league_year
    const url = `${this.base_url}/seasons/${year}/segments/0/leagues/${league_id}`

    const params = new URLSearchParams({
      view: ['mRoster', 'mTeam', 'mSettings'].join(',')
    })

    const roster_data = await this.safe_api_request(`${url}?${params}`, {
      headers: this.get_headers()
    })

    // Also collect current matchups if available
    let matchups = {}
    try {
      const matchup_params = new URLSearchParams({
        view: 'mMatchup'
      })
      matchups = await this.safe_api_request(`${url}?${matchup_params}`, {
        headers: this.get_headers()
      })
    } catch (error) {
      console.warn('Could not fetch matchups:', error.message)
    }

    return {
      rosters: roster_data,
      matchups,
      season_year: year
    }
  }

  /**
   * Collect player data from ESPN API
   * @param {string} league_id - ESPN league ID (needed for player pool context)
   * @param {number} season_year - Season year (defaults to current year)
   * @returns {Promise<object>} Players data
   */
  async collect_players(league_id, season_year = null) {
    const year = season_year || this.league_year
    const url = `${this.base_url}/seasons/${year}/segments/0/leagues/${league_id}`

    // ESPN players endpoint requires league context
    const params = new URLSearchParams({
      view: 'kona_player_info'
    })

    const players_data = await this.safe_api_request(`${url}?${params}`, {
      headers: this.get_headers()
    })

    // Also get player stats if available
    let player_stats = {}
    try {
      const stats_params = new URLSearchParams({
        view: ['kona_player_info', 'players_wl'].join(',')
      })
      player_stats = await this.safe_api_request(`${url}?${stats_params}`, {
        headers: this.get_headers()
      })
    } catch (error) {
      console.warn('Could not fetch player stats:', error.message)
    }

    return {
      players: players_data,
      player_stats,
      season_year: year
    }
  }

  /**
   * Collect transaction data from ESPN API
   * @param {string} league_id - ESPN league ID
   * @param {number} season_year - Season year (defaults to current year)
   * @returns {Promise<object>} Transaction data
   */
  async collect_transactions(league_id, season_year = null) {
    const year = season_year || this.league_year
    const url = `${this.base_url}/seasons/${year}/segments/0/leagues/${league_id}`

    const params = new URLSearchParams({
      view: 'mTransactions2'
    })

    const transactions_data = await this.safe_api_request(`${url}?${params}`, {
      headers: this.get_headers()
    })

    // Also collect recent activity
    let recent_activity = {}
    try {
      const activity_params = new URLSearchParams({
        view: 'mRecentActivity'
      })
      recent_activity = await this.safe_api_request(
        `${url}?${activity_params}`,
        {
          headers: this.get_headers()
        }
      )
    } catch (error) {
      console.warn('Could not fetch recent activity:', error.message)
    }

    return {
      transactions: transactions_data,
      recent_activity,
      season_year: year
    }
  }

  /**
   * Collect draft data from ESPN API
   *
   * NOTE: This is an ESPN-specific extension method, not part of the base collector interface.
   * Other platforms may implement similar methods if they support draft data collection.
   *
   * @param {string} league_id - ESPN league ID
   * @param {number} season_year - Season year (defaults to current year)
   * @returns {Promise<object>} Draft data (raw platform response)
   */
  async collect_draft_data(league_id, season_year = null) {
    const year = season_year || this.league_year
    const url = `${this.base_url}/seasons/${year}/segments/0/leagues/${league_id}`

    const params = new URLSearchParams({
      view: ['mDraftDetail', 'mSettings'].join(',')
    })

    try {
      const draft_data = await this.safe_api_request(`${url}?${params}`, {
        headers: this.get_headers()
      })

      return {
        draft: draft_data,
        season_year: year
      }
    } catch (error) {
      console.warn('Could not fetch draft data:', error.message)
      return {
        draft: null,
        error: error.message,
        season_year: year
      }
    }
  }

  /**
   * Get headers for ESPN API requests
   * @returns {object} Headers object
   */
  get_headers() {
    const headers = {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      Accept: 'application/json',
      'X-Fantasy-Platform': 'kona-PROD-269f2fe6bba2a9a2abe04ccd8209ce74271e4d9a'
    }

    if (this.authenticated && Object.keys(this.cookies).length > 0) {
      headers.Cookie = Object.entries(this.cookies)
        .map(([key, value]) => `${key}=${value}`)
        .join('; ')
    }

    return headers
  }

  /**
   * Anonymize ESPN-specific data
   * @param {object} data - Raw ESPN data
   * @param {string} response_type - Type of response being anonymized
   * @returns {object} Anonymized data
   */
  anonymize_data(data, response_type) {
    // Start with base anonymization
    const anonymized = super.anonymize_data(data, response_type)

    // ESPN-specific anonymization
    const anonymize_espn_recursive = (obj) => {
      if (Array.isArray(obj)) {
        return obj.map((item) => anonymize_espn_recursive(item))
      }

      if (obj && typeof obj === 'object') {
        const result = {}
        for (const [key, value] of Object.entries(obj)) {
          switch (key) {
            case 'id':
              // Keep IDs as they are (structural identifiers)
              result[key] = value
              break
            case 'firstName':
            case 'lastName':
              result[key] = `Anon${key}${Math.floor(Math.random() * 1000)}`
              break
            case 'location':
            case 'abbrev':
              result[key] = `ANON${Math.floor(Math.random() * 100)}`
              break
            case 'name':
              if (response_type === 'league-config') {
                result[key] =
                  `Anonymized League ${Math.floor(Math.random() * 100)}`
              } else {
                result[key] = `Anonymized ${Math.floor(Math.random() * 100)}`
              }
              break
            case 'logo':
            case 'logoType':
              result[key] = null // Remove logo URLs
              break
            case 'owners':
              // Anonymize owner information
              if (Array.isArray(value)) {
                result[key] = value.map((owner) => ({
                  ...owner,
                  displayName: `AnonymizedOwner${Math.floor(Math.random() * 1000)}`,
                  firstName: `AnonFirst${Math.floor(Math.random() * 100)}`,
                  lastName: `AnonLast${Math.floor(Math.random() * 100)}`
                }))
              } else {
                result[key] = value
              }
              break
            case 'members':
              // Anonymize member information
              if (Array.isArray(value)) {
                result[key] = value.map((member) => ({
                  ...member,
                  displayName: `AnonymizedMember${Math.floor(Math.random() * 1000)}`,
                  firstName: `AnonFirst${Math.floor(Math.random() * 100)}`,
                  lastName: `AnonLast${Math.floor(Math.random() * 100)}`
                }))
              } else {
                result[key] = value
              }
              break
            default:
              result[key] = anonymize_espn_recursive(value)
              break
          }
        }
        return result
      }

      return obj
    }

    return anonymize_espn_recursive(anonymized)
  }

  /**
   * Collect sample edge cases for ESPN
   * @param {string} league_id - ESPN league ID
   * @returns {Promise<object>} Edge case scenarios
   */
  async collect_edge_cases(league_id) {
    const edge_cases = []

    // Test with invalid league ID
    try {
      const invalid_url = `${this.base_url}/seasons/${this.league_year}/segments/0/leagues/invalid_league_id`
      await this.safe_api_request(invalid_url, { headers: this.get_headers() })
    } catch (error) {
      edge_cases.push({
        case_name: 'invalid_league_id',
        description: 'Request with invalid league ID',
        input_data: { league_id: 'invalid_league_id' },
        error_response: error.message
      })
    }

    // Test without authentication for private league
    try {
      const url = `${this.base_url}/seasons/${this.league_year}/segments/0/leagues/${league_id}`
      await this.safe_api_request(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          Accept: 'application/json'
        }
      })
    } catch (error) {
      edge_cases.push({
        case_name: 'unauthenticated_private_league',
        description: 'Access private league without authentication',
        input_data: { league_id, authenticated: false },
        error_response: error.message
      })
    }

    // Test with invalid view parameter
    try {
      const url = `${this.base_url}/seasons/${this.league_year}/segments/0/leagues/${league_id}`
      const params = new URLSearchParams({ view: 'invalid_view_parameter' })
      await this.safe_api_request(`${url}?${params}`, {
        headers: this.get_headers()
      })
    } catch (error) {
      edge_cases.push({
        case_name: 'invalid_view_parameter',
        description: 'Request with invalid view parameter',
        input_data: { league_id, view: 'invalid_view_parameter' },
        error_response: error.message
      })
    }

    return {
      platform: 'espn',
      edge_cases,
      collected_at: new Date().toISOString()
    }
  }

  /**
   * Get ESPN-specific collection info
   * @returns {object} Platform information
   */
  get_platform_info() {
    return {
      platform: 'espn',
      base_url: this.base_url,
      supports_authentication: true,
      authentication_method: 'cookies',
      rate_limits: {
        requests_per_minute: 100,
        notes: 'ESPN has moderate rate limits, be respectful'
      },
      endpoints: {
        league: '/seasons/{year}/segments/0/leagues/{league_id}',
        rosters:
          '/seasons/{year}/segments/0/leagues/{league_id}?view=mRoster,mTeam',
        players:
          '/seasons/{year}/segments/0/leagues/{league_id}?view=kona_player_info',
        transactions:
          '/seasons/{year}/segments/0/leagues/{league_id}?view=mTransactions2',
        matchups:
          '/seasons/{year}/segments/0/leagues/{league_id}?view=mMatchup',
        draft:
          '/seasons/{year}/segments/0/leagues/{league_id}?view=mDraftDetail'
      },
      required_credentials: {
        espn_s2: 'ESPN S2 session cookie',
        swid: 'ESPN SWID identifier cookie'
      }
    }
  }
}
