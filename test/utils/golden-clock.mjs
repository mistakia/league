import MockDate from 'mockdate'

// The single instant every data-view golden is blessed at and compared at.
//
// The goldens assert the SQL a request generates, and a great deal of that SQL
// is clock-derived: the current-week columns emit a week and a season type, the
// year-range columns emit a year list ending at the current season, and the
// betting-market family emits a week-scoped join only in season. So with a free
// clock the corpus rewrites itself on its own -- 46 of 278 goldens were
// measured going red on a date change alone, with 16 of them breaking at REG
// week 1 and no code involved. A golden whose diff is routinely non-empty for
// reasons nobody changed teaches its readers to re-bless without reading, which
// is how a real regression gets blessed in.
//
// 2026-10-22 is a Thursday inside REG week 7 of the 2026 season -- mid-week and
// mid-season deliberately. An in-season clock is the one worth freezing at:
// the week-scoped joins the betting-market and practice families emit exist
// only under it, and an offseason pin would have frozen the corpus on exactly
// the shape that hid the missing nfl_games join on all six player_game_prop_*
// columns for their whole lives.
export const GOLDEN_CLOCK = '2026-10-22T12:00:00Z'

// Deliberately UNCONDITIONAL -- LEAGUE_MOCK_DATE does not override it, and
// there is no bypass flag. A stored expected_query is a literal blessed at this
// instant, so any other clock makes it fail for a reason that is not a code
// change: a full-suite run under LEAGUE_MOCK_DATE, which this repo recommends
// for exercising PRE/REG/POST behaviour elsewhere, would otherwise turn dozens
// of goldens red and teach the reader to ignore them. Cross-week verification
// is no longer something the golden corpus needs, because the corpus no longer
// varies; what replaced it is test/data-views.golden-clock-invariance.spec.mjs,
// which asserts exactly that and carries its own control. To read the SQL a
// request emits at some other instant, use scripts/data-view-test-cli.mjs.
//
// What must never come back is the reverse of this call: the golden spec used
// to run MockDate.reset() in its `before`, which unpinned the clock that
// global.mjs had just set, so the cross-week verification recipe documented at
// the time compared every golden against the real date no matter what instant
// was asked for. It could not report, and it failed in the direction that looks
// like success.
export const pin_golden_clock = () => {
  MockDate.set(GOLDEN_CLOCK)
}

// Mocha loads every spec into one process and MockDate is global, so a pin left
// standing dates whatever runs next -- including a later file's teardown. Hand
// the clock back to whatever the run as a whole is pinned to, rather than
// resetting unconditionally, or an LEAGUE_MOCK_DATE run silently reverts to the
// real date halfway through.
export const restore_suite_clock = () => {
  if (process.env.LEAGUE_MOCK_DATE) {
    MockDate.set(process.env.LEAGUE_MOCK_DATE)
  } else {
    MockDate.reset()
  }
}
