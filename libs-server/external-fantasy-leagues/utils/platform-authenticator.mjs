import fetch from 'node-fetch'
import debug from 'debug'

const log = debug('external:auth')

/**
 * Platform-specific authentication manager following ffscrapr patterns
 *
 * Handles authentication flows for all supported fantasy platforms, including:
 * - Sleeper: No authentication required (public API)
 * - ESPN: Cookie-based authentication (espn_s2, swid) or username/password
 * - Yahoo: OAuth2 flow with token refresh
 * - MFL: API key or username/password
 * - Fleaflicker: No authentication required
 *
 * Provides authentication result caching and token refresh capabilities.
 * Used by platform adapters to authenticate before making API requests.
 *
 * @example
 * const auth_result = await platform_authenticator.authenticate('espn', {
 *   espn_s2: '...',
 *   swid: '...'
 * })
 */
export class PlatformAuthenticator {
  constructor() {
    this.auth_cache = new Map()
    this.refresh_tokens = new Map()
  }

  /**
   * Create standardized authentication result object
   * @private
   * @param {Object} options - Authentication result options
   * @param {string} options.platform - Platform identifier
   * @param {string} options.auth_type - Authentication type
   * @param {Object|null} options.credentials - Credentials object or null
   * @param {number|null} options.expires_at - Expiration timestamp or null
   * @param {boolean} options.public_leagues - Whether public leagues are accessible
   * @param {boolean} options.private_leagues - Whether private leagues are accessible
   * @returns {Object} Standardized authentication result
   */
  _create_auth_result({
    platform,
    auth_type,
    credentials = null,
    expires_at = null,
    public_leagues = true,
    private_leagues = false
  }) {
    return {
      success: true,
      auth_type,
      platform,
      credentials,
      expires_at,
      public_leagues,
      private_leagues
    }
  }

  /**
   * Authenticate with platform using platform-specific flow
   * @param {string} platform - Platform identifier (sleeper, espn, yahoo, mfl, fleaflicker)
   * @param {Object} credentials - Platform-specific credentials
   * @returns {Promise<Object>} Authentication result with tokens/cookies
   */
  async authenticate(platform, credentials = {}) {
    let result
    switch (platform.toLowerCase()) {
      case 'sleeper':
        result = await this._authenticate_sleeper(credentials)
        break
      case 'espn':
        result = await this._authenticate_espn(credentials)
        break
      case 'yahoo':
        result = await this._authenticate_yahoo(credentials)
        break
      case 'mfl':
        result = await this._authenticate_mfl(credentials)
        break
      case 'fleaflicker':
        result = await this._authenticate_fleaflicker(credentials)
        break
      default:
        throw new Error(`Unsupported platform: ${platform}`)
    }

    // Cache successful authentication results
    if (result && result.success) {
      this.cache_auth(platform, result)
    }

    return result
  }

  /**
   * Sleeper authentication (no auth required)
   * @param {Object} credentials - Not used
   * @returns {Promise<Object>} Authentication result
   */
  async _authenticate_sleeper(credentials) {
    return this._create_auth_result({
      platform: 'sleeper',
      auth_type: 'none',
      credentials: null,
      expires_at: null,
      public_leagues: true,
      private_leagues: true
    })
  }

