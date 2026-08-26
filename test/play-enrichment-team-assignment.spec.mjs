/* global describe it */
import * as chai from 'chai'

import { enrich_team_assignments } from '#libs-server/play-enrichment/team-assignment-enrichment.mjs'

const expect = chai.expect

/*
  This module had NO spec until 2026-08-26, and that absence is the whole
  reason it broke. Commit 8619abb2b (2026-07-29) renamed the nfl_games team
  roles `h`/`v` to `home_nfl_team`/`away_nfl_team` and swept the consumers; this
  one was missed, and nothing could see it. An undefined property is falsy, so
  every play took the "invalid game data" skip branch, logged one debug line on
  a cron job and returned unchanged -- enrichment reported success while
  offense_nfl_team and defense_nfl_team stayed NULL on every play it touched.
  All 6,027 plays of the 2026 preseason landed that way.

  So these assert on the PHYSICAL column names a real nfl_games row carries.
  A fixture keyed on anything else would pass against the broken revision.
*/

const HOME = 'KC'
const AWAY = 'BUF'
const ESBID = 2026080100

const games_map = () => ({
  [ESBID]: { esbid: ESBID, home_nfl_team: HOME, away_nfl_team: AWAY }
})

const play = (overrides = {}) => ({
  esbid: ESBID,
  play_id: 1,
  possession_nfl_team: HOME,
  ...overrides
})

describe('LIBS-SERVER play enrichment / team assignment', function () {
  it('assigns offense and defense from the home/away team columns', () => {
    const [enriched] = enrich_team_assignments([play()], games_map())

    expect(enriched.offense_nfl_team).to.equal(HOME)
    expect(enriched.defense_nfl_team).to.equal(AWAY)
  })

  it('assigns the defense as the home team when the away team has the ball', () => {
    const [enriched] = enrich_team_assignments(
      [play({ possession_nfl_team: AWAY })],
      games_map()
    )

    expect(enriched.offense_nfl_team).to.equal(AWAY)
    expect(enriched.defense_nfl_team).to.equal(HOME)
  })

  it('reads a Map as readily as an object, which is what process-plays passes', () => {
    const map = new Map([
      [ESBID, { esbid: ESBID, home_nfl_team: HOME, away_nfl_team: AWAY }]
    ])

    const [enriched] = enrich_team_assignments([play()], map)

    expect(enriched.offense_nfl_team).to.equal(HOME)
    expect(enriched.defense_nfl_team).to.equal(AWAY)
  })

  it('leaves a play with no possession team untouched, which is the timeout case', () => {
    const [enriched] = enrich_team_assignments(
      [play({ possession_nfl_team: null })],
      games_map()
    )

    expect(enriched.offense_nfl_team).to.equal(undefined)
    expect(enriched.defense_nfl_team).to.equal(undefined)
  })

  it('leaves a play whose game is absent from the map untouched', () => {
    const [enriched] = enrich_team_assignments([play()], {})

    expect(enriched.offense_nfl_team).to.equal(undefined)
    expect(enriched.defense_nfl_team).to.equal(undefined)
  })

  // The regression guard proper. A game row carrying ONLY the retired names is
  // exactly the shape the broken revision accepted and this one must refuse --
  // if a future rename repeats the miss, this is what goes red.
  it('does not enrich from the retired h/v spelling', () => {
    const [enriched] = enrich_team_assignments([play()], {
      [ESBID]: { esbid: ESBID, h: HOME, v: AWAY }
    })

    expect(enriched.offense_nfl_team).to.equal(undefined)
    expect(enriched.defense_nfl_team).to.equal(undefined)
  })
})
