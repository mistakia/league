/* global describe it */

import * as chai from 'chai'
import { get_espn_api_key } from '#league-import/espn.mjs'

const should = chai.should()

describe('IMPORTER ESPN', function () {
  this.timeout(60 * 1000)

  it('get api key', async () => {
    const apiKey = await get_espn_api_key()
    should.exist(apiKey)
  })

  // The headless username/password login this file used to cover
  // (get_espn_cookies / get_espn_leagues) no longer exists as behavior: Disney
  // gates the registerdisney login behind an Arkose (FunCaptcha) + reCAPTCHA
  // challenge and email 2FA, so a server-side login returns
  // AUTHORIZATION_CREDENTIALS / PALOMINO_CHECK_FAILED for any password. The
  // session is now established by an operator-attended stealth-browser re-auth
  // (scripts/espn-signin.mjs) and consumed via libs-server/espn-auth.mjs, which
  // test/espn-auth.spec.mjs covers. The two empty `it.skip` husks that stood
  // here were tombstones for that retired path, not tests.
})
