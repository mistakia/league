/* global describe it after */
import * as chai from 'chai'
import fs from 'fs'
import os from 'os'
import path from 'path'

import {
  build_espn_cookie_header,
  build_espn_client,
  extract_espn_cookies,
  get_espn_authenticated_client,
  write_espn_cookie_to_file,
  EspnReauthRequiredError,
  ESPN_PROFILE
} from '#libs-server/espn-auth.mjs'

process.env.NODE_ENV = 'test'
const should = chai.should()
const expect = chai.expect

// Synthetic (non-real) cookie pair — injected so the tests never spawn a browser
// or touch a real credential.
const mock_cookies = { espn_s2: 'mock_s2_value', swid: '{MOCK-SWID}' }
const mock_jar = [
  { name: 'espn_s2', value: 'mock_s2_value' },
  { name: 'SWID', value: '{MOCK-SWID}' },
  { name: 'unrelated', value: 'x' }
]

describe('ESPN session auth (espn-auth)', function () {
  const tmp_files = []
  after(function () {
    for (const f of tmp_files) {
      try {
        fs.unlinkSync(f)
      } catch (err) {
        // best-effort cleanup
      }
    }
  })

  describe('extract_espn_cookies', function () {
    it('extracts espn_s2 + swid from a cloak-browser cookie jar', function () {
      extract_espn_cookies(mock_jar).should.deep.equal({
        espn_s2: 'mock_s2_value',
        swid: '{MOCK-SWID}'
      })
    })

    it('raises REAUTH_REQUIRED when espn_s2 is absent', function () {
      const jar = [{ name: 'SWID', value: '{MOCK-SWID}' }]
      expect(() => extract_espn_cookies(jar)).to.throw(EspnReauthRequiredError)
      try {
        extract_espn_cookies(jar)
      } catch (err) {
        err.reauth_required.should.equal(true)
        err.code.should.equal('REAUTH_REQUIRED')
        err.message.should.include(ESPN_PROFILE)
      }
    })

    it('raises REAUTH_REQUIRED when SWID is absent', function () {
      const jar = [{ name: 'espn_s2', value: 'mock_s2_value' }]
      expect(() => extract_espn_cookies(jar)).to.throw(EspnReauthRequiredError)
    })

    it('raises REAUTH_REQUIRED on an empty jar', function () {
      expect(() => extract_espn_cookies([])).to.throw(EspnReauthRequiredError)
    })
  })

  describe('build_espn_cookie_header', function () {
    it('formats the ESPN Cookie header', function () {
      build_espn_cookie_header(mock_cookies).should.equal(
        's2=mock_s2_value; SWID={MOCK-SWID}'
      )
    })

    it('throws when a cookie is missing', function () {
      expect(() => build_espn_cookie_header({ espn_s2: 'x' })).to.throw(
        'both espn_s2 and swid are required'
      )
    })
  })

  describe('build_espn_client', function () {
    it('returns a client authenticated with the cookie in its headers', function () {
      const client = build_espn_client(mock_cookies, {
        base_url: 'https://fantasy.espn.com'
      })
      client.is_authenticated().should.equal(true)
      client.authentication.type.should.equal('cookie_based')
      client.headers.Cookie.should.equal('s2=mock_s2_value; SWID={MOCK-SWID}')
      client.base_url.should.equal('https://fantasy.espn.com')
    })
  })

  describe('get_espn_authenticated_client', function () {
    it('uses injected cookies without reading the profile (no browser)', function () {
      const client = get_espn_authenticated_client({ cookies: mock_cookies })
      client.is_authenticated().should.equal(true)
      client.headers.Cookie.should.equal('s2=mock_s2_value; SWID={MOCK-SWID}')
    })
  })

  describe('write_espn_cookie_to_file', function () {
    it('writes the cookie header to a mode-0600 file and returns only non-sensitive metadata', function () {
      const out_file = path.join(
        os.tmpdir(),
        `espn-auth-test-${process.pid}-${Date.now()}.0600`
      )
      tmp_files.push(out_file)

      const meta = write_espn_cookie_to_file(out_file, {
        cookies: mock_cookies
      })

      // returned metadata carries no secret value
      Object.keys(meta).sort().should.deep.equal(['byte_length', 'file_path'])
      should.not.exist(meta.espn_s2)
      should.not.exist(meta.swid)
      should.not.exist(meta.cookie_header)

      // restrictive 0600 permissions
      const stat = fs.statSync(out_file)
      ;(stat.mode & 0o777).should.equal(0o600)

      // holds exactly the cookie header
      const on_disk = fs.readFileSync(out_file, 'utf8')
      on_disk.should.equal('s2=mock_s2_value; SWID={MOCK-SWID}')
      meta.byte_length.should.equal(Buffer.byteLength(on_disk))
    })

    it('throws when no file_path is given', function () {
      expect(() =>
        write_espn_cookie_to_file(undefined, { cookies: mock_cookies })
      ).to.throw('file_path is required')
    })
  })
})
