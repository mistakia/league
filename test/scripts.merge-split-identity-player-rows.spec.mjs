/* global describe it */
import * as chai from 'chai'

import {
  evaluate_pair,
  surnames_agree,
  REFUSAL
} from '#scripts/merge-split-identity-player-rows.mjs'

const expect = chai.expect

const references = (totals) =>
  new Map(
    Object.entries(totals).map(([pid, total]) => [pid, { total, by_table: [] }])
  )

const disposition = ({ gsis_player_id, pids, source_record }) => ({
  gsis_player_id,
  ledger_names: ['E.Sims'],
  graded_stat_rows: 599,
  source_record,
  incumbents: pids.map((pid) => ({ incumbent_pid: pid }))
})

// The real Ernie Sims split, read from production 2026-08-24: one half holds
// the esb id and the `0000-00-00` sentinel, the other holds the pfr id and his
// actual birth date, and neither holds a gsis id. All ten held-back pairs have
// this shape.
const sims_source = {
  first_name: 'Ernest',
  last_name: 'Sims',
  position: 'OLB',
  college: 'Florida State',
  esb_id: 'SIM696501',
  pfr_id: 'SimsEr20',
  smart_id: '32005349-4d69-6501-f9ff-a85c8df58d99',
  gsis_it_id: null
}

const sims_esb_row = {
  pid: 'ERNE-SIMS-024567',
  first_name: 'Ernest',
  last_name: 'Sims',
  date_of_birth: '0000-00-00',
  nfl_draft_year: 2006,
  gsis_player_id: null,
  esb_player_id: 'SIM696501',
  pfr_player_id: null
}

const sims_pfr_row = {
  pid: 'ERNE-SIMS-024953',
  first_name: 'Ernest',
  last_name: 'Sims III',
  date_of_birth: '1984-12-23',
  nfl_draft_year: 2006,
  gsis_player_id: null,
  esb_player_id: null,
  pfr_player_id: 'SimsEr20'
}

const evaluate_sims = (totals) =>
  evaluate_pair({
    disposition: disposition({
      gsis_player_id: '00-0024224',
      pids: [sims_esb_row.pid, sims_pfr_row.pid],
      source_record: sims_source
    }),
    rows: [sims_esb_row, sims_pfr_row],
    references: references(totals)
  })

