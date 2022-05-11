import config from '#config'
import FormData from 'form-data'
import fetch from 'node-fetch'

const getToken = async () => {
  const form = new FormData()
  form.append('grant_type', 'client_credentials')
  const data = await fetch(`${config.nfl_api_url}/v1/reroute`, {
    method: 'POST',
    body: form,
    headers: {
      origin: 'https://www.nfl.com',
      referer: 'https://www.nfl.com/scores/',
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/85.0.4183.83 Safari/537.36',
      'x-domain-id': '100'
    }
  }).then((res) => res.json())

  return data.access_token
}

export default getToken
