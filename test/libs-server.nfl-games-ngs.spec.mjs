/* global describe before afterEach after it */
import * as chai from 'chai'

import db from '#db'
import {
  format,
  select_game_inserts,
  upsert_game
} from '#libs-server/nfl-games-ngs.mjs'

const expect = chai.expect

/*
  The two defects increment D fixes in the NGS games importer, and the reason
  each needs the other.

  The importer upserted on the TEAM PAIR (away, home, week, season_year,
  season_type). That key cannot survive the abbreviation conform: once a stored
  row is relabelled SD -> LAC, a feed still supplying SD no longer matches it,
  so the upsert stops updating the game it means to update. Repointing the key
  to `esbid` fixes that -- but only for rows that HAVE an esbid, and
  nfl_games.esbid is nullable, so the falsy-gameId skip is not a separate
  tidy-up. It is what makes the new key sound.

  These live against the suite's own database rather than as a fixture test,
  because the half that fails silently is the CONFLICT RESOLUTION, which only
  Postgres can answer.
*/

// Outside every seeded fixture's range, so these rows cannot collide with
// another spec's and a leftover cannot be mistaken for one.
const esbid = 99200001

const feed_item = (overrides = {}) => ({
  gameId: esbid,
  gameKey: '58001',
  smartId: 'a-smart-id',
  season: 2016,
  seasonType: 'REG',
  week: 5,
  weekNameAbbr: 'REG',
  gameDate: '10/09/2016',
  gameTimeEastern: '13:00:00',
  time: 'America/New_York',
  visitorTeamAbbr: 'SD',
  homeTeamAbbr: 'OAK',
  site: { siteFullName: 'A Stadium', siteId: 1 },
  score: {},
  ...overrides
})

const clear = async () => db('nfl_games').where({ esbid }).del()

describe('libs-server / nfl-games-ngs', function () {
  this.timeout(30000)

  before(clear)
  afterEach(clear)
  after(clear)

  describe('select_game_inserts', function () {
    it('skips a feed item carrying no gameId', () => {
      const { inserts, skipped_missing_esbid } = select_game_inserts([
        feed_item(),
        feed_item({ gameId: undefined }),
        feed_item({ gameId: null }),
        feed_item({ gameId: '' }),
        feed_item({ gameId: 0 })
      ])

      // Every falsy shape the feed has produced, not just the absent key: an
      // empty string and a zero are as unusable as an undefined one, and each
      // would reach ON CONFLICT (esbid) as a NULL.
      expect(skipped_missing_esbid).to.equal(4)
      expect(inserts).to.have.lengthOf(1)
      expect(inserts[0].esbid).to.equal(esbid)
    })

    it('keeps a full slate when every item carries a gameId', () => {
      // The green half. A selector that skipped everything would satisfy the
      // assertion above just as well.
      const { inserts, skipped_missing_esbid } = select_game_inserts([
        feed_item({ gameId: esbid }),
        feed_item({ gameId: esbid + 1 }),
        feed_item({ gameId: esbid + 2 })
      ])

      expect(skipped_missing_esbid).to.equal(0)
      expect(inserts).to.have.lengthOf(3)
    })

    it('normalises the era abbreviations the feed supplies', () => {
      // fixTeam maps the feed's SD and OAK to the current tokens. This is
      // recorded because it is the reason the OLD conflict key breaks: what is
      // written here is LAC/LV while the feed said SD/OAK.
      const row = format(feed_item())
      expect(row.away_nfl_team).to.equal('LAC')
      expect(row.home_nfl_team).to.equal('LV')
    })
  })

  describe('upsert_game', function () {
    const stored = () => db('nfl_games').where({ esbid })

    it('UPDATES a stored row whose team abbreviation differs from the feed', async () => {
      // The conformed state: the row already carries the current tokens.
      await db('nfl_games').insert({
        esbid,
        season_year: 2016,
        week: 5,
        season_type: 'REG',
        away_nfl_team: 'LAC',
        home_nfl_team: 'LV',
        home_score: 0
      })

      // A feed row for the same game. It agrees on esbid and, after fixTeam,
      // on the teams too -- but the score has moved, which is what an update
      // has to carry.
      await upsert_game(
        format(feed_item({ score: { homeTeamScore: { pointTotal: 27 } } }))
      )

      const rows = await stored()
      expect(
        rows,
        'the game must be updated, never duplicated'
      ).to.have.lengthOf(1)
      expect(rows[0].home_score).to.equal(27)
    })

    it('updates rather than duplicating when the STORED row holds an era token', async () => {
      // The pre-conform state, and the case the old key gets wrong: the stored
      // row carries SD while the feed, through fixTeam, resolves to LAC.
      await db('nfl_games').insert({
        esbid,
        season_year: 2016,
        week: 5,
        season_type: 'REG',
        away_nfl_team: 'SD',
        home_nfl_team: 'OAK',
        home_score: 0
      })

      await upsert_game(
        format(feed_item({ score: { homeTeamScore: { pointTotal: 31 } } }))
      )

      const rows = await stored()
      expect(rows).to.have.lengthOf(1)
      // esbid identified the game despite the teams disagreeing, and the
      // merge carried the current abbreviations onto it.
      expect(rows[0].away_nfl_team).to.equal('LAC')
      expect(rows[0].home_nfl_team).to.equal('LV')
      expect(rows[0].home_score).to.equal(31)
    })

    it('the OLD team-pair conflict key fails on the same row', async () => {
      // The control. Without it, the two assertions above are equally
      // consistent with a key that never needed changing.
      await db('nfl_games').insert({
        esbid,
        season_year: 2016,
        week: 5,
        season_type: 'REG',
        away_nfl_team: 'SD',
        home_nfl_team: 'OAK',
        home_score: 0
      })

      const insert = format(feed_item())
      let raised = null
      try {
        await db('nfl_games')
          .insert(insert)
          .onConflict([
            'away_nfl_team',
            'home_nfl_team',
            'week',
            'season_year',
            'season_type'
          ])
          .merge()
      } catch (error) {
        raised = error
      }

      // The stored pair is (SD, OAK) and the incoming pair is (LAC, LV), so the
      // old arbiter matches nothing and the statement falls through to a plain
      // INSERT -- which then collides with the game's own esbid.
      expect(raised, 'the old conflict key must not silently succeed').to.exist
      expect(raised.message).to.match(/esbid/)

      const rows = await stored()
      expect(rows).to.have.lengthOf(1)
      expect(rows[0].home_score, 'the update never landed').to.equal(0)
    })
  })
})
