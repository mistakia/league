/* global describe before after afterEach it */
import * as chai from 'chai'
import MockDate from 'mockdate'

import knex from '#db'
import run from '#scripts/import-fbg-projections.mjs'

const expect = chai.expect

// FBG serves one JSON file per week and answers 403 -- not 404 -- for a week it
// has not posted yet. Status alone separates "not published" from "broken"
// here, which is what makes this importer simpler than fftoday and CBS, both of
// which answer 200 for an unpublished slice and need a body sentinel.
//
// The pairing that carries the design is `unpublished vs broken`: the SAME
// request shape must skip on 403 and throw on 500. A spec that only asserted
// the 403 skip would pass just as well if the importer swallowed every error.

const DATA_URL = 'https://fbg.test/data'

// 2026 regular_season_start is the Tuesday nine days before the opener, so
// current_season.week is 0 until 2026-09-08 while active_fantasy_week is 1.
// This is the clock on which the importer used to bail out entirely and report
// a successful run having written nothing.
const during_run_up_to_week_one = '2026-09-02T12:00:00Z'

// Every request the importer makes, keyed by the part of the URL that
// identifies it, so a leg states only the status it cares about.
const serve = ({ players = 200, projections = 200, projections_body = [] }) => {
  global.fetch = async (url) => {
    const href = String(url)
    if (href.includes('NFLPlayers')) {
      return players === 200
        ? new Response(JSON.stringify([]), {
            status: 200,
            headers: { 'content-type': 'application/json' }
          })
        : new Response('denied', { status: players })
    }
    if (href.includes('WeeklyProjections')) {
      return projections === 200
        ? new Response(JSON.stringify(projections_body), {
            status: 200,
            headers: { 'content-type': 'application/json' }
          })
        : new Response('denied', { status: projections })
    }
    throw new Error(`unexpected fetch: ${href}`)
  }
}

const attempt = async (served) => {
  MockDate.set(during_run_up_to_week_one)
  serve(served)
  try {
    return { threw: false, result: await run({ dry_run: true }) }
  } catch (err) {
    return { threw: true, err }
  }
}

describe('SCRIPTS /import-fbg-projections', function () {
  // A non-2xx is retried with backoff before it throws, so the failing legs are
  // several seconds each rather than instant.
  this.timeout(60000)

  before(async () => {
    await knex('config')
      .insert({ key: 'fbg_config', config_value: { data_url: DATA_URL } })
      .onConflict('key')
      .merge()
  })

  after(async () => {
    await knex('config').where({ key: 'fbg_config' }).del()
  })

  afterEach(() => {
    MockDate.reset()
    delete global.fetch
  })

  it('asks for the fantasy week, not the raw week counter', async () => {
    let requested
    MockDate.set(during_run_up_to_week_one)
    global.fetch = async (url) => {
      const href = String(url)
      if (href.includes('WeeklyProjections')) requested = href
      return new Response(JSON.stringify([]), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      })
    }
    await run({ dry_run: true })

    // The whole defect in one assertion. `current_season.week` is 0 at this
    // clock, so the old code built `-2026-0.json` -- a file FBG answers 403 for
    // -- while intending to write week 1. Pinning both halves means a
    // regression to either getter fails here.
    expect(requested).to.include('WeeklyProjections-2026-1.json')
    expect(requested).to.not.include('-2026-0.json')
  })

  it('skips an unpublished week rather than failing', async () => {
    const { threw, result } = await attempt({ projections: 403 })
    expect(threw).to.equal(false)
    expect(result).to.deep.equal({ skipped: true, unpublished: true })
  })

  it('still throws when upstream is broken rather than merely quiet', async () => {
    // The control for the leg above, and the reason it is not vacuous: same
    // request, different status, opposite verdict. Were the importer swallowing
    // every fetch error, the 403 leg would pass and this one would fail.
    const { threw, err } = await attempt({ projections: 500 })
    expect(threw).to.equal(true)
    expect(err.http_status).to.equal(500)
  })

  it('fails on a blanket 403 instead of reading it as an unpublished week', async () => {
    // The players file is fetched first precisely so a credential or host
    // failure answering 403 for EVERYTHING cannot be mistaken for a week that
    // is not posted yet. Without that ordering this case would skip silently
    // and forever, which is the failure mode the whole task exists to close.
    const { threw, err } = await attempt({ players: 403, projections: 403 })
    expect(threw).to.equal(true)
    expect(err.http_status).to.equal(403)
  })
})
