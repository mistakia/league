/* global describe it */
import * as chai from 'chai'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const expect = chai.expect

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const proxy_manager_path = path.join(
  __dirname,
  '..',
  'libs-server',
  'proxy-manager.mjs'
)

// A proxy string is `host:port:username:password`. Two derived values carry a
// credential: `connection_string` embeds the password outright, and `key` is
// `host:port:username`, where the username is what the vendor authenticates on.
// Neither may reach a log line or an Error message — those are written to job
// logs, to stderr, and to any surface that renders the error prose, none of
// which are redacted. On 2026-08-14 an HTTP 401 raised through fetch_with_retry
// printed a full proxy key into a session transcript for exactly this reason.
const CREDENTIAL_BEARING_READS = ['connection_string', 'key']

// Matches an interpolation whose expression ends in a credential-bearing read:
// `${current_proxy.key}`, `${proxy_config.connection_string}`. A read wrapped in
// proxy_display_label() is the sanctioned form and does not match, because the
// expression then ends in the call's closing paren rather than the property.
const build_interpolation_pattern = (property_name) =>
  new RegExp(`\\$\\{[^}]*\\.${property_name}\\s*\\}`, 'g')

const collect_line_numbers = ({ source, pattern }) => {
  const line_numbers = []
  source.split('\n').forEach((line, index) => {
    pattern.lastIndex = 0
    if (pattern.test(line)) {
      line_numbers.push(index + 1)
    }
  })
  return line_numbers
}

describe('proxy-manager credential logging', function () {
  const source = fs.readFileSync(proxy_manager_path, 'utf8')

  for (const property_name of CREDENTIAL_BEARING_READS) {
    it(`interpolates no bare .${property_name} into a template literal`, () => {
      const line_numbers = collect_line_numbers({
        source,
        pattern: build_interpolation_pattern(property_name)
      })

      expect(
        line_numbers,
        `libs-server/proxy-manager.mjs interpolates .${property_name} at line(s) ` +
          `${line_numbers.join(', ')}. Render the routing half only — ` +
          `proxy_display_label(key), or host and port read separately.`
      ).to.deep.equal([])
    })
  }

  // Positive control. The two assertions above pass vacuously if the pattern
  // stops matching the shape it is written for, and a scan that cannot find
  // anything is indistinguishable from a file that is clean. Mutating a known
  // sanctioned call site back into the bare form must be reported.
  it('reports a credential read when one is reintroduced', () => {
    const sanctioned_call = 'proxy_display_label(current_proxy.key)'
    expect(
      source,
      'the control has no material to mutate — proxy-manager.mjs no longer ' +
        'contains the sanctioned call site this control rewrites'
    ).to.include(sanctioned_call)

    const mutated_source = source.replace(sanctioned_call, 'current_proxy.key')
    const line_numbers = collect_line_numbers({
      source: mutated_source,
      pattern: build_interpolation_pattern('key')
    })

    expect(
      line_numbers,
      'the scan stayed silent over a reintroduced credential read'
    ).to.not.deep.equal([])
  })
})
