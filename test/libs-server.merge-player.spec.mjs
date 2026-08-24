/* global describe it */
import * as chai from 'chai'

import { merge_player_row_fields } from '#libs-server/merge-player.mjs'

const expect = chai.expect

// The pair these cases are drawn from is the real one: Ernie Sims, whose
// identity was split across an esb-keyed row carrying the `0000-00-00` sentinel
// and a pfr-keyed row carrying his actual birth date. Both are 10 characters, so
// the length tie-break cannot tell them apart and the sentinel used to win
// whenever it sat on the removed row.
const esb_row = {
  pid: 'ERNE-SIMS-024567',
  first_name: 'Ernest',
  last_name: 'Sims',
  date_of_birth: '0000-00-00',
  height_inches: 71,
  weight_pounds: 231
}

const pfr_row = {
  pid: 'ERNE-SIMS-024953',
  first_name: 'Ernest',
  last_name: 'Sims III',
  date_of_birth: '1984-12-23',
  height_inches: 72,
  weight_pounds: 230
}

describe('LIBS SERVER merge_player_row_fields', function () {
  it('keeps the real birth date when the sentinel is on the removed row', () => {
    const merged = merge_player_row_fields({
      update_player_row: pfr_row,
      remove_player_row: esb_row
    })

    expect(merged.date_of_birth).to.equal('1984-12-23')
  })

  it('keeps the real birth date when the sentinel is on the surviving row', () => {
    const merged = merge_player_row_fields({
      update_player_row: esb_row,
      remove_player_row: pfr_row
    })

    expect(merged.date_of_birth).to.equal('1984-12-23')
  })

  it('never writes the sentinel, whichever row survives', () => {
    for (const [update_player_row, remove_player_row] of [
      [pfr_row, esb_row],
      [esb_row, pfr_row]
    ]) {
      const merged = merge_player_row_fields({
        update_player_row,
        remove_player_row
      })

      expect(merged.date_of_birth).to.not.equal('0000-00-00')
    }
  })

  it('leaves the column absent when neither row knows the birth date', () => {
    const merged = merge_player_row_fields({
      update_player_row: esb_row,
      remove_player_row: { ...pfr_row, date_of_birth: null }
    })

    expect(merged).to.not.have.property('date_of_birth')
  })

  // The control: without it, a merge that dropped every string would pass the
  // cases above. The length tie-break is unchanged behaviour and must stay so.
  it('still breaks a genuine string tie by length', () => {
    const merged = merge_player_row_fields({
      update_player_row: pfr_row,
      remove_player_row: esb_row
    })

    expect(merged.last_name).to.equal('Sims III')
  })

  it('never carries the surviving pid into the update', () => {
    const merged = merge_player_row_fields({
      update_player_row: pfr_row,
      remove_player_row: esb_row
    })

    expect(merged).to.not.have.property('pid')
  })
})
