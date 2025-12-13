import { BaseCollector } from './base-collector.mjs'

/**
 * Sleeper API response collector
 * Collects real API responses from Sleeper for fixture generation
 */
export class SleeperCollector extends BaseCollector {
  constructor(options = {}) {
    super('sleeper', options)
    this.base_url = 'https://api.sleeper.app/v1'
    this.authenticated = false
  }

  /**
   * Sleeper API doesn't require authentication for most endpoints
   * @param {object} _credentials - Not needed for Sleeper
   * @returns {Promise<boolean>} Always returns true
   */
  async authenticate(_credentials = {}) {
    this.authenticated = true
    return true
  }

  /**
   * Collect league configuration from Sleeper API
   * @param {string} league_id - Sleeper league ID
   * @param {number} [_season_year] - Optional season year (not used by Sleeper, kept for consistency)
   * @returns {Promise<object>} League configuration data
   */
  async collect_league_config(league_id, _season_year = null) {
    const url = `${this.base_url}/league/${league_id}`
    const league_data = await this.safe_api_request(url)

    // Also collect scoring settings and roster positions
    const [users, drafts] = await Promise.all([
      this.safe_api_request(`${this.base_url}/league/${league_id}/users`).catch(
        () => []
      ),
      this.safe_api_request(
        `${this.base_url}/league/${league_id}/drafts`
      ).catch(() => [])
    ])

    return {
      league: league_data,
      users,
      drafts
    }
  }

  /**
   * Collect users data from Sleeper API
   * @param {string} league_id - Sleeper league ID
   * @returns {Promise<object>} Users data
   */
  async collect_users(league_id) {
    const url = `${this.base_url}/league/${league_id}/users`
    const users = await this.safe_api_request(url)

    return {
      users,
      user_count: users.length
    }
  }

  /**
   * Collect roster data from Sleeper API
   * @param {string} league_id - Sleeper league ID
   * @param {number} [_season_year] - Optional season year (not used by Sleeper, kept for consistency)
   * @returns {Promise<object>} Roster data
   */
  async collect_rosters(league_id, _season_year = null) {
    const url = `${this.base_url}/league/${league_id}/rosters`
    const rosters = await this.safe_api_request(url)

    // Also collect matchups for current week if available
    let matchups = []
    try {
      // Get current NFL week (approximate)
      const now = new Date()
      const season_start = new Date(now.getFullYear(), 8, 1) // September 1st
      const week = Math.max(
        1,
        Math.min(
          18,
          Math.ceil((now - season_start) / (7 * 24 * 60 * 60 * 1000))
        )
      )

      matchups = await this.safe_api_request(
        `${this.base_url}/league/${league_id}/matchups/${week}`
      )
    } catch (error) {
      console.warn('Could not fetch matchups:', error.message)
    }

    return {
      rosters,
      matchups
    }
  }

  /**
   * Collect player data from Sleeper API
   * @param {string} [_league_id] - Optional league ID (not required for Sleeper players endpoint)
   * @param {number} [_season_year] - Optional season year (not used by Sleeper, kept for consistency)
   * @returns {Promise<object>} All players data
   */
  async collect_players(_league_id = null, _season_year = null) {
    const url = `${this.base_url}/players/nfl`
    const players = await this.safe_api_request(url)

    return {
      players,
      player_count: Object.keys(players).length
    }
  }

  /**
   * Collect transaction data from Sleeper API
   * @param {string} league_id - Sleeper league ID
   * @param {number} [_week] - Optional week number (Sleeper collects multiple weeks by default)
   * @param {number} [_season_year] - Optional season year (not used by Sleeper, kept for consistency)
   * @returns {Promise<object>} Transaction data
   */
  async collect_transactions(league_id, _week = null, _season_year = null) {
    // Get transactions for multiple weeks to have good test data
    const current_week = Math.max(
      1,
      Math.min(
        18,
        Math.ceil(
          (new Date() - new Date(new Date().getFullYear(), 8, 1)) /
            (7 * 24 * 60 * 60 * 1000)
        )
      )
    )
    const weeks_to_collect = Math.max(1, current_week - 2) // Current week and 2 previous

    const transactions = []

    for (let week = weeks_to_collect; week <= current_week; week++) {
      try {
        const week_transactions = await this.safe_api_request(
          `${this.base_url}/league/${league_id}/transactions/${week}`
        )
        transactions.push(...week_transactions)
      } catch (error) {
        console.warn(
          `Could not fetch transactions for week ${week}:`,
          error.message
        )
      }
    }

    return {
      transactions,
      weeks_collected: `${weeks_to_collect}-${current_week}`,
      total_transactions: transactions.length
    }
  }

