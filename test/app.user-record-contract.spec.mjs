/* global describe it */

// THE USER RECORD DROPS A FIELD TWICE ON THE WAY IN, AND NOTHING REPORTS IT.
//
// GET /api/me returns the whole `users` row minus `password`, so a new column
// reaches the SPA for free. It then passes through two independent whitelists in
// app/core/app/user.js: the Immutable `Record`, which carries exactly its
// declared keys, and `create_user_record`, which destructures an explicit list.
// A field added to one and not the other arrives `undefined` with no warning
// from eslint, the build or PropTypes -- and the consuming code reads that as a
// falsy value rather than as a missing one, so a capability flag reads as
// "denied" and a page simply renders less.
//
// This is the class docs/guides/spa.md records, and it has shipped twice.
//
// WHAT THIS GATE CAN AND CANNOT SEE. It checks the SECOND whitelist against the
// first: every key the Record declares must survive create_user_record. That is
// the half that is genuinely invisible, because the Record declaration is the
// thing an author remembers to edit. It deliberately does NOT check the Record
// against the `users` table -- the Record carries a deliberate subset of that
// row, so equality there would be wrong rather than strict.
//
// The detector is exercised against a synthetic dropper first. A round-trip
// assertion over a correct implementation passes just as happily against a
// gate that cannot report, so the control is what makes the rest evidence.

import { User, create_user_record } from '#app/core/app/user.js'

const expect = (await import('chai')).expect

const declared_keys = Object.keys(new User().toJS())

// A distinguishable value per key, so a dropped field is a mismatch rather than
// a coincidental equality against the Record's own default.
const probe_value_for = (key, index) =>
  typeof new User().get(key) === 'boolean' ? true : `probe_${key}_${index}`

const dropped_keys = (build) => {
  const payload = {}
  declared_keys.forEach((key, index) => {
    payload[key] = probe_value_for(key, index)
  })

  const record = build(payload)
  return declared_keys.filter((key) => record.get(key) !== payload[key])
}

describe('the SPA user record', () => {
  it('reads its key list from the Record rather than a copy', () => {
    expect(declared_keys.length).to.be.greaterThan(0)
    expect(declared_keys).to.include('id')
    expect(declared_keys).to.include('data_view_generation_is_enabled')
  })

  // THE CONTROL. A builder that declares a key and forgets to carry it is
  // exactly the defect, and the detector must name it.
  it('reports a field the builder drops', () => {
    const dropping_builder = ({ id, username, email }) =>
      new User({ id, username, email })

    expect(dropped_keys(dropping_builder)).to.deep.equal([
      'data_view_generation_is_enabled'
    ])
  })

  it('carries every declared key through create_user_record', () => {
    const dropped = dropped_keys(create_user_record)
    expect(
      dropped,
      `create_user_record drops: ${dropped.join(', ')} -- add them to BOTH the Record and the destructured list in app/core/app/user.js`
    ).to.deep.equal([])
  })

  // The entitlement specifically, because its failure direction is the
  // dangerous one: absent reads as false, which is a control silently denying
  // an account the operator opened.
  it('reads a missing entitlement as closed rather than undefined', () => {
    const record = create_user_record({
      id: 7,
      username: 'someone',
      email: 'someone@example.invalid'
    })
    expect(record.get('data_view_generation_is_enabled')).to.equal(false)
  })

  it('carries an entitlement the API did send', () => {
    const record = create_user_record({
      id: 7,
      username: 'someone',
      email: 'someone@example.invalid',
      data_view_generation_is_enabled: true
    })
    expect(record.get('data_view_generation_is_enabled')).to.equal(true)
  })
})
