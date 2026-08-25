/* global describe it */
import * as chai from 'chai'

import grade_espn_line_win_rates_run, {
  EXPECTED_TEAM_COUNT,
  MINIMUM_CATEGORY_PLAYERS,
  parse_season_year_from_url,
  summarize_win_rate_feed
} from '#libs-server/grade-espn-line-win-rates-run.mjs'

const expect = chai.expect

const SOURCE_URL =
  'https://www.espn.com/nfl/story/_/id/46138675/2025-nfl-win-rates-top-teams-players-rankings-pass-run-block'

// Per-category shapes measured from espn_player_win_rates_history on
// league_production (2026-08-25): PASS_RUSH 38-40, PASS_BLOCK 32-40,
// RUN_STOP 19-20, RUN_BLOCK 19-20 rows written per run.
const player_feed = ({ label, fetched, matched = fetched }) => ({
  label,
  fetched,
  matched,
  with_rate: matched,
  distinct_rates: Math.min(matched, 12),
  min_rate: 0.19,
  max_rate: 0.85
})

const team_feed = (label) => ({
  label,
  fetched: 32,
  matched: 32,
  with_rate: 32,
  distinct_rates: 10,
  min_rate: 0.57,
  max_rate: 0.75,
  is_team_feed: true
})

const healthy_run = () => ({
  source_season_year: 2025,
  expected_season_year: 2025,
  source_url: SOURCE_URL,
  feeds: [
    player_feed({ label: 'pass_rush', fetched: 40 }),
    player_feed({ label: 'pass_block', fetched: 40 }),
    player_feed({ label: 'run_stop', fetched: 20 }),
    player_feed({ label: 'run_block', fetched: 20 }),
    team_feed('team pass_rush_win_rate'),
    team_feed('team run_stop_win_rate'),
    team_feed('team pass_block_win_rate'),
    team_feed('team run_block_win_rate')
  ]
})

describe('LIBS-SERVER parse_season_year_from_url', function () {
  it('reads the season out of a real article url', () => {
    expect(parse_season_year_from_url(SOURCE_URL)).to.equal(2025)
  })

  it('returns null for a url that carries no season', () => {
    expect(
      parse_season_year_from_url('https://www.espn.com/nfl/story/_/id/46138675')
    ).to.equal(null)
    expect(parse_season_year_from_url(null)).to.equal(null)
    expect(parse_season_year_from_url(undefined)).to.equal(null)
  })
})

describe('LIBS-SERVER summarize_win_rate_feed', function () {
  it('counts fill, distinctness and range off the rows it is handed', () => {
    const summary = summarize_win_rate_feed({
      label: 'run_block',
      fetched: 20,
      rows: [
        { pid: 'A', run_block_win_rate: 0.71 },
        { pid: 'B', run_block_win_rate: 0.71 },
        { pid: 'C', run_block_win_rate: 0.68 },
        { pid: 'D', run_block_win_rate: null }
      ],
      rate_key: 'run_block_win_rate'
    })
    expect(summary).to.deep.equal({
      label: 'run_block',
      fetched: 20,
      matched: 4,
      with_rate: 3,
      distinct_rates: 2,
      min_rate: 0.68,
      max_rate: 0.71
    })
  })

  it('reports nulls rather than NaN when nothing carries a rate', () => {
    const summary = summarize_win_rate_feed({
      label: 'run_block',
      fetched: 20,
      rows: [{ pid: 'A', run_block_win_rate: null }],
      rate_key: 'run_block_win_rate'
    })
    expect(summary.with_rate).to.equal(0)
    expect(summary.min_rate).to.equal(null)
    expect(summary.max_rate).to.equal(null)
  })
})