  /**
   * ESPN authentication using cookie-based approach
   * @param {Object} credentials - ESPN credentials
   * @param {string} [credentials.espn_s2] - ESPN s2 cookie (for private leagues)
   * @param {string} [credentials.swid] - ESPN SWID cookie (for private leagues)
   * @param {string} [credentials.username] - ESPN username (alternative login)
   * @param {string} [credentials.password] - ESPN password (alternative login)
   * @returns {Promise<Object>} Authentication result
   */
  async _authenticate_espn(credentials) {
    // If cookies provided, use them directly
    if (credentials.espn_s2 && credentials.swid) {
      return this._create_auth_result({
        platform: 'espn',
        auth_type: 'cookie_based',
        credentials: {
          espn_s2: credentials.espn_s2,
          swid: credentials.swid
        },
        expires_at: null, // ESPN cookies don't have explicit expiration
        public_leagues: true,
        private_leagues: true
      })
    }

    // If username/password provided, get cookies via login flow
    if (credentials.username && credentials.password) {
      try {
        const cookies = await this._get_espn_cookies_via_login(
          credentials.username,
          credentials.password
        )
        return this._create_auth_result({
          platform: 'espn',
          auth_type: 'cookie_based',
          credentials: cookies,
          expires_at: null,
          public_leagues: true,
          private_leagues: true
        })
      } catch (error) {
        throw new Error(`ESPN login authentication failed: ${error.message}`)
      }
    }

    // No credentials provided - public leagues only
    return this._create_auth_result({
      platform: 'espn',
      auth_type: 'none',
      credentials: null,
      expires_at: null,
      public_leagues: true,
      private_leagues: false
    })
  }

  /**
   * Yahoo authentication using OAuth2 flow
   * @param {Object} credentials - Yahoo OAuth credentials
   * @param {string} credentials.client_id - Yahoo app client ID
   * @param {string} credentials.client_secret - Yahoo app client secret
   * @param {string} [credentials.access_token] - Existing access token
   * @param {string} [credentials.refresh_token] - Refresh token
   * @returns {Promise<Object>} Authentication result
   */
  async _authenticate_yahoo(credentials) {
    if (!credentials.client_id || !credentials.client_secret) {
      throw new Error(
        'Yahoo authentication requires client_id and client_secret'
      )
    }

    // If we have existing tokens, validate them
    if (credentials.access_token) {
      try {
        const token_info = await this._validate_yahoo_token(
          credentials.access_token
        )
        if (token_info.valid) {
          return this._create_auth_result({
            platform: 'yahoo',
            auth_type: 'oauth2',
            credentials: {
              access_token: credentials.access_token,
              refresh_token: credentials.refresh_token,
              client_id: credentials.client_id,
              client_secret: credentials.client_secret
            },
            expires_at: token_info.expires_at,
            public_leagues: false,
            private_leagues: true
          })
        }
      } catch (error) {
        log(
          'Yahoo token validation failed, will need re-authentication: %s',
          error.message
        )
      }
    }

    // If we have refresh token, try to refresh
    if (credentials.refresh_token) {
      try {
        const new_tokens = await this._refresh_yahoo_token(
          credentials.refresh_token,
          credentials.client_id,
          credentials.client_secret
        )
        return this._create_auth_result({
          platform: 'yahoo',
          auth_type: 'oauth2',
          credentials: {
            access_token: new_tokens.access_token,
            refresh_token:
              new_tokens.refresh_token || credentials.refresh_token,
            client_id: credentials.client_id,
            client_secret: credentials.client_secret
          },
          expires_at: new_tokens.expires_at,
          public_leagues: false,
          private_leagues: true
        })
      } catch (error) {
        throw new Error(`Yahoo token refresh failed: ${error.message}`)
      }
    }

    // Need full OAuth flow - return authorization URL
    const auth_url = this._get_yahoo_auth_url(credentials.client_id)
    throw new Error(`Yahoo requires OAuth authorization. Visit: ${auth_url}`)
  }

