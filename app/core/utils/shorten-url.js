import { apiRequest } from '@core/api/service'

import { BASE_URL } from '@core/constants'

// TODO use token
export default async function shorten_url(url) {
  const shorten_url_api = (data) => ({
    url: `${BASE_URL}/u`,
    ...POST(data)
  })

  const { request } = apiRequest(shorten_url_api, { url })

  try {
    const response = await request()
    return response
  } catch (error) {
    console.error('Error shortening URL:', error)
    throw error
  }
}

const POST = (data) => ({
  method: 'POST',
  body: JSON.stringify(data),
  headers: {
    'Content-Type': 'application/json'
  }
})
