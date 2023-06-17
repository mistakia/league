import puppeteer from 'puppeteer-extra'
import StealthPlugin from 'puppeteer-extra-plugin-stealth'
import AnonymizeUaPlugin from 'puppeteer-extra-plugin-anonymize-ua'
import os from 'os'

puppeteer.use(StealthPlugin())
puppeteer.use(AnonymizeUaPlugin())

/*
 * @title user-agents-generator 🚀
 * @desc 📝 A Minimal Package to Generate unlimited user agents 🚀
 * @version 1.0.0
 * @author 🧑‍💻 DropOutLab <dropoutlab@gmail.com>
 * @license MIT
 */
const userAgentGenerator = {
  chrome: function () {
    const chromeVersion = Math.floor(Math.random() * 20) + 60
    const webkitVersion = Math.floor(Math.random() * 700) + 500
    const osPlatform =
      os.platform() === 'win32'
        ? 'Win64; x64'
        : 'Macintosh; Intel Mac OS X 10_15_0'
    const userAgent = `Mozilla/5.0 (${osPlatform}) AppleWebKit/${webkitVersion}.36 (KHTML, like Gecko) Chrome/${chromeVersion}.0.3163.100 Safari/${webkitVersion}.36`
    return userAgent
  },
  firefox: function () {
    const firefoxVersion = Math.floor(Math.random() * 5) + 55
    const geckoVersion = Math.floor(Math.random() * 30) + 20100101
    const osPlatform =
      os.platform() === 'win32'
        ? 'Win64; x64'
        : 'Macintosh; Intel Mac OS X 10_15_0'
    const userAgent = `Mozilla/5.0 (${osPlatform}; rv: ${firefoxVersion}.0) Gecko/${geckoVersion} Firefox/${firefoxVersion}.0`
    return userAgent
  },
  safari: function () {
    const safariVersion = Math.floor(Math.random() * 5) + 10
    const osPlatform =
      os.platform() === 'win32'
        ? 'Win64; x64'
        : 'Macintosh; Intel Mac OS X 10_15_0'
    const userAgent = `Mozilla/5.0 (${osPlatform}) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/${safariVersion}.1.15 Safari/605.1.15`
    return userAgent
  },
  android: function () {
    const androidVersion = Math.floor(Math.random() * 5) + 5
    const chromeVersion = Math.floor(Math.random() * 20) + 60
    const webkitVersion = Math.floor(Math.random() * 700) + 500
    const osPlatform = `Linux; Android ${androidVersion}.${Math.floor(
      Math.random() * 10
    )}; en-us; Nexus 6 Build/LYZ28M) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVersion}.0.3163.98 Mobile Safari/${webkitVersion}.36`
    const userAgent = `Mozilla/5.0 (${osPlatform}`
    return userAgent
  },
  ios: function () {
    const iosVersion = Math.floor(Math.random() * 5) + 9
    const safariVersion = Math.floor(Math.random() * 5) + 600
    const webkitVersion = Math.floor(Math.random() * 700) + 500
    const osPlatform = `CPU iPhone OS ${iosVersion}_${Math.floor(
      Math.random() * 10
    )} like Mac OS X) AppleWebKit/${webkitVersion}.60 (KHTML, like Gecko) Version/${safariVersion}.0 Mobile/15E148 Safari/${webkitVersion}.60`
    const userAgent = `Mozilla/5.0 (${osPlatform}`
    return userAgent
  }
}
const chromeUserAgent = userAgentGenerator.chrome()

export const getPage = async (
  url,
  {
    webdriver = true,
    chrome = true,
    notifications = true,
    plugins = true,
    languages = true,
    timeout = 90000,
    headless = true
  } = {}
) => {
  const args = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-infobars',
    '--window-position=0,0',
    '--ignore-certifcate-errors',
    '--ignore-certifcate-errors-spki-list',
    `--user-agent="${chromeUserAgent}"`
  ]
  const browser = await puppeteer.launch({
    headless: headless ? 'new' : false,
    args,
    timeout,
    ignoreDefaultArgs: ['--enable-automation']
  })

  const page = await browser.newPage()

  // Randomize viewport size
  await page.setViewport({
    width: 1300 + Math.floor(Math.random() * 100),
    height: 500 + Math.floor(Math.random() * 100),
    deviceScaleFactor: 1,
    hasTouch: false,
    isLandscape: false,
    isMobile: false
  })

  await page.setUserAgent(chromeUserAgent)
  await page.setJavaScriptEnabled(true)
  await page.setDefaultNavigationTimeout(timeout)

  // Skip images/styles/fonts loading for performance
  /* await page.setRequestInterception(true)
   * page.on('request', (req) => {
   *   if (
   *     req.resourceType() == 'stylesheet' ||
   *     req.resourceType() == 'font' ||
   *     req.resourceType() == 'image'
   *   ) {
   *     req.abort()
   *   } else {
   *     req.continue()
   *   }
   * })
   */

  if (webdriver) {
    await page.evaluateOnNewDocument(() => {
      // Pass webdriver check
      Object.defineProperty(navigator, 'webdriver', {
        get: () => false
      })
    })
  }

  if (chrome) {
    await page.evaluateOnNewDocument(() => {
      // Pass chrome check
      window.chrome = {
        runtime: {}
        // etc.
      }
    })
  }

  if (notifications) {
    await page.evaluateOnNewDocument(() => {
      // Pass notifications check
      const originalQuery = window.navigator.permissions.query
      return (window.navigator.permissions.query = (parameters) =>
        parameters.name === 'notifications'
          ? Promise.resolve({ state: Notification.permission })
          : originalQuery(parameters))
    })
  }

  if (plugins) {
    await page.evaluateOnNewDocument(() => {
      // Overwrite the `plugins` property to use a custom getter.
      Object.defineProperty(navigator, 'plugins', {
        // This just needs to have `length > 0` for the current test,
        // but we could mock the plugins too if necessary.
        get: () => [1, 2, 3, 4, 5]
      })
    })
  }

  if (languages) {
    await page.evaluateOnNewDocument(() => {
      // Overwrite the `languages` property to use a custom getter.
      Object.defineProperty(navigator, 'languages', {
        get: () => ['en-US', 'en']
      })
    })
  }

  await page.goto(url)

  return { page, browser }
}
