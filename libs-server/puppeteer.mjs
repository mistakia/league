import puppeteer from 'puppeteer-extra'
import StealthPlugin from 'puppeteer-extra-plugin-stealth'
import AnonymizeUaPlugin from 'puppeteer-extra-plugin-anonymize-ua'
import os from 'os'
import child_process from 'child_process'
import fs from 'fs'

puppeteer.use(AnonymizeUaPlugin())

// Helper function to parse cookie string into an array of cookie objects
function parseCookieString({ cookie_string, cookie_domain }) {
  return cookie_string.split('; ').map((cookie) => {
    const [name, value] = cookie.split('=')
    return { name, value, domain: '.pff.com' }
  })
}

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
    headless = true,
    random_viewport = true,
    random_user_agent = true,
    cookie_string = '',
    cookie_domain,
    executable_path = '',
    use_stealth = false,
    cookies,
    local_storage,
    user_data_dir,
    connect = false,
    remote_debugging_port = 9222
  } = {}
) => {
  if (use_stealth) {
    puppeteer.use(StealthPlugin())
  }

  let browser
  if (connect) {
    browser = await connectToChrome({
      remote_debugging_port,
      executable_path,
      user_data_dir
    })
  } else {
    browser = await puppeteer.launch({
      headless: headless ? 'new' : false,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-infobars',
        '--window-position=0,0',
        '--ignore-certifcate-errors',
        '--ignore-certifcate-errors-spki-list',
        '--max-http-header-size=16384',
        ...(user_data_dir ? [`--user-data-dir=${user_data_dir}`] : [])
      ],
      timeout,
      ignoreDefaultArgs: ['--enable-automation'],
      executablePath: executable_path,
      userDataDir: user_data_dir
    })
  }

  const page = await browser.newPage()

  // Randomize viewport size
  if (random_viewport) {
    await page.setViewport({
      width: 1300 + Math.floor(Math.random() * 100),
      height: 500 + Math.floor(Math.random() * 100),
      deviceScaleFactor: 1,
      hasTouch: false,
      isLandscape: false,
      isMobile: false
    })
  }

  if (random_user_agent) {
    await page.setUserAgent(chromeUserAgent)
  }

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

      // Additional webdriver evasion
      // eslint-disable-next-line no-proto
      const new_proto = navigator.__proto__
      delete new_proto.webdriver
      // eslint-disable-next-line no-proto
      navigator.__proto__ = new_proto
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
      // Additional notification evasion
      if (!window.Notification) {
        window.Notification = {
          permission: 'denied'
        }
      }

      const old_call = Function.prototype.call
      function call() {
        return old_call.apply(this, arguments)
      }
      // eslint-disable-next-line no-extend-native
      Function.prototype.call = call

      const native_to_string_function_string = Error.toString().replace(
        /Error/g,
        'toString'
      )
      const old_to_string = Function.prototype.toString

      function function_to_string() {
        if (this === window.navigator.permissions.query) {
          return 'function query() { [native code] }'
        }
        if (this === function_to_string) {
          return native_to_string_function_string
        }
        return old_call.call(old_to_string, this)
      }
      // eslint-disable-next-line no-extend-native
      Function.prototype.toString = function_to_string
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

  if (cookie_string && cookie_domain) {
    const cookies = parseCookieString({ cookie_string, cookie_domain })
    await page.setCookie(...cookies)
  }

  if (cookies) {
    await page.setCookie(...cookies)
  }

  await page._client().send('Network.enable', {
    maxResourceBufferSize: 1024 * 1204 * 100,
    maxTotalBufferSize: 1024 * 1204 * 200
  })

  await page.goto(url)

  // Restore localStorage if it exists
  if (local_storage) {
    await page.evaluate((storage_data) => {
      for (const [key, value] of Object.entries(storage_data)) {
        localStorage.setItem(key, value)
      }
    }, local_storage)
  }

  await page.goto(url)

  return { page, browser }
}

async function connectToChrome({
  remote_debugging_port,
  executable_path,
  user_data_dir
}) {
  try {
    // Try to connect to an existing Chrome instance
    return await puppeteer.connect({
      browserURL: `http://127.0.0.1:${remote_debugging_port}`,
      defaultViewport: null
    })
  } catch (error) {
    console.log('No existing Chrome instance found. Launching a new one...')

    // Launch a new Chrome instance with remote debugging enabled
    const chrome_args = [
      `--remote-debugging-port=${remote_debugging_port}`,
      '--no-first-run',
      '--no-default-browser-check',
      ...(user_data_dir ? [`--user-data-dir=${user_data_dir}`] : [])
    ]

    const chrome_process = child_process.spawn(
      executable_path || findChromePath(),
      chrome_args,
      { detached: true, stdio: 'ignore' }
    )
    chrome_process.unref()

    // Wait for Chrome to start and then connect
    await new Promise((resolve) => setTimeout(resolve, 1000))
    return await puppeteer.connect({
      browserURL: `http://127.0.0.1:${remote_debugging_port}`,
      defaultViewport: null
    })
  }
}

function findChromePath() {
  const possible_paths = [
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
  ]

  for (const path of possible_paths) {
    if (fs.existsSync(path)) {
      return path
    }
  }

  throw new Error(
    'Chrome executable not found. Please specify the path manually.'
  )
}
