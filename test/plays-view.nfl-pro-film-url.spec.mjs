/* global describe before after it */
import * as chai from 'chai'

import db from '#db'
import { nfl_pro_film_url_sql } from '#libs-server/plays-view/nfl-pro-film-url.mjs'
import plays_view_column_definitions from '#libs-server/plays-view/column-definitions/index.mjs'
import get_plays_view_results from '#libs-server/plays-view/get-plays-view-results.mjs'
import { plays_view_fields_index } from '#libs-shared'

const expect = chai.expect

/*
  Coverage for the NFL Pro coaches-film deep link on the plays view.

  The URL is assembled in SQL, and every part of that assembly is a rule that was
  measured against the live film-room API rather than reasoned out -- the clock
  comes from the play description and not from game_clock_start, minutes are
  zero-padded, playType is sent for every play with sacks routed separately, and
  the whole thing is NULL before the 2022 season. A change to any of them produces a URL that still
  looks like a URL and quietly resolves to the wrong play, or to no play, which
  is exactly the failure no reader would notice in a table cell.

  Every case therefore asserts the resolved STRING, not the shape of the
  expression. Cases are seeded rather than read from production rows so the
  boundary cases -- a single-digit minute, a kickoff with no clock prefix, a
  playoff week slug -- are present at all; production has them but no query can
  promise it sampled one.
*/

// Outside every seeded fixture's range, so these rows cannot collide with
// another spec's and a leftover cannot be mistaken for one.
const esbid = 99000401

const seed_play = async ({
  play_id,
  season_year = 2025,
  season_type = 'REG',
  week = 1,
  quarter = 1,
  play_type = 'PASS',
  is_sack = null,
  game_clock_start = null,
  play_description = null
}) =>
  db('nfl_plays').insert({
    esbid,
    play_id,
    season_year,
    season_type,
    week,
    quarter,
    play_type,
    is_sack,
    game_clock_start,
    play_description,
    updated: new Date()
  })

const film_url = async (play_id) => {
  const [row] = await db('nfl_plays')
    .select(nfl_pro_film_url_sql({ alias: 'play_film_url' }))
    .where({ esbid, play_id })
  return row.play_film_url
}

const clear = async () => {
  await db('nfl_plays').where({ esbid }).del()
}