describe('SCRIPTS merge-split-identity-player-rows', function () {
  describe('evaluate_pair', function () {
    it('merges a split pair where neither half holds a gsis id', () => {
      const plan = evaluate_sims({
        'ERNE-SIMS-024567': 3,
        'ERNE-SIMS-024953': 113
      })

      expect(plan.refusal).to.equal(undefined)
      expect(plan.survivor_pid).to.equal('ERNE-SIMS-024953')
      expect(plan.folded_pid).to.equal('ERNE-SIMS-024567')
    })

    it('keeps the more-referenced half, whichever side it is on', () => {
      const plan = evaluate_sims({
        'ERNE-SIMS-024567': 113,
        'ERNE-SIMS-024953': 3
      })

      expect(plan.survivor_pid).to.equal('ERNE-SIMS-024567')
    })

    it('breaks a reference tie deterministically by pid', () => {
      const plan = evaluate_sims({
        'ERNE-SIMS-024567': 7,
        'ERNE-SIMS-024953': 7
      })

      expect(plan.survivor_pid).to.equal('ERNE-SIMS-024567')
    })

    /*
      The father/son control, read from production 2026-08-24. Tyrone Wheatley
      Jr's row holds his FATHER's pfr id and his father's birth date, so the
      surname and birth-date gates both pass -- the birth-date gate does not
      merely fail to help here, it is actively fooled by the contamination. Two
      rows each holding their own gsis id is the only thing that separates them,
      and merging them would fuse a father into his son.
    */
    it('refuses a pair where both halves hold their own gsis id', () => {
      const wheatley_sr = {
        pid: 'TYRO-WHEA-001076',
        last_name: 'Wheatley',
        date_of_birth: '1972-01-19',
        nfl_draft_year: 1995,
        gsis_player_id: '00-0017486',
        pfr_player_id: null
      }
      const wheatley_jr = {
        pid: 'TYRO-WHEA-027188',
        last_name: 'Wheatley',
        date_of_birth: '1972-01-19',
        nfl_draft_year: 2021,
        gsis_player_id: '00-0036966',
        pfr_player_id: 'WheaTy00'
      }

      const plan = evaluate_pair({
        disposition: disposition({
          gsis_player_id: '00-0017486',
          pids: [wheatley_sr.pid, wheatley_jr.pid],
          source_record: { ...sims_source, last_name: 'Wheatley' }
        }),
        rows: [wheatley_sr, wheatley_jr],
        references: references({
          'TYRO-WHEA-001076': 200,
          'TYRO-WHEA-027188': 4
        })
      })

      expect(plan.refusal).to.equal(REFUSAL.INCUMBENT_HOLDS_GSIS)
      expect(plan.survivor_pid).to.equal(undefined)
    })

    it('refuses a pair drafted more than a year apart', () => {
      const plan = evaluate_pair({
        disposition: disposition({
          gsis_player_id: '00-0024224',
          pids: [sims_esb_row.pid, sims_pfr_row.pid],
          source_record: sims_source
        }),
        rows: [sims_esb_row, { ...sims_pfr_row, nfl_draft_year: 2003 }],
        references: references({
          'ERNE-SIMS-024567': 3,
          'ERNE-SIMS-024953': 113
        })
      })

      expect(plan.refusal).to.equal(REFUSAL.DRAFT_YEAR_GAP)
    })

    it('refuses a pair whose two real birth dates are far apart', () => {
      const plan = evaluate_pair({
        disposition: disposition({
          gsis_player_id: '00-0024224',
          pids: [sims_esb_row.pid, sims_pfr_row.pid],
          source_record: sims_source
        }),
        rows: [{ ...sims_esb_row, date_of_birth: '1984-01-02' }, sims_pfr_row],
        references: references({
          'ERNE-SIMS-024567': 3,
          'ERNE-SIMS-024953': 113
        })
      })

      expect(plan.refusal).to.equal(REFUSAL.BIRTH_DATE_GAP)
    })

    // The sentinel is not a date and must not be measured as one. Read as a
    // real value it is 1900 years from any true birth date, so a gate that did
    // not exclude it would refuse every pair this script exists to merge.
    it('does not measure a birth-date gap against the sentinel', () => {
      const plan = evaluate_sims({
        'ERNE-SIMS-024567': 3,
        'ERNE-SIMS-024953': 113
      })

      expect(plan.refusal).to.equal(undefined)
    })

    it('refuses anything that is not exactly two rows', () => {
      const plan = evaluate_pair({
        disposition: disposition({
          gsis_player_id: '00-0024224',
          pids: [sims_esb_row.pid],
          source_record: sims_source
        }),
        rows: [sims_esb_row],
        references: references({ 'ERNE-SIMS-024567': 3 })
      })

      expect(plan.refusal).to.equal(REFUSAL.NOT_A_PAIR)
    })
  })

  describe('surnames_agree', function () {
    it('accepts a generational suffix on one side only', () => {
      expect(surnames_agree('Sims', 'Sims III')).to.equal(true)
    })

    it('accepts one half of a hyphenated surname', () => {
      expect(surnames_agree('Lichtenhan', 'Christian-Lichtenhan')).to.equal(
        true
      )
    })

    it('rejects two genuinely different surnames', () => {
      expect(surnames_agree('Lefeged', 'Wheatley')).to.equal(false)
    })

    it('rejects an empty surname rather than matching everything', () => {
      expect(surnames_agree('', 'Sims')).to.equal(false)
    })
  })
})
