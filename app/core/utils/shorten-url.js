import { api_request } from '@core/api/service'

import { API_URL } from '@core/constants'

// TODO use token
export async function shorten_url(url) {
  const shorten_url_api = (data) => ({
    url: `${API_URL}/u`,
    ...POST(data)
  })

  const { request } = api_request(shorten_url_api, { url })

  try {
    const response = await request()
    return response
  } catch (error) {
    console.error('Error shortening URL:', error)
    throw error
  }
}

export default shorten_url

export function get_shortened_url({ hash }) {
  const get_shortened_url_api = () => ({
    url: `${API_URL}/u/${hash}`
  })

  return api_request(get_shortened_url_api)
}

const POST = (data) => ({
  method: 'POST',
  body: JSON.stringify(data),
  headers: {
    'Content-Type': 'application/json'
  }
})
