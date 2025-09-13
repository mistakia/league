import { chromium } from 'playwright'
import debug from 'debug'

import db from '#db'
import { wait } from './wait.mjs'

const log = debug('fanduel-session-manager')
debug.enable('fanduel-session-manager')

const FANDUEL_CONFIG_KEY = 'fanduel_config'
const FANDUEL_SPORTSBOOK_URL = 'https://sportsbook.fanduel.com/navigation/nfl'
const SESSION_EXPIRY_MINUTES = 15

const get_fanduel_api_base_url = async () => {
  const config_row = await db('config').where('key', FANDUEL_CONFIG_KEY).first()
  const fanduel_config = config_row?.value || {}
  return fanduel_config.api_url || 'https://sbapi.dc.sportsbook.fanduel.com/api'
}

export class FanDuelSessionManager {
  constructor() {
    this.browser_instance = null
    this.page_instance = null
  }

  async get_fanduel_config() {
    const config_row = await db('config')
      .where('key', FANDUEL_CONFIG_KEY)
      .first()
    return config_row?.value || {}
  }

  async update_fanduel_config({ config_updates }) {
    const current_fanduel_config = await this.get_fanduel_config()
    const updated_fanduel_config = {
      ...current_fanduel_config,
      ...config_updates
    }

    await db('config').where('key', FANDUEL_CONFIG_KEY).update({
      value: updated_fanduel_config,
      updated_at: new Date()
    })

    return updated_fanduel_config
  }

  async launch_browser_for_session_capture() {
    log('Launching browser for FanDuel session capture')

    this.browser_instance = await chromium.launch({
      headless: false,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor'
      ]
    })