describe('LIBS-SERVER grade_espn_line_win_rates_run', function () {
  it('passes a healthy run', () => {
    const grade = grade_espn_line_win_rates_run(healthy_run())
    expect(grade.failures).to.deep.equal([])
    expect(grade.passed).to.equal(true)
    expect(grade.summary).to.include('oracle PASS')
    expect(grade.summary).to.include('espn line win rates 2025')
    expect(grade.summary).to.include('8 feed(s) ingested')
  })

  // The March 2026 incident. The page was healthy in every particular and the
  // run wrote a season that had not been played.
  it('fails when the source article is a different season than the run', () => {
    const grade = grade_espn_line_win_rates_run({
      ...healthy_run(),
      source_season_year: 2025,
      expected_season_year: 2026
    })
    expect(grade.passed).to.equal(false)
    expect(grade.failures).to.have.lengthOf(1)
    expect(grade.failures[0]).to.include('is the 2025 article')
    expect(grade.failures[0]).to.include('importing 2026')
  })

  it('fails when the url shape no longer yields a season', () => {
    const grade = grade_espn_line_win_rates_run({
      ...healthy_run(),
      source_season_year: null,
      source_url: 'https://www.espn.com/nfl/story/_/id/46138675'
    })
    expect(grade.passed).to.equal(false)
    expect(grade.failures[0]).to.include('could not derive a season')
    expect(grade.summary).to.include('espn line win rates unknown')
  })

  it('fails when the run ingested no feeds at all', () => {
    const grade = grade_espn_line_win_rates_run({
      ...healthy_run(),
      feeds: []
    })
    expect(grade.passed).to.equal(false)
    expect(grade.failures).to.deep.equal(['no feeds ingested'])
  })

  // The grain that matters. The retired aggregate floor summed all four
  // categories against 50; run_block dying entirely leaves 100 rows behind and
  // cleared it every time.
  it('fails one dead category while its three siblings are healthy', () => {
    const feeds = healthy_run().feeds
    feeds[3] = player_feed({ label: 'run_block', fetched: 0 })
    const grade = grade_espn_line_win_rates_run({ ...healthy_run(), feeds })
    expect(grade.passed).to.equal(false)
    expect(grade.failures).to.deep.equal(['feed run_block returned 0 rows'])
    const surviving = feeds
      .filter((feed) => feed.label !== 'run_block')
      .reduce((sum, feed) => sum + feed.matched, 0)
    expect(surviving).to.be.above(50)
  })

  it('fails a category that thinned below the floor', () => {
    const feeds = healthy_run().feeds
    feeds[2] = player_feed({
      label: 'run_stop',
      fetched: MINIMUM_CATEGORY_PLAYERS - 1
    })
    const grade = grade_espn_line_win_rates_run({ ...healthy_run(), feeds })
    expect(grade.passed).to.equal(false)
    expect(grade.failures[0]).to.include('feed run_stop returned only 9')
  })

  it('fails a team table that is not exactly every NFL team', () => {
    const feeds = healthy_run().feeds
    feeds[4] = { ...team_feed('team pass_rush_win_rate'), fetched: 31 }
    const grade = grade_espn_line_win_rates_run({ ...healthy_run(), feeds })
    expect(grade.passed).to.equal(false)
    expect(grade.failures[0]).to.include(
      `returned 31 team(s), expected exactly ${EXPECTED_TEAM_COUNT}`
    )
  })

  it('fails a category that listed players and resolved none of them', () => {
    const feeds = healthy_run().feeds
    feeds[0] = player_feed({ label: 'pass_rush', fetched: 40, matched: 0 })
    const grade = grade_espn_line_win_rates_run({ ...healthy_run(), feeds })
    expect(grade.passed).to.equal(false)
    expect(grade.failures[0]).to.include('feed pass_rush matched 0 of 40')
  })

  it('leaves the match rate ungated until one has been measured', () => {
    const feeds = healthy_run().feeds
    feeds[0] = player_feed({ label: 'pass_rush', fetched: 40, matched: 4 })
    expect(
      grade_espn_line_win_rates_run({ ...healthy_run(), feeds }).passed
    ).to.equal(true)
    expect(
      grade_espn_line_win_rates_run({
        ...healthy_run(),
        feeds,
        minimum_match_rate: 0.5
      }).passed
    ).to.equal(false)
  })

  // Rows present, values absent: a moved cell index parses null for everyone
  // and every count rule reads healthy.
  it('fails rows that were written carrying no win rate', () => {
    const feeds = healthy_run().feeds
    feeds[5] = { ...team_feed('team run_stop_win_rate'), with_rate: 0 }
    const grade = grade_espn_line_win_rates_run({ ...healthy_run(), feeds })
    expect(grade.passed).to.equal(false)
    expect(grade.failures[0]).to.include('only 0 carried a win rate')
  })

  it('fails a feed carrying one repeated value across every row', () => {
    const feeds = healthy_run().feeds
    feeds[6] = {
      ...team_feed('team pass_block_win_rate'),
      distinct_rates: 1,
      min_rate: 0.62,
      max_rate: 0.62
    }
    const grade = grade_espn_line_win_rates_run({ ...healthy_run(), feeds })
    expect(grade.passed).to.equal(false)
    expect(grade.failures[0]).to.include('single repeated win rate')
  })

  // The parse_percentage regression: `/(\d+)%/` reads "5" out of "62.5%" and
  // produces a perfectly well-formed distribution of numbers ten times too
  // small. Only the range rule can see it.
  it('fails a feed whose percentages parsed at the wrong scale', () => {
    const feeds = healthy_run().feeds
    feeds[7] = {
      ...team_feed('team run_block_win_rate'),
      min_rate: 0.01,
      max_rate: 0.09
    }
    const grade = grade_espn_line_win_rates_run({ ...healthy_run(), feeds })
    expect(grade.passed).to.equal(false)
    expect(grade.failures[0]).to.include('below 0.05')
    expect(grade.failures[0]).to.include('wrong scale')
  })

  it('fails a feed whose percentages were never scaled down at all', () => {
    const feeds = healthy_run().feeds
    feeds[7] = {
      ...team_feed('team run_block_win_rate'),
      min_rate: 57,
      max_rate: 75
    }
    const grade = grade_espn_line_win_rates_run({ ...healthy_run(), feeds })
    expect(grade.passed).to.equal(false)
    expect(grade.failures[0]).to.include('above 0.99')
  })

  it('reports every failure of a run that broke several ways at once', () => {
    const feeds = healthy_run().feeds
    feeds[1] = player_feed({ label: 'pass_block', fetched: 3 })
    feeds[4] = { ...team_feed('team pass_rush_win_rate'), fetched: 12 }
    const grade = grade_espn_line_win_rates_run({
      ...healthy_run(),
      expected_season_year: 2026,
      feeds
    })
    expect(grade.failures).to.have.lengthOf(3)
    expect(grade.summary).to.include('oracle FAIL')
  })
})
