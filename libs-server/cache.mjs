import jwt from 'jsonwebtoken'
import config from '#config'
import { fetch_with_retry } from './proxy-manager.mjs'

// The cache write endpoint is admin-gated (userId === 1) and verifies the bearer
// token with config.jwt.secret (api/routes/cache.mjs, expressjwt in api/index.mjs).
// Sign a fresh admin token per request rather than carrying a static one in
// config: a hard-coded token stops verifying on every jwt.secret rotation — the
// 2026-08-27 rotation invalidated the legacy league_api_auth_token and broke every
// importer's cache write with a 401 until re-signed — and a token signed with a
// retired secret is exactly the artifact a rotation retires. A per-call HMAC sign
// is cheap and always current.
const admin_bearer = () =>
  `Bearer ${jwt.sign({ userId: 1 }, config.jwt.secret)}`

// use_proxy: false -- this is our own xo.football API, not a vendor target.
export const set = async ({ key, value }) => {
  const url = `https://xo.football/api/cache${key}`

  const data = await fetch_with_retry({
    url,
    method: 'POST',
    body: JSON.stringify(value),
    headers: {
      authorization: admin_bearer(),
      'Content-Type': 'application/json'
    },
    max_retries: 3,
    initial_delay: 1000,
    max_delay: 10000,
    use_proxy: false,
    response_type: 'json'
  })

  return data.value
}

// use_proxy: false -- this is our own xo.football API, not a vendor target.
export const get = async ({ key, max_age_ms = null }) => {
  let url = `https://xo.football/api/cache${key}`
  if (max_age_ms != null) {
    url += `?max_age_ms=${max_age_ms}`
  }

  const data = await fetch_with_retry({
    url,
    max_retries: 3,
    initial_delay: 1000,
    max_delay: 10000,
    use_proxy: false,
    response_type: 'json'
  })

  return data.value
}
