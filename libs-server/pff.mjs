import { puppeteer, wait } from '#libs-server'
import debug from 'debug'
import db from '#db'
import { constants } from '#libs-shared'
import fetch from 'node-fetch'
import * as cache from './cache.mjs'

const log = debug('pff')

export const positions = [
  'QB',
  'HB',
  'WR',
  'FB',
  'TE',
  'C',
  'G',
  'T',
  'CB',
  'S',
  'LB',
  'DI',
  'ED',
  'K',
  'P'
]

export const years = Array.from(
  { length: constants.season.year - 2006 + 1 },
  (_, index) => 2006 + index
)

export const get_pff_week = () => {
  if (constants.season.nfl_seas_type === 'POST') {
    const week = constants.season.nfl_seas_week
    switch (week) {
      case 1:
        return 28
      case 2:
        return 29
      case 3:
        return 30
      default:
        throw new Error(`Unknown pff week: ${week}`)
    }
  }

  return constants.season.nfl_seas_week
}

export const get_pff_session_cookie = async ({ executable_path } = {}) => {
  // Get the current config from the database
  const config_row = await db('config').where({ key: 'pff_config' }).first()
  if (!config_row) {
    throw new Error('PFF login config not found')
  }

  const pff_login_config = config_row.value

  if (!pff_login_config.cookie) {
    throw new Error('PFF login cookie not found')
  }

  // Launch a new page with Puppeteer
  const { page, browser } = await puppeteer.getPage(pff_login_config.url, {
    headless: false,
    executable_path,
    random_user_agent: false,
    random_viewport: false,
    use_stealth: true,
    user_data_dir: './tmp/puppeteer_user_data',
    cookie_string: pff_login_config.cookie,
    cookie_domain: '.pff.com',
    connect: true,
    remote_debugging_port: 9222
  })

  // Navigate to the homepage and wait for 10 seconds
  // await page.goto(pff_login_config.url)
  await wait(10000)

  // Check if the login button exists
  const login_button = await page.$(
    '[data-gtm-id="main_nav"] .site-nav__cta [data-gtm-id="main_nav_link"]'
  )

  if (login_button) {
    // If login button exists, click it and wait for 10 seconds
    await login_button.click()
    log('clicked login button')
    await wait(10000)

    // Check if the page has navigated to the sign-in form
    const sign_in_header = await page.$('header.signup-form-header')
    if (sign_in_header) {
      log('Sign-in form detected, entering login info')

      await page.type('#login-form_email', pff_login_config.email, {
        delay: 100
      })

      await page.type('#login-form_password', pff_login_config.password, {
        delay: 100
      })

      const submit_button = await page.$('#sign-in')
      if (submit_button) {
        await submit_button.click()
        log('Submitted login form')
        await wait(10000)
      } else {
        log('Submit button not found')
      }
    } else {
      log('Sign-in form not detected after clicking login button')
    }
  } else {
    log('Already logged in, no login button found')
  }

  // Get all cookies after navigation (or if already logged in)
  const cookies = await page.cookies()
  const new_cookies = cookies
    .map((cookie) => `${cookie.name}=${cookie.value}`)
    .join('; ')

  log('new_cookies', new_cookies)

  await browser.close()

  if (new_cookies) {
    const updated_config = { ...pff_login_config, cookie: new_cookies }
    await db('config')
      .where({ key: 'pff_login' })
      .update({ value: updated_config })
      .onConflict('key')
      .merge()
  } else {
    log('No cookies found, skipping database update')
  }

  return new_cookies
}

export const get_pff_player_seasonlogs = async ({
  year,
  position,
  cookie,
  grades_url,
  ignore_cache
}) => {
  const cache_key = `/pff/player_seasonlogs/${year}/${position}.json`

  if (!ignore_cache) {
    const cached_data = await cache.get({ key: cache_key })
    if (cached_data) {
      log(
        `cache hit for PFF player seasonlogs: year=${year}, position=${position}`
      )
      return cached_data
    }
  }

  const url = `${grades_url}?league=nfl&position=${position}&season=${year}`
  log(`Fetching PFF player seasonlogs from ${url}`)
  const response = await fetch(url, {
    headers: {
      cookie
    }
  })

  const data = await response.json()

  if (!data || !data.players) {
    throw new Error('No players found')
  }

  log(
    `Fetched ${data.players.length} player seasonlogs for ${position} in ${year}`
  )

  if (data.players.length) {
    await cache.set({ key: cache_key, value: data })
  }

  return data
}
