/* global describe it */
import * as chai from 'chai'

import grade_adp_import_run, {
  MINIMUM_FEED_PLAYERS,
  MINIMUM_MATCH_RATE,
  MINIMUM_ADP_FILL_RATE,
  summarize_adp_feed
} from '#libs-server/grade-adp-import-run.mjs'

const expect = chai.expect

// CBS's real 2026 shape: two feeds, a few hundred players each, nearly all
// matched.
const healthy_run = {
  source_id: 'CBS',
  year: 2026,
  feeds: [
    { label: 'PPR_REDRAFT', fetched: 240, matched: 226, with_adp: 226 },
    { label: 'STANDARD_REDRAFT', fetched: 250, matched: 236, with_adp: 236 }
  ]
}

describe('LIBS-SERVER grade_adp_import_run', function () {
  it('passes a healthy run', () => {
    const grade = grade_adp_import_run(healthy_run)
    expect(grade.passed).to.equal(true)
    expect(grade.failures).to.deep.equal([])
    expect(grade.summary).to.include('oracle PASS')
    expect(grade.summary).to.include('CBS 2026')
    expect(grade.summary).to.include('2 feed(s) ingested')
  })

  it('fails when the run ingested no feeds at all', () => {
    const grade = grade_adp_import_run({
      source_id: 'CBS',
      year: 2026,
      feeds: []
    })
    expect(grade.passed).to.equal(false)
    expect(grade.failures).to.deep.equal(['no feeds ingested'])
  })

  it('fails one dead feed while its sibling is healthy', () => {
    // The grain that matters: a season-wide total across both CBS feeds would
    // still look substantial with one of them returning nothing.
    const grade = grade_adp_import_run({
      ...healthy_run,
      feeds: [
        healthy_run.feeds[0],
        { label: 'STANDARD_REDRAFT', fetched: 0, matched: 0, with_adp: 0 }
      ]
    })
    expect(grade.passed).to.equal(false)
    expect(grade.failures).to.deep.equal([
      'feed STANDARD_REDRAFT returned 0 players'
    ])
  })

  it('fails a feed that parsed a handful of rows from a redesigned page', () => {
    const grade = grade_adp_import_run({
      source_id: 'CBS',
      year: 2026,
      feeds: [{ label: 'PPR_REDRAFT', fetched: 3, matched: 3, with_adp: 3 }]
    })
    expect(grade.passed).to.equal(false)
    expect(grade.failures[0]).to.include('returned only 3 player(s)')
    expect(grade.failures[0]).to.include(`floor ${MINIMUM_FEED_PLAYERS}`)
  })

  it('fails when a feed fetched fine and matched nothing', () => {
    // The 2026-07 stale-checkout shape: find_player_row throws for every
    // player, each failure is caught and counted unmatched, zero rows written.
    const grade = grade_adp_import_run({
      source_id: 'ESPN',
      year: 2026,
      feeds: [{ label: 'PPR_REDRAFT', fetched: 560, matched: 0, with_adp: 0 }]
    })
    expect(grade.passed).to.equal(false)
    expect(grade.failures).to.deep.equal([
      'feed PPR_REDRAFT matched 0 of 560 player(s)'
    ])
  })

  it('fails a degraded match rate that still writes rows', () => {
    const grade = grade_adp_import_run({
      source_id: 'ESPN',
      year: 2026,
      feeds: [
        { label: 'PPR_REDRAFT', fetched: 560, matched: 100, with_adp: 100 }
      ]
    })
    expect(grade.passed).to.equal(false)
    expect(grade.failures[0]).to.include('match rate 17.9%')
    expect(grade.failures[0]).to.include(
      `below ${(MINIMUM_MATCH_RATE * 100).toFixed(1)}%`
    )
  })

  it('fails rows that were written carrying no average draft position', () => {
    // Populated and wrong: a renamed vendor field parses to null for every
    // player, so a row-count check reads healthy.
    const grade = grade_adp_import_run({
      source_id: 'YAHOO',
      year: 2026,
      feeds: [
        { label: 'HALF_PPR_REDRAFT', fetched: 500, matched: 466, with_adp: 0 }
      ]
    })
    expect(grade.passed).to.equal(false)
    expect(grade.failures[0]).to.include(
      'none carried an average draft position'
    )
  })

  it('fails a feed that is half empty rather than entirely empty', () => {
    // The live Yahoo shape on 2026-08-23: 203 of 466 matched rows carried an
    // ADP and the rest carried nothing, which the zero-only rule passed every
    // day for two months.
    const grade = grade_adp_import_run({
      source_id: 'YAHOO',
      year: 2026,
      feeds: [
        { label: 'HALF_PPR_REDRAFT', fetched: 500, matched: 466, with_adp: 203 }
      ]
    })
    expect(grade.passed).to.equal(false)
    expect(grade.failures[0]).to.include('adp fill rate 43.6%')
    expect(grade.failures[0]).to.include(
      `below ${(MINIMUM_ADP_FILL_RATE * 100).toFixed(1)}%`
    )
  })

  it('honors a per-feed fill floor that the universal one would fail', () => {
    // Sleeper filters its undrafted (adp=999) sentinel before grading, so its
    // fill rate is structurally ~25-30% -- far under the universal 0.9 -- yet a
    // genuine parse collapse still drives it toward 0. A per-feed floor lets the
    // healthy state pass while preserving the collapse guard.
    const grade = grade_adp_import_run({
      source_id: 'SLEEPER',
      year: 2026,
      feeds: [
        {
          label: 'ALL_FORMATS',
          fetched: 9414,
          matched: 8371,
          with_adp: 2143,
          distinct_adp: 3604,
          minimum_adp_fill_rate: 0.15
        }
      ]
    })
    expect(grade.passed).to.equal(true)
  })

  it('still fails a collapsed feed even under a low per-feed floor', () => {
    const grade = grade_adp_import_run({
      source_id: 'SLEEPER',
      year: 2026,
      feeds: [
        {
          label: 'ALL_FORMATS',
          fetched: 9414,
          matched: 8371,
          with_adp: 42,
          distinct_adp: 9,
          minimum_adp_fill_rate: 0.15
        }
      ]
    })
    expect(grade.passed).to.equal(false)
    expect(grade.failures[0]).to.include('adp fill rate 0.5%')
  })

  it('fails a fully populated feed carrying one repeated sentinel', () => {
    // ESPN's per-season endpoint answers 2025 with averageDraftPosition 170.00
    // for all 500 players. Complete, fully matched, fully filled, and garbage:
    // no other rule can see it.
    const grade = grade_adp_import_run({
      source_id: 'ESPN',
      year: 2025,
      feeds: [
        {
          label: 'PPR_REDRAFT',
          fetched: 500,
          matched: 497,
          with_adp: 497,
          distinct_adp: 1
        }
      ]
    })
    expect(grade.passed).to.equal(false)
    expect(grade.failures[0]).to.include(
      'single repeated average draft position'
    )
  })

  it('passes a real distribution under the same rule', () => {
    // The control the case above needs: same shape, many distinct positions.
    const grade = grade_adp_import_run({
      source_id: 'ESPN',
      year: 2026,
      feeds: [
        {
          label: 'PPR_REDRAFT',
          fetched: 500,
          matched: 497,
          with_adp: 497,
          distinct_adp: 480
        }
      ]
    })
    expect(grade.passed).to.equal(true)
  })

  it('skips the fill-rate rule when the caller does not count it', () => {
    const grade = grade_adp_import_run({
      source_id: 'MFL',
      year: 2026,
      feeds: [{ label: 'PPR_REDRAFT', fetched: 330, matched: 318 }]
    })
    expect(grade.passed).to.equal(true)
    expect(grade.summary).to.not.include('with adp')
  })

  describe('summarize_adp_feed', () => {
    it('counts every figure off the same rows, at one grain', () => {
      const feed = summarize_adp_feed({
        label: 'PPR_REDRAFT',
        fetched: 10,
        rows: [
          { average_draft_position: 1.5 },
          { average_draft_position: 2.5 },
          { average_draft_position: 2.5 },
          { average_draft_position: null }
        ]
      })
      expect(feed).to.deep.equal({
        label: 'PPR_REDRAFT',
        fetched: 10,
        matched: 4,
        with_adp: 3,
        distinct_adp: 2
      })
    })

    it('cannot report more filled rows than it matched', () => {
      // The Sleeper grain bug expressed as an invariant: with_adp is drawn from
      // the same array as matched, so it can never exceed it.
      const feed = summarize_adp_feed({
        label: 'ALL_FORMATS',
        fetched: 100,
        rows: Array.from({ length: 50 }, (_, i) => ({
          average_draft_position: i + 1
        }))
      })
      expect(feed.with_adp).to.be.at.most(feed.matched)
    })
  })

  it('honors injected bounds', () => {
    // Both bounds move together, so a spec can exercise the rules at
    // test-sized numbers rather than production ones.
    const feeds = [{ label: 'PPR_REDRAFT', fetched: 10, matched: 4 }]
    expect(
      grade_adp_import_run({
        source_id: 'RTS',
        year: 2026,
        feeds,
        minimum_feed_players: 5,
        minimum_match_rate: 0.3
      }).passed
    ).to.equal(true)
    expect(
      grade_adp_import_run({
        source_id: 'RTS',
        year: 2026,
        feeds,
        minimum_feed_players: 5,
        minimum_match_rate: 0.5
      }).passed
    ).to.equal(false)
  })
})
