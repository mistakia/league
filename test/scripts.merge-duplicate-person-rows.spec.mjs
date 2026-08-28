/* global describe it */
import * as chai from 'chai'

import {
  evaluate_shell,
  load_parked_shell_pids,
  REFUSAL
} from '#scripts/merge-duplicate-person-rows.mjs'

const expect = chai.expect

const references = (totals) =>
  new Map(
    Object.entries(totals).map(([pid, total]) => [pid, { total, by_table: [] }])
  )

/*
  Terrance Taylor, read from production 2026-08-28. The legacy row carries his
  real biography and no external identifier; the row minted later carries the
  gsis and esb ids, the NGS prospect scores, and the `0000-00-00` sentinel. His
  birth date is confirmed as 1986-05-14 against public record, Michigan, 2009.
  All 26 mergeable pairs have this shape.
*/
const taylor_shell = {
  pid: 'TERR-TAYL-024028',
  formatted_name: 'terrance taylor',
  date_of_birth: '1986-05-14',
  nfl_draft_year: 2009,
  college: 'Michigan',
  gsis_player_id: null
}

const taylor_twin = {
  pid: 'TERR-TAYL-024719',
  formatted_name: 'terrance taylor',
  date_of_birth: '0000-00-00',
  nfl_draft_year: 2009,
  college: 'Michigan',
  gsis_player_id: '00-0027100'
}

const pair_of = (shell, twin) => ({
  shell_pid: shell.pid,
  twin_pid: twin.pid,
  formatted_name: shell.formatted_name
})

const evaluate = ({
  shell = taylor_shell,
  twin = taylor_twin,
  pairs = null,
  totals = { [taylor_shell.pid]: 1, [taylor_twin.pid]: 8 }
} = {}) =>
  evaluate_shell({
    shell_pid: shell.pid,
    pairs: pairs || [pair_of(shell, twin)],
    rows: new Map([
      [shell.pid, shell],
      [twin.pid, twin]
    ]),
    references: references(totals)
  })