    // Create context with user agent
    const context = await this.browser_instance.newContext({
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1920, height: 1080 }
    })

    this.page_instance = await context.newPage()
  }

  async capture_fanduel_session_headers() {
    if (!this.page_instance) {
      throw new Error(
        'Browser not launched. Call launch_browser_for_session_capture() first.'
      )
    }

    log('Setting up network request interception for FanDuel headers')

    let captured_fanduel_headers = null

    await this.page_instance.route('**/*', async (route, request) => {
      const request_url = request.url()

      if (
        request_url.includes('sportsbook.fanduel.com/api') ||
        request_url.includes('sbapi.')
      ) {
        const request_headers = request.headers()

        captured_fanduel_headers = { ...request_headers }

        log(`Captured FanDuel headers from ${request_url}`)
        log(`Headers: ${JSON.stringify(request_headers, null, 2)}`)
      }

      await route.continue()
    })

    log('Navigating to FanDuel sportsbook')
    await this.page_instance.goto(FANDUEL_SPORTSBOOK_URL, {
      waitUntil: 'networkidle',
      timeout: 30000
    })

    await wait(5000)

    try {
      const game_element_selectors =
        '[data-testid*="event"], [data-testid*="game"], .event-card, .game-card'
      const game_elements = await this.page_instance
        .locator(game_element_selectors)
        .first()
      if ((await game_elements.count()) > 0) {
        log('Clicking on game element to trigger FanDuel API calls')
        await game_elements.click()
        await wait(3000)
      }
    } catch (error) {
      log(`Error interacting with FanDuel page elements: ${error.message}`)
    }

    return {
      captured_fanduel_headers
    }
  }

  async validate_fanduel_session({ fanduel_headers }) {
    if (!fanduel_headers) {
      log('No FanDuel headers provided for validation')
      return false
    }

    try {
      const fanduel_api_base_url = await get_fanduel_api_base_url()
      const fanduel_test_url = `${fanduel_api_base_url}/content-managed-page?betexRegion=GBR&capiJurisdiction=intl&currencyCode=USD&exchangeLocale=en_US&includePrices=true&includeRaceCards=false&includeSeo=true&language=en&regionCode=NAMERICA&timezone=America%2FNew_York&includeMarketBlurbs=true&page=CUSTOM&customPageId=nfl&_ak=FhMFpcPWXMeyZxOx`

      const validation_response = await fetch(fanduel_test_url, {
        headers: fanduel_headers,
        method: 'GET'
      })

      const is_session_valid =
        validation_response.ok && validation_response.status === 200
      log(
        `FanDuel session validation ${is_session_valid ? 'PASSED' : 'FAILED'} - Status: ${validation_response.status}`
      )

      return is_session_valid
    } catch (error) {
      log(`FanDuel session validation error: ${error.message}`)
      return false
    }
  }

  async store_fanduel_session_data({
    fanduel_headers,
    is_session_valid = false
  }) {
    const current_timestamp = new Date().toISOString()

    const fanduel_config_updates = {
      v3_session_headers: fanduel_headers,
      v3_session_valid: is_session_valid,
      v3_last_refresh: current_timestamp
    }

    await this.update_fanduel_config({ config_updates: fanduel_config_updates })
    log('FanDuel session data stored in database')

    return fanduel_config_updates
  }

  async cleanup_browser_resources() {
    if (this.page_instance) {
      await this.page_instance.close()
      this.page_instance = null
    }

    if (this.browser_instance) {
      await this.browser_instance.close()
      this.browser_instance = null
    }

    log('Browser resources cleanup completed')
  }

  async check_if_fanduel_session_needs_refresh() {
    const fanduel_config = await this.get_fanduel_config()

    if (!fanduel_config.v3_session_headers) {
      log('No FanDuel V3 session headers found - refresh needed')
      return true
    }

    if (!fanduel_config.v3_session_valid) {
      log('FanDuel V3 session marked as invalid - refresh needed')
      return true
    }

    const last_refresh = fanduel_config.v3_last_refresh
    if (last_refresh) {
      const refresh_age_minutes =
        (Date.now() - new Date(last_refresh).getTime()) / (1000 * 60)
      if (refresh_age_minutes > SESSION_EXPIRY_MINUTES) {
        log(
          `FanDuel V3 session is ${refresh_age_minutes.toFixed(1)} minutes old - refresh needed`
        )
        return true
      }
    }

    log('FanDuel V3 session appears valid - no refresh needed')
    return false
  }

  async mark_fanduel_session_as_failed() {
    await this.update_fanduel_config({
      config_updates: {
        v3_session_valid: false
      }
    })

    log('FanDuel session marked as failed')
  }

  async refresh_fanduel_session() {
    try {
      log('Starting FanDuel session refresh workflow')

      await this.launch_browser_for_session_capture()
      const { captured_fanduel_headers } =
        await this.capture_fanduel_session_headers()

      if (!captured_fanduel_headers) {
        throw new Error('Failed to capture FanDuel session headers')
      }

      const is_session_valid = await this.validate_fanduel_session({
        fanduel_headers: captured_fanduel_headers
      })

      await this.store_fanduel_session_data({
        fanduel_headers: captured_fanduel_headers,
        is_session_valid
      })

      log(`FanDuel session refresh completed. Valid: ${is_session_valid}`)
      return is_session_valid
    } catch (error) {
      log(`FanDuel session refresh failed: ${error.message}`)
      throw error
    } finally {
      await this.cleanup_browser_resources()
    }
  }

  async ensure_fresh_session() {
    const fanduel_config = await this.get_fanduel_config()

    if (!fanduel_config.v3_last_refresh) {
      log('No session refresh timestamp - triggering refresh')
      await this.refresh_fanduel_session()
      return
    }

    const last_refresh = new Date(fanduel_config.v3_last_refresh).getTime()
    const age_minutes = (Date.now() - last_refresh) / (1000 * 60)
    const proactive_refresh_minutes = SESSION_EXPIRY_MINUTES * 0.8 // Refresh at 80% of expiry time

    if (age_minutes > proactive_refresh_minutes) {
      log(
        `Session is ${age_minutes.toFixed(1)} minutes old - proactive refresh at ${proactive_refresh_minutes} minutes`
      )
      await this.refresh_fanduel_session()
    }
  }

  async get_valid_fanduel_session_headers() {
    const fanduel_config = await this.get_fanduel_config()

    if (await this.check_if_fanduel_session_needs_refresh()) {
      log('FanDuel session refresh required before getting headers')
      const refresh_success = await this.refresh_fanduel_session()
      if (!refresh_success) {
        throw new Error('Failed to refresh FanDuel session')
      }

      const updated_fanduel_config = await this.get_fanduel_config()
      return updated_fanduel_config.v3_session_headers
    }

    return fanduel_config.v3_session_headers
  }
}

export const fanduel_session_manager = new FanDuelSessionManager()