  /**
   * MFL authentication using API key
   * @param {Object} credentials - MFL credentials
   * @param {string} [credentials.api_key] - MFL API key
   * @param {string} [credentials.username] - MFL username (alternative)
   * @param {string} [credentials.password] - MFL password (alternative)
   * @returns {Promise<Object>} Authentication result
   */
  async _authenticate_mfl(credentials) {
    // API key authentication (preferred)
    if (credentials.api_key) {
      try {
        await this._validate_mfl_api_key(credentials.api_key)
        return this._create_auth_result({
          platform: 'mfl',
          auth_type: 'api_key',
          credentials: {
            api_key: credentials.api_key
          },
          expires_at: null, // MFL API keys don't expire
          public_leagues: true,
          private_leagues: true
        })
      } catch (error) {
        throw new Error(`MFL API key validation failed: ${error.message}`)
      }
    }

    // Username/password authentication (legacy)
    if (credentials.username && credentials.password) {
      try {
        const api_key = await this._get_mfl_api_key_via_login(
          credentials.username,
          credentials.password
        )
        return this._create_auth_result({
          platform: 'mfl',
          auth_type: 'api_key',
          credentials: {
            api_key,
            username: credentials.username
          },
          expires_at: null,
          public_leagues: true,
          private_leagues: true
        })
      } catch (error) {
        throw new Error(`MFL login authentication failed: ${error.message}`)
      }
    }

    // No credentials - public leagues only (limited functionality)
    return this._create_auth_result({
      platform: 'mfl',
      auth_type: 'none',
      credentials: null,
      expires_at: null,
      public_leagues: true,
      private_leagues: false
    })
  }

  /**
   * Fleaflicker authentication (no auth required)
   * @param {Object} credentials - Not used
   * @returns {Promise<Object>} Authentication result
   */
  async _authenticate_fleaflicker(credentials) {
    return this._create_auth_result({
      platform: 'fleaflicker',
      auth_type: 'none',
      credentials: null,
      expires_at: null,
      public_leagues: true,
      private_leagues: false // Fleaflicker doesn't support private league API access
    })
  }

