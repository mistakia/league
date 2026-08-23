/* global describe it */
import * as chai from 'chai'

import grade_adp_import_run, {
  MINIMUM_FEED_PLAYERS,
  MINIMUM_MATCH_RATE
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

  it('skips the fill-rate rule when the caller does not count it', () => {
    const grade = grade_adp_import_run({
      source_id: 'MFL',
      year: 2026,
      feeds: [{ label: 'PPR_REDRAFT', fetched: 330, matched: 318 }]
    })
    expect(grade.passed).to.equal(true)
    expect(grade.summary).to.not.include('with adp')
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
