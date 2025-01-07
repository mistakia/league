import debug from 'debug'
import fetch from 'node-fetch'

const log = debug('fetch')

export default async function fetch_with_retry({
  url,
  max_retries = 3,
  initial_delay = 10000,
  response_type,
  ...fetch_options
}) {
  for (let attempt = 1; attempt <= max_retries; attempt++) {
    try {
      const response = await fetch(url, fetch_options)

      if (!response.ok) {
        throw new Error(`unexpected response ${response.statusText}`)
      }

      if (!response_type) {
        return response
      }

      return await response[response_type]()
    } catch (error) {
      log(`Attempt ${attempt}/${max_retries} failed:`, error.message)

      if (attempt === max_retries) {
        throw error
      }

      const delay = initial_delay * Math.pow(2, attempt - 1)
      log(`Retrying in ${delay}ms...`)
      await new Promise((resolve) => setTimeout(resolve, delay))
    }
  }
}