  /**
   * ESPN cookie authentication via login flow
   * @param {string} username - ESPN username
   * @param {string} password - ESPN password
   * @returns {Promise<Object>} ESPN cookies {espn_s2, swid}
   */
  async _get_espn_cookies_via_login(username, password) {
    // Step 1: Get API key
    const api_key_response = await fetch(
      'https://registerdisney.go.com/jgc/v5/client/ESPN-FANTASYLM-PROD/api-key?langPref=en-US',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'https://cdn.registerdisney.go.com'
        }
      }
    )

    const api_key = api_key_response.headers.get('api-key')
    if (!api_key) {
      throw new Error('Failed to obtain ESPN API key')
    }

    // Step 2: Login with credentials
    const login_response = await fetch(
      'https://registerdisney.go.com/jgc/v5/client/ESPN-FANTASYLM-PROD/guest/login?langPref=en-US',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `APIKEY ${api_key}`,
          Origin: 'https://cdn.registerdisney.go.com'
        },
        body: JSON.stringify({
          loginValue: username,
          password
        })
      }
    )

    const login_data = await login_response.json()

    if (!login_data.data || !login_data.data.s2 || !login_data.data.profile) {
      throw new Error('Invalid ESPN credentials or login failed')
    }

    return {
      espn_s2: login_data.data.s2,
      swid: login_data.data.profile.swid
    }
  }

  /**
   * Validate Yahoo OAuth token
   * @param {string} access_token - Yahoo access token
   * @returns {Promise<Object>} Token validation result
   */
  async _validate_yahoo_token(access_token) {
    try {
      const response = await fetch(
        'https://api.login.yahoo.com/openid/v1/userinfo',
        {
          headers: {
            Authorization: `Bearer ${access_token}`
          }
        }
      )

      if (response.ok) {
        return {
          valid: true,
          expires_at: Date.now() + 3600 * 1000 // Assume 1 hour if not specified
        }
      }

      return { valid: false }
    } catch (error) {
      return { valid: false }
    }
  }

  /**
   * Refresh Yahoo OAuth token
   * @param {string} refresh_token - Yahoo refresh token
   * @param {string} client_id - Yahoo client ID
   * @param {string} client_secret - Yahoo client secret
   * @returns {Promise<Object>} New tokens
   */
  async _refresh_yahoo_token(refresh_token, client_id, client_secret) {
    const response = await fetch(
      'https://api.login.yahoo.com/oauth2/get_token',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${Buffer.from(`${client_id}:${client_secret}`).toString('base64')}`
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token
        })
      }
    )

    const data = await response.json()

    if (!response.ok || !data.access_token) {
      throw new Error(
        `Token refresh failed: ${data.error_description || 'Unknown error'}`
      )
    }

    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: Date.now() + data.expires_in * 1000
    }
  }

  /**
   * Get Yahoo OAuth authorization URL
   * @param {string} client_id - Yahoo client ID
   * @returns {string} Authorization URL
   */
  _get_yahoo_auth_url(client_id) {
    const params = new URLSearchParams({
      client_id,
      redirect_uri: 'oob', // Out-of-band for desktop apps
      response_type: 'code',
      scope: 'openid profile email',
      state: Math.random().toString(36).substring(7)
    })

    return `https://api.login.yahoo.com/oauth2/request_auth?${params.toString()}`
  }

  /**
   * Validate MFL API key
   * @param {string} api_key - MFL API key
   * @returns {Promise<void>} Throws if invalid
   */
  async _validate_mfl_api_key(api_key) {
    const current_year = new Date().getFullYear()
    const response = await fetch(
      `https://api.myfantasyleague.com/${current_year}/export?TYPE=league&JSON=1&APIKEY=${api_key}`
    )

    if (!response.ok) {
      throw new Error(`MFL API key validation failed: HTTP ${response.status}`)
    }

    const data = await response.json()
    if (data.error) {
      throw new Error(`MFL API key validation failed: ${data.error}`)
    }
  }

  /**
   * Get MFL API key via username/password login
   * @param {string} username - MFL username
   * @param {string} password - MFL password
   * @returns {Promise<string>} API key
   */
  async _get_mfl_api_key_via_login(username, password) {
    const current_year = new Date().getFullYear()
    const response = await fetch(
      `https://api.myfantasyleague.com/${current_year}/export`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          TYPE: 'login',
          USERNAME: username,
          PASSWORD: password,
          JSON: 1
        })
      }
    )

    const data = await response.json()

    if (!response.ok || data.error) {
      throw new Error(`MFL login failed: ${data.error || 'Unknown error'}`)
    }

    if (!data.apikey) {
      throw new Error('MFL login succeeded but no API key returned')
    }

    return data.apikey
  }

  /**
   * Get cached authentication for platform
   * @param {string} platform - Platform identifier
   * @returns {Object|null} Cached auth data or null
   */
  get_cached_auth(platform) {
    const cached = this.auth_cache.get(platform)
    if (!cached) return null

    // Check if cached auth is expired
    if (cached.expires_at && Date.now() >= cached.expires_at) {
      this.auth_cache.delete(platform)
      return null
    }

    return cached
  }

  /**
   * Cache authentication result
   * @param {string} platform - Platform identifier
   * @param {Object} auth_result - Authentication result to cache
   */
  cache_auth(platform, auth_result) {
    this.auth_cache.set(platform, {
      ...auth_result,
      cached_at: Date.now()
    })
  }

  /**
   * Clear authentication cache
   * @param {string} [platform] - Specific platform to clear, or all if not specified
   */
  clear_cache(platform = null) {
    if (platform) {
      this.auth_cache.delete(platform)
      this.refresh_tokens.delete(platform)
    } else {
      this.auth_cache.clear()
      this.refresh_tokens.clear()
    }
  }

  /**
   * Get authentication status for all cached platforms
   * @returns {Object} Authentication status by platform
   */
  get_auth_status() {
    const status = {}

    for (const [platform, auth_data] of this.auth_cache.entries()) {
      status[platform] = {
        authenticated: true,
        auth_type: auth_data.auth_type,
        expires_at: auth_data.expires_at,
        expired: auth_data.expires_at
          ? Date.now() >= auth_data.expires_at
          : false,
        public_leagues: auth_data.public_leagues,
        private_leagues: auth_data.private_leagues,
        cached_at: auth_data.cached_at
      }
    }

    return status
  }
}

// Export singleton instance
export const platform_authenticator = new PlatformAuthenticator()
