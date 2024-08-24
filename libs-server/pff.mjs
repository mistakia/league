import { puppeteer } from '#libs-server'
import debug from 'debug'
import db from '#db'

const log = debug('pff')

export const get_pff_session_cookie = async () => {
  // Get the current config from the database
  const config_row = await db('config').where({ key: 'pff_login' }).first()
  if (!config_row) {
    throw new Error('PFF login config not found')
  }
  log('config_row', config_row)

  const pff_login_config = config_row.value

  if (!pff_login_config.cookie) {
    throw new Error('PFF login cookie not found')
  }

  // Launch a new page with Puppeteer
  const { page, browser } = await puppeteer.getPage(pff_login_config.url, {
    headless: true
  })

  // Set the initial cookies
  await page.setCookie(...parseCookieString(pff_login_config.cookie))

  // Navigate to the homepage and wait for 10 seconds
  await page.goto(pff_login_config.url)
  await page.waitForTimeout(10000)

  // Check if the login button exists
  const login_button = await page.$('#main_nav_link')

  if (login_button) {
    // If login button exists, click it and wait for 10 seconds
    await login_button.click()
    await page.waitForTimeout(10000)
  } else {
    log('Already logged in, no login button found')
  }

  // Get all cookies after navigation (or if already logged in)
  const cookies = await page.cookies()
  const new_cookies = cookies
    .map((cookie) => `${cookie.name}=${cookie.value}`)
    .join('; ')

  log('new_cookies', new_cookies)

  // Close the browser
  await browser.close()

  // Update the config in the database only if there are cookies
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

// Helper function to parse cookie string into an array of cookie objects
function parseCookieString(cookie_string) {
  return cookie_string.split('; ').map((cookie) => {
    const [name, value] = cookie.split('=')
    return { name, value, domain: '.pff.com' }
  })
}
