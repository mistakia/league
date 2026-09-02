/* global describe before after afterEach it */
import * as chai from 'chai'
import MockDate from 'mockdate'

import db from '#db'
import run from '#scripts/import-4for4-projections.mjs'

const expect = chai.expect

const WEEKLY_URL = 'https://example.invalid/4for4/weekly.csv'
const SEASON_URL = 'https://example.invalid/4for4/season.csv'

// 4for4's weekly endpoint is one fixed url, so the feed answers with whatever
// board it currently publishes and the Season/Week the rows carry is the only
// thing that says which slice arrived.
const csv_for = ({ season, week }) =>
  [
    'Season,Week,PID,Player,Pos,Team,Opp,FFPts,Comp,Pass Att,Pass Yds,Pass TD,INT,Rush Att,Rush Yds,Rush TD,Rec,Rec Yds,Rec TD,Fum,XP,FG',
    `${season},${week},mayed1,Drake Maye,QB,NE,@BUF,17.1,20.0,30.4,220.1,1.4,0.8,5.9,29.6,0.2,0.0,0.0,0.0,0.2,0.0,0.0`
  ].join('\n')

const serve = (csv) => {
  global.fetch = async (url) => {
    // cache.set posts the parsed board back to our own api; answer it as json so
    // the write path does not fall over inside the test.
    if (String(url).includes('/api/cache')) {
      return new Response(JSON.stringify({ value: null }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      })
    }
    return new Response(csv, {
      status: 200,
      headers: { 'content-type': 'text/csv' }
    })
  }
}

// 2026 week 1: regular_season_start is 2026-09-01, so current_season.week is 0
// and active_fantasy_week is 1.
const before_week_one = '2026-09-02T12:00:00Z'

describe('SCRIPTS /import-4for4-projections', function () {
  before(async () => {
    await db('config')
      .insert({
        key: '4for4_config',
        config_value: {
          weekly_projections_url: WEEKLY_URL,
          season_projections_url: SEASON_URL,
          headers: {}
        }
      })
      .onConflict('key')
      .merge()
  })

  after(async () => {
    await db('config').where({ key: '4for4_config' }).del()
  })

  afterEach(() => {
    MockDate.reset()
    delete global.fetch
  })

  const attempt = async (csv) => {
    MockDate.set(before_week_one)
    serve(csv)
    return run({ dry_run: true, is_regular_season_projection: false })
  }

  it('skips when the feed is publishing a different week', async () => {
    // The live 2026-09-02 condition: 4for4 still serving the prior postseason's
    // Super Bowl slot. The feed's Week is continuous, so 22 is a playoff round.
    const result = await attempt(csv_for({ season: 2026, week: 22 }))
    expect(result).to.deep.equal({ skipped: true, unpublished: true })
  })

  it('skips when the feed is publishing a different season', async () => {
    const result = await attempt(csv_for({ season: 2025, week: 1 }))
    expect(result).to.deep.equal({ skipped: true, unpublished: true })
  })

  // The control for both skips: on the slice this run actually wants, the guard
  // must NOT fire. Without this the two assertions above are satisfied by a
  // script that skips unconditionally.
  it('proceeds when the feed is publishing the week this run wants', async () => {
    const result = await attempt(csv_for({ season: 2026, week: 1 }))
    expect(result).to.equal(undefined)
  })
})
