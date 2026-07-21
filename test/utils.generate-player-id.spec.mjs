/* global describe it */
import * as chai from 'chai'

import { generate_player_id } from '#libs-server'

chai.should()
const expect = chai.expect

describe('UTILS generate_player_id', function () {
  it('composes FNAM-LNAM-<serial> from name and a caller-supplied serial', () => {
    const pid = generate_player_id({
      first_name: 'John',
      last_name: 'Doe',
      serial: 123
    })

    expect(pid).to.equal('JOHN-DOEX-000123')
    expect(pid).to.be.a('string')
    expect(pid).to.match(/^[A-Z]{1,4}-[A-Z]{1,4}-[0-9]{6,}$/)
  })

  it('does not require dob or nfl_draft_year', () => {
    const pid = generate_player_id({
      first_name: 'Patrick',
      last_name: 'Mahomes',
      serial: 1
    })

    expect(pid).to.equal('PATR-MAHO-000001')
  })

  it('zero-pads the serial to at least six digits', () => {
    expect(
      generate_player_id({ first_name: 'A', last_name: 'B', serial: 7 })
    ).to.equal('AXXX-BXXX-000007')
  })

  it('lets the serial grow past six digits', () => {
    expect(
      generate_player_id({
        first_name: 'John',
        last_name: 'Doe',
        serial: 1234567
      })
    ).to.equal('JOHN-DOEX-1234567')
  })

  it('accepts a numeric-string serial (as returned by nextval)', () => {
    expect(
      generate_player_id({ first_name: 'John', last_name: 'Doe', serial: '42' })
    ).to.equal('JOHN-DOEX-000042')
  })

  it('X-pads a short last name', () => {
    expect(
      generate_player_id({ first_name: 'John', last_name: 'D', serial: 5 })
    ).to.equal('JOHN-DXXX-000005')
  })

  it('X-pads a short first name', () => {
    expect(
      generate_player_id({ first_name: 'J', last_name: 'Doe', serial: 5 })
    ).to.equal('JXXX-DOEX-000005')
  })

  it('assigns distinct pids to distinct serials for the same name', () => {
    const a = generate_player_id({
      first_name: 'John',
      last_name: 'Doe',
      serial: 1
    })
    const b = generate_player_id({
      first_name: 'John',
      last_name: 'Doe',
      serial: 2
    })
    expect(a).to.not.equal(b)
  })

  it('returns the team abbreviation for a DST, with no serial', () => {
    expect(
      generate_player_id({ primary_position: 'DST', current_nfl_team: 'NE' })
    ).to.equal('NE')
  })

  it('throws when the serial is missing for a person', () => {
    expect(() =>
      generate_player_id({ first_name: 'John', last_name: 'Doe' })
    ).to.throw('Missing field serial')
  })

  it('throws when first_name is missing', () => {
    expect(() => generate_player_id({ last_name: 'Doe', serial: 1 })).to.throw(
      'Missing field first_name'
    )
  })

  it('throws when last_name is missing', () => {
    expect(() =>
      generate_player_id({ first_name: 'John', serial: 1 })
    ).to.throw('Missing field last_name')
  })
})