  /**
   * Anonymize Sleeper-specific data
   * @param {object} data - Raw Sleeper data
   * @param {string} response_type - Type of response being anonymized
   * @returns {object} Anonymized data
   */
  anonymize_data(data, response_type) {
    // Start with base anonymization
    const anonymized = super.anonymize_data(data, response_type)

    // Sleeper-specific anonymization
    const anonymize_sleeper_recursive = (obj) => {
      if (Array.isArray(obj)) {
        return obj.map((item) => anonymize_sleeper_recursive(item))
      }

      if (obj && typeof obj === 'object') {
        const result = {}
        for (const [key, value] of Object.entries(obj)) {
          switch (key) {
            case 'user_id':
              result[key] =
                `anon_user_${Math.random().toString(36).substring(2, 10)}`
              break
            case 'owner_id':
              result[key] =
                `anon_owner_${Math.random().toString(36).substring(2, 10)}`
              break
            case 'league_id':
              result[key] =
                `anon_league_${Math.random().toString(36).substring(2, 10)}`
              break
            case 'username':
            case 'display_name':
              result[key] = `AnonymizedUser${Math.floor(Math.random() * 1000)}`
              break
            case 'team_name':
              result[key] = `Anonymized Team ${Math.floor(Math.random() * 100)}`
              break
            case 'name':
              if (response_type === 'league-config') {
                result[key] =
                  `Anonymized League ${Math.floor(Math.random() * 100)}`
              } else {
                result[key] =
                  typeof value === 'string' ? `Anonymized ${key}` : value
              }
              break
            case 'avatar':
              result[key] = null // Remove avatar URLs
              break
            case 'metadata':
              // Anonymize metadata that might contain sensitive info
              if (value && typeof value === 'object') {
                result[key] = Object.keys(value).reduce((acc, k) => {
                  acc[k] =
                    typeof value[k] === 'string' ? 'anonymized' : value[k]
                  return acc
                }, {})
              } else {
                result[key] = value
              }
              break
            default:
              result[key] = anonymize_sleeper_recursive(value)
              break
          }
        }
        return result
      }

      return obj
    }

    return anonymize_sleeper_recursive(anonymized)
  }

  /**
   * Collect sample edge cases for Sleeper
   * @param {string} league_id - Sleeper league ID
   * @returns {Promise<object>} Edge case scenarios
   */
  async collect_edge_cases(league_id) {
    const edge_cases = []

    // Test with invalid league ID
    try {
      await this.safe_api_request(`${this.base_url}/league/invalid_league_id`)
    } catch (error) {
      edge_cases.push({
        case_name: 'invalid_league_id',
        description: 'Request with invalid league ID',
        input_data: { league_id: 'invalid_league_id' },
        error_response: error.message
      })
    }

    // Test with very old week (should return empty)
    try {
      const old_transactions = await this.safe_api_request(
        `${this.base_url}/league/${league_id}/transactions/1`
      )
      if (old_transactions.length === 0) {
        edge_cases.push({
          case_name: 'empty_transactions',
          description: 'Empty transactions response',
          input_data: { league_id, week: 1 },
          response_data: old_transactions
        })
      }
    } catch (error) {
      edge_cases.push({
        case_name: 'old_week_transactions_error',
        description: 'Error fetching old week transactions',
        input_data: { league_id, week: 1 },
        error_response: error.message
      })
    }

    return {
      platform: 'sleeper',
      edge_cases,
      collected_at: new Date().toISOString()
    }
  }

  /**
   * Get Sleeper-specific collection info
   * @returns {object} Platform information
   */
  get_platform_info() {
    return {
      platform: 'sleeper',
      base_url: this.base_url,
      supports_authentication: false,
      rate_limits: {
        requests_per_minute: 1000,
        notes: 'Sleeper has generous rate limits for public data'
      },
      endpoints: {
        league: '/league/{league_id}',
        users: '/league/{league_id}/users',
        rosters: '/league/{league_id}/rosters',
        matchups: '/league/{league_id}/matchups/{week}',
        transactions: '/league/{league_id}/transactions/{week}',
        players: '/players/nfl',
        drafts: '/league/{league_id}/drafts'
      }
    }
  }
}
