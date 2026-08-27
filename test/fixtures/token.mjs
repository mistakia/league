import jwt from 'jsonwebtoken'

import config from '#config'

// Minted from the configured test secret at import time rather than checked in
// pre-signed. Hard-coded tokens silently pin the suite to one specific
// `jwt.secret` VALUE, so rotating that secret turns hundreds of unrelated specs
// red with a 401 -- which is what happened on 2026-08-27, when the test secret
// had to be changed because it was the production one and had been committed to
// a public repo. Signing here means the secret is free to rotate and these stay
// valid.
//
// `iat` is pinned to each token's original issue time so the fixtures keep
// whatever age-dependent behaviour the specs were written against; nothing in
// the suite asserts on the encoded string itself.
const sign = ({ userId, iat }) =>
  jwt.sign({ userId, iat }, config.jwt.secret, { algorithm: 'HS256' })

export const user1 = sign({ userId: 1, iat: 1595476877 })
export const user2 = sign({ userId: 2, iat: 1593820842 })
export const user3 = sign({ userId: 3, iat: 1593820865 })