describe('plays view / nfl pro film url', function () {
  this.timeout(30000)

  before(clear)
  after(clear)

  describe('registration', function () {
    it('is defined on the server and described for the client', function () {
      expect(plays_view_column_definitions.play_film_url).to.be.an('object')
      expect(plays_view_fields_index.play_film_url).to.be.a('string')
    })

    it('carries no bind parameters', function () {
      // Two separate failures live here. A literal `?` in the SQL -- the one
      // that opens the query string -- is read by knex as a placeholder and
      // throws `Expected 0 bindings, saw 1` when the query is built. Passing the
      // URL as a binding instead moves the failure to the sort path below, where
      // it is quieter. Neither is possible while this stays empty.
      const { bindings } = nfl_pro_film_url_sql().toSQL()
      expect(bindings).to.be.empty
    })

    it('is a usable ORDER BY column through the plays view', async function () {
      // The select path and the sort path consume this expression differently.
      // A binding-carrying version selects fine and then dies at ORDER BY with
      // `could not determine data type of parameter`, because the plays view
      // interpolates the sort column into orderByRaw while knex still owns the
      // placeholder. Only a run through get_plays_view_results sees that --
      // calling .toString() on the expression here would resolve the binding and
      // report green against the very shape this guards.
      await seed_play({
        play_id: 150,
        play_description: '(09:00) pass short left.'
      })

      const { plays_view_results } = await get_plays_view_results({
        columns: ['play_desc', 'play_film_url'],
        where: [{ column_id: 'play_esbid', operator: '=', value: esbid }],
        sort: [{ column_id: 'play_film_url', desc: false }],
        limit: 5
      })

      expect(plays_view_results).to.not.be.empty
      expect(plays_view_results[0].play_film_url).to.include(
        'https://pro.nfl.com/film/plays?season='
      )
    })
  })

  describe('the clock', function () {
    it('takes the clock from the play description, not game_clock_start', async function () {
      // These two disagree on nearly every snapped play: game_clock_start is the
      // snap clock and the film feed indexes on the description's clock. Using
      // the column drops the exact-hit rate from 96% to 65%.
      await seed_play({
        play_id: 100,
        game_clock_start: '14:19',
        play_description: '(14:22) (Shotgun) K.Turpin right end to PHI 42.'
      })

      const url = await film_url(100)
      expect(url).to.include('gameClock=14:22')
      expect(url).to.not.include('14:19')
    })

    it('zero-pads a single-digit minute', async function () {
      // `3:01` returns zero plays from the film API; `03:01` returns the play.
      await seed_play({
        play_id: 101,
        game_clock_start: '03:01',
        play_description: '(3:01) (Shotgun) D.Prescott pass short left.'
      })

      expect(await film_url(101)).to.include('gameClock=03:01')
    })

    it('falls back to game_clock_start when the description has no prefix', async function () {
      await seed_play({
        play_id: 102,
        play_type: 'KOFF',
        game_clock_start: '15:00',
        play_description: 'J.Elliott kicks 60 yards from PHI 35 to DAL 5.'
      })

      expect(await film_url(102)).to.include('gameClock=15:00')
    })
  })

  describe('playType', function () {
    it('is sent for a scrimmage play too', async function () {
      // What collides on a clock is usually a play of a different type -- the
      // kickoff or extra point NFL Pro stamps with the same clock, which sorts
      // first and wins. Restricting playType to special teams left 31 of 595
      // plays opening the wrong clip; sending it everywhere left 4.
      await seed_play({
        play_id: 110,
        play_type: 'RUSH',
        play_description: '(14:54) J.Williams left tackle to PHI 46.'
      })

      expect(await film_url(110)).to.include('playType=play_type_rush')
    })

    it('routes a sack to its own filter value rather than to pass', async function () {
      // A sack is a PASS in our play_type and play_type_sack in theirs. Sending
      // play_type_pass for one is the single way this parameter returns an empty
      // list instead of the play.
      await seed_play({
        play_id: 113,
        play_type: 'PASS',
        is_sack: true,
        play_description: '(08:00) J.Hurts sacked at PHI 20 for -7 yards.'
      })
      await seed_play({
        play_id: 114,
        play_type: 'PASS',
        play_description: '(07:00) J.Hurts pass short left to D.Goedert.'
      })

      expect(await film_url(113)).to.include('playType=play_type_sack')
      expect(await film_url(114)).to.include('playType=play_type_pass')
    })

    it('splits FGXP into the extra point and field goal filters', async function () {
      // An extra point shares its clock with the kickoff that follows it, which
      // is the collision playType exists to break.
      await seed_play({
        play_id: 111,
        play_type: 'FGXP',
        game_clock_start: '11:49',
        play_description: 'B.Aubrey extra point is GOOD, Center-T.Sieg.'
      })
      await seed_play({
        play_id: 112,
        play_type: 'FGXP',
        game_clock_start: '02:00',
        play_description: 'B.Aubrey 42 yard field goal is GOOD, Center-T.Sieg.'
      })

      expect(await film_url(111)).to.include('playType=play_type_xp')
      expect(await film_url(112)).to.include('playType=play_type_field_goal')
    })
  })

  describe('week slug', function () {
    it('renders the regular season as WEEK_n', async function () {
      await seed_play({
        play_id: 120,
        week: 12,
        play_description: '(10:00) pass short left.'
      })

      expect(await film_url(120)).to.include('weekSlug=WEEK_12')
    })

    it('renders the postseason round rather than its week number', async function () {
      await seed_play({
        play_id: 121,
        season_type: 'POST',
        week: 3,
        play_description: '(10:00) pass short left.'
      })

      expect(await film_url(121)).to.include('weekSlug=CONF')
    })

    it('renders the preseason as Pn', async function () {
      await seed_play({
        play_id: 122,
        season_type: 'PRE',
        week: 2,
        play_description: '(10:00) pass short left.'
      })

      expect(await film_url(122)).to.include('weekSlug=P2')
    })
  })

  describe('rows that get no link', function () {
    it('returns null before film coverage begins', async function () {
      await seed_play({
        play_id: 130,
        season_year: 2021,
        play_description: '(10:00) pass short left.'
      })

      expect(await film_url(130)).to.equal(null)
    })

    it('returns null for a row that is not a play that was run', async function () {
      // A timeout carries a clock, so without this gate it would link to
      // whichever play happened to share that second.
      await seed_play({
        play_id: 131,
        play_type: 'NOPL',
        game_clock_start: '11:49',
        play_description: 'Timeout at 11:49.'
      })

      expect(await film_url(131)).to.equal(null)
    })
  })

  it('assembles every parameter the film room needs', async function () {
    await seed_play({
      play_id: 140,
      quarter: 3,
      week: 5,
      play_description: '(07:23) S.Barkley left tackle to DAL 3.'
    })

    const url = new URL(await film_url(140))
    expect(url.origin + url.pathname).to.equal('https://pro.nfl.com/film/plays')
    expect(Object.fromEntries(url.searchParams)).to.deep.equal({
      season: '2025',
      seasonType: 'REG',
      weekSlug: 'WEEK_5',
      gameId: String(esbid),
      quarter: '3',
      gameClock: '07:23',
      playType: 'play_type_pass'
    })
  })
})