describe('SCRIPTS merge-duplicate-person-rows', function () {
  describe('evaluate_shell', function () {
    it('merges a shell into the identified twin carrying the sentinel', () => {
      const plan = evaluate()

      expect(plan.refusal).to.equal(undefined)
      expect(plan.survivor_pid).to.equal(taylor_twin.pid)
      expect(plan.folded_pid).to.equal(taylor_shell.pid)
    })

    // The survivor is chosen on reference count alone, so a twin that nothing
    // points at yields to the shell. Four of the 26 pairs are this shape, and
    // the merged row carries both halves' values either way.
    it('keeps the shell when it is the more-referenced half', () => {
      const plan = evaluate({
        totals: { [taylor_shell.pid]: 2, [taylor_twin.pid]: 0 }
      })

      expect(plan.refusal).to.equal(undefined)
      expect(plan.survivor_pid).to.equal(taylor_shell.pid)
    })

    it('breaks a reference tie deterministically by pid', () => {
      const plan = evaluate({
        totals: { [taylor_shell.pid]: 3, [taylor_twin.pid]: 3 }
      })

      expect(plan.survivor_pid).to.equal(taylor_shell.pid)
    })

    /*
      The father/son control, read from production 2026-08-28. Anthony Chickillo
      Sr (NT, born 1960, entered 1983) and Anthony Chickillo (DL, born 1992,
      drafted 2015) share a formatted_name and a college and are two people. The
      twin holding a REAL date is the only thing separating them from the
      mergeable class, and merging them would fuse a grandfather into his
      grandson.
    */
    it('refuses when the twin carries a real birth date', () => {
      const plan = evaluate({
        shell: {
          ...taylor_shell,
          pid: 'ANTH-CHIC-005743',
          date_of_birth: '1960-07-08',
          nfl_draft_year: 1983
        },
        twin: {
          ...taylor_twin,
          pid: 'ANTH-CHIC-026528',
          date_of_birth: '1992-12-10',
          nfl_draft_year: 2015
        },
        totals: { 'ANTH-CHIC-005743': 1, 'ANTH-CHIC-026528': 40 }
      })

      expect(plan.refusal).to.equal(REFUSAL.TWIN_HOLDS_REAL_BIRTH_DATE)
      expect(plan.survivor_pid).to.equal(undefined)
    })

    // A near date is refused too, not merely a distant one: the gate is "the
    // twin has a date at all", because a twin date days from the shell's means
    // the split has some other cause this evidence does not settle.
    it('refuses a real twin birth date even when it nearly agrees', () => {
      const plan = evaluate({
        twin: { ...taylor_twin, date_of_birth: '1986-05-16' }
      })

      expect(plan.refusal).to.equal(REFUSAL.TWIN_HOLDS_REAL_BIRTH_DATE)
    })

    // Without a real date on the shell the merge has nothing to carry across,
    // and would leave the sentinel standing on the survivor.
    it('refuses when the shell has no real birth date either', () => {
      const plan = evaluate({
        shell: { ...taylor_shell, date_of_birth: '0000-00-00' }
      })

      expect(plan.refusal).to.equal(REFUSAL.SHELL_BIRTH_DATE_UNKNOWN)
    })

    it('refuses a pair drafted more than a year apart', () => {
      const plan = evaluate({
        twin: { ...taylor_twin, nfl_draft_year: 2015 }
      })

      expect(plan.refusal).to.equal(REFUSAL.DRAFT_YEAR_GAP)
    })

    // A missing draft year on either side is not evidence against the pair, so
    // the corroboration stands down rather than refusing.
    it('merges when a draft year is missing rather than disagreeing', () => {
      const plan = evaluate({
        twin: { ...taylor_twin, nfl_draft_year: null }
      })

      expect(plan.refusal).to.equal(undefined)
    })

    /*
      Two rows qualifying as the twin means three rows share the name, and
      picking one would be a guess. Reachable from real data: David Jones has
      two shells against one twin, and the check reports a shell once however
      many twins it has.
    */
    it('refuses a shell matching more than one twin', () => {
      const second_twin = { ...taylor_twin, pid: 'TERR-TAYL-099999' }
      const plan = evaluate_shell({
        shell_pid: taylor_shell.pid,
        pairs: [
          pair_of(taylor_shell, taylor_twin),
          pair_of(taylor_shell, second_twin)
        ],
        rows: new Map([
          [taylor_shell.pid, taylor_shell],
          [taylor_twin.pid, taylor_twin],
          [second_twin.pid, second_twin]
        ]),
        references: references({
          [taylor_shell.pid]: 1,
          [taylor_twin.pid]: 8,
          [second_twin.pid]: 8
        })
      })

      expect(plan.refusal).to.equal(REFUSAL.NOT_ONE_TWIN)
    })

    // Nothing is written after the fold, so no column may be exempted from the
    // audit's union-of-values check. An exemption here would be the one way a
    // real value could go missing without the audit reporting it.
    it('exempts no column from the no-data-loss audit', () => {
      expect(evaluate().deliberate_columns).to.eql([])
    })
  })

  describe('load_parked_shell_pids', function () {
    const parked_fixture = JSON.stringify([
      {
        check_id: 'duplicate-person-rows',
        grain: { pid: 'ANTH-CHIC-005743' },
        disposition: 'adjudicated'
      },
      {
        check_id: 'nickname-legal-name-duplicate-rows',
        grain: { pid: 'RICH-SAUL-014018', duplicate_pid: 'RONA-SAUL-014155' },
        disposition: 'adjudicated'
      }
    ])

    it('reads the pids parked for this check', () => {
      const parked = load_parked_shell_pids({ read_file: () => parked_fixture })

      expect(parked.has('ANTH-CHIC-005743')).to.equal(true)
    })

    // The parked file is shared by every check, and a sibling check's grain
    // carries a `pid` too -- taking those would silently suppress pairs nobody
    // adjudicated for this class.
    it('ignores entries parked for a different check', () => {
      const parked = load_parked_shell_pids({ read_file: () => parked_fixture })

      expect(parked.has('RICH-SAUL-014018')).to.equal(false)
      expect(parked.size).to.equal(1)
    })
  })
})
