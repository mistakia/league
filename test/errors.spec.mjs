/* global describe it */
import * as chai from 'chai'

import { is_non_actionable_client_error } from '#api/routes/errors.mjs'

const expect = chai.expect

const GOOGLEBOT_UA =
  'Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.7778.96 Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'
const REAL_USER_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'

describe('api/errors - is_non_actionable_client_error', function () {
  it('suppresses known crawler user-agents regardless of error', function () {
    expect(
      is_non_actionable_client_error({
        error_class: 'SyntaxError',
        message: "Expected ',' or '}' after property value in JSON",
        user_agent: GOOGLEBOT_UA
      })
    ).to.equal(true)
  })

  it('suppresses reports with no error message (empty/malformed POSTs)', function () {
    expect(
      is_non_actionable_client_error({
        error_class: 'Error',
        message: undefined,
        user_agent: REAL_USER_UA
      })
    ).to.equal(true)
  })

  it('suppresses ChunkLoadError (stale-client, handled client-side)', function () {
    expect(
      is_non_actionable_client_error({
        error_class: 'ChunkLoadError',
        message: 'Loading CSS chunk 6900 failed.',
        user_agent: REAL_USER_UA
      })
    ).to.equal(true)
  })

  it("suppresses 'Failed to fetch' client network/abort conditions", function () {
    expect(
      is_non_actionable_client_error({
        error_class: 'TypeError',
        message: 'Failed to fetch',
        user_agent: REAL_USER_UA
      })
    ).to.equal(true)
  })

  it('emits a genuine app error from a real user', function () {
    expect(
      is_non_actionable_client_error({
        error_class: 'TypeError',
        message: "Cannot read properties of undefined (reading 'map')",
        user_agent: REAL_USER_UA
      })
    ).to.equal(false)
  })

  it('emits a real SyntaxError from a real user', function () {
    expect(
      is_non_actionable_client_error({
        error_class: 'SyntaxError',
        message: 'Unexpected token < in JSON at position 0',
        user_agent: REAL_USER_UA
      })
    ).to.equal(false)
  })
})
