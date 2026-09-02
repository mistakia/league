/* global describe before after it */
import * as chai from 'chai'

import knex from '#db'
import {
  find_nfl_game_for_nflverse_item,
  translate_nflverse_game_params,
  count_unmatched_within_seeded_weeks
} from '#scripts/import-nfl-games-nflverse-nfldata.mjs'

const expect = chai.expect

/*
  Three tiers match a feed row to nfl_games, and each is proven here on a row
  the OTHER two cannot reach. That separation is the point: games_not_matched
  reaching zero on a fully-stamped table passes vacuously, because the
  nflverse_game_id tier alone would carry every row and a broken team path would
  look identical to a working one.

    - the Rams game is stored under era abbreviations, so no team-column match
      can reach it while nfl_games still holds STL and SD;
    - the postseason game is given neither a game_id nor an old_game_id, so only
      the translated (season_type, week) tuple can reach it -- and that tuple is
      what the pre-2026-09 matcher got wrong, having compared the feed's
      game_type WC against a stored season_type POST;
    - the modern regular-season game is the control, matching on the tuple with
      nothing unusual about it.

  Fixture values are real. 2000_05_SD_STL is Chargers at Rams in week 5 of 2000,
  one of the 575 games that received no update from this feed for any column;
  2014_18_ARI_CAR is the wild card game the feed places in week 18 and nfl_games
  stores as POST week 1.
*/

const chargers_at_rams_esbid = 2000100110
const cardinals_at_panthers_esbid = 2015010300
const ravens_at_chiefs_esbid = 2024090500

const fixture_esbids = [
  chargers_at_rams_esbid,
  cardinals_at_panthers_esbid,
  ravens_at_chiefs_esbid
]

const fixture_rows = [
  {
    esbid: chargers_at_rams_esbid,
    nflverse_game_id: '2000_05_SD_STL',
    season_year: 2000,
    season_type: 'REG',
    week: 5,
    away_nfl_team: 'SD',
    home_nfl_team: 'STL',
    date: '2000/10/01',
    time_eastern: '13:00:00'
  },
  {
    esbid: cardinals_at_panthers_esbid,
    nflverse_game_id: null,
    season_year: 2014,
    season_type: 'POST',
    week: 1,
    away_nfl_team: 'ARI',
    home_nfl_team: 'CAR',
    date: '2015/01/03',
    time_eastern: '16:35:00'
  },
  {
    esbid: ravens_at_chiefs_esbid,
    nflverse_game_id: null,
    season_year: 2024,
    season_type: 'REG',
    week: 1,
    away_nfl_team: 'BAL',
    home_nfl_team: 'KC',
    date: '2024/09/05',
    time_eastern: '20:20:00'
  }
]

const chargers_at_rams_item = {
  game_id: '2000_05_SD_STL',
  old_game_id: String(chargers_at_rams_esbid),
  season: '2000',
  game_type: 'REG',
  week: '5',
  away_team: 'SD',
  home_team: 'LA'
}

const cardinals_at_panthers_item = {
  game_id: null,
  old_game_id: null,
  season: '2014',
  game_type: 'WC',
  week: '18',
  away_team: 'ARI',
  home_team: 'CAR'
}

const ravens_at_chiefs_item = {
  game_id: null,
  old_game_id: null,
  season: '2024',
  game_type: 'REG',
  week: '1',
  away_team: 'BAL',
  home_team: 'KC'
}

describe('import-nfl-games-nflverse matcher', function () {
  before(async function () {
    await knex('nfl_games').whereIn('esbid', fixture_esbids).del()
    await knex('nfl_games').insert(fixture_rows)
  })

  after(async function () {
    await knex('nfl_games').whereIn('esbid', fixture_esbids).del()
  })

  describe('nflverse_game_id tier', function () {
    it('matches a pre-relocation game stored under era abbreviations', async function () {
      const db_game = await find_nfl_game_for_nflverse_item({
        item: chargers_at_rams_item
      })

      expect(db_game).to.not.equal(null)
      expect(db_game.esbid).to.equal(chargers_at_rams_esbid)
    })

    it('refuses a stamped row whose teams are a different matchup', async function () {
      const db_game = await find_nfl_game_for_nflverse_item({
        item: {
          ...chargers_at_rams_item,
          old_game_id: null,
          away_team: 'GB',
          home_team: 'CHI'
        }
      })

      expect(db_game).to.equal(null)
    })
  })

  describe('translated game-params tier', function () {
    /*
      The feed calls this week 18 of 2014 with game_type WC; nfl_games calls it
      POST week 1. With no game_id and no old_game_id on the item, this row is
      reachable by nothing but the translation, which is what makes it a proof
      of the translation rather than of the id tier.
    */
    it('matches a postseason game the feed encodes as WC in week 18', async function () {
      const db_game = await find_nfl_game_for_nflverse_item({
        item: cardinals_at_panthers_item
      })

      expect(db_game).to.not.equal(null)
      expect(db_game.esbid).to.equal(cardinals_at_panthers_esbid)
    })

    it('matches a regular-season game on the tuple alone', async function () {
      const db_game = await find_nfl_game_for_nflverse_item({
        item: ravens_at_chiefs_item
      })

      expect(db_game).to.not.equal(null)
      expect(db_game.esbid).to.equal(ravens_at_chiefs_esbid)
    })

    it('does not match a postseason round the table has no game for', async function () {
      const db_game = await find_nfl_game_for_nflverse_item({
        item: { ...cardinals_at_panthers_item, game_type: 'SB', week: '21' }
      })

      expect(db_game).to.equal(null)
    })
  })

  describe('esbid-only fallback', function () {
    /*
      The tiers must be independent, not one masking another. Nulling the stamp
      on the Rams game removes the only tier that can reach it by id, and the
      team columns still hold era abbreviations -- so a match here is the
      fallback working, and its team guard comparing SD@STL against the feed's
      LAC@LA in canonical terms rather than as raw tokens.
    */
    it('still matches the Rams game once its nflverse_game_id is removed', async function () {
      await knex('nfl_games')
        .where({ esbid: chargers_at_rams_esbid })
        .update({ nflverse_game_id: null })

      try {
        const db_game = await find_nfl_game_for_nflverse_item({
          item: { ...chargers_at_rams_item, game_id: null }
        })

        expect(db_game).to.not.equal(null)
        expect(db_game.esbid).to.equal(chargers_at_rams_esbid)
      } finally {
        await knex('nfl_games')
          .where({ esbid: chargers_at_rams_esbid })
          .update({ nflverse_game_id: '2000_05_SD_STL' })
      }
    })

    it('refuses an esbid whose stored matchup is a different game', async function () {
      const db_game = await find_nfl_game_for_nflverse_item({
        item: {
          ...chargers_at_rams_item,
          game_id: null,
          season: '2000',
          week: '9',
          away_team: 'GB',
          home_team: 'CHI'
        }
      })

      expect(db_game).to.equal(null)
    })
  })

  describe('translate_nflverse_game_params', function () {
    it('maps each postseason round to its stored POST week', function () {
      const rounds = { WC: 1, DIV: 2, CON: 3, SB: 4 }

      for (const [game_type, week] of Object.entries(rounds)) {
        expect(
          translate_nflverse_game_params({
            season: '2023',
            game_type,
            week: '99'
          })
        ).to.eql({ season_year: 2023, season_type: 'POST', week })
      }
    })

    it('ignores the feed week, which shifted when the season went to 18 games', function () {
      // Same round, different feed weeks either side of the 2021 change.
      const before_2021 = translate_nflverse_game_params({
        season: '2020',
        game_type: 'WC',
        week: '18'
      })
      const after_2021 = translate_nflverse_game_params({
        season: '2021',
        game_type: 'WC',
        week: '19'
      })

      expect(before_2021.week).to.equal(1)
      expect(after_2021.week).to.equal(1)
    })

    it('keeps the feed week for a regular-season row', function () {
      expect(
        translate_nflverse_game_params({
          season: '2024',
          game_type: 'REG',
          week: '12'
        })
      ).to.eql({ season_year: 2024, season_type: 'REG', week: 12 })
    })
  })
})

/*
  The shortfall oracle's exclusion filter. Seasons here are deliberately outside
  any real NFL season so the assertions read only the rows this block seeds,
  whatever else the suite has left in the table.
*/
describe('import-nfl-games-nflverse unmatched-game ceiling', function () {
  const seeded_year = 1905
  const unseeded_year = 1906
  const ceiling_esbids = [190510001, 190530001]

  before(async function () {
    await knex('nfl_games').whereIn('esbid', ceiling_esbids).del()
    await knex('nfl_games').insert([
      {
        esbid: ceiling_esbids[0],
        season_year: seeded_year,
        season_type: 'REG',
        week: 18,
        away_nfl_team: 'KC',
        home_nfl_team: 'BUF',
        date: `${seeded_year}/10/01`,
        time_eastern: '13:00:00'
      },
      {
        esbid: ceiling_esbids[1],
        season_year: seeded_year,
        season_type: 'POST',
        week: 4,
        away_nfl_team: 'PHI',
        home_nfl_team: 'SF',
        date: `${seeded_year + 1}/02/01`,
        time_eastern: '18:30:00'
      }
    ])
  })

  after(async function () {
    await knex('nfl_games').whereIn('esbid', ceiling_esbids).del()
  })

  it('counts an unmatched row inside the seeded week range', async function () {
    const count = await count_unmatched_within_seeded_weeks({
      unmatched_game_params: [
        { season_year: seeded_year, season_type: 'REG', week: 3 }
      ]
    })

    expect(count).to.equal(1)
  })

  it('excludes a row past the seeded week ceiling', async function () {
    const count = await count_unmatched_within_seeded_weeks({
      unmatched_game_params: [
        { season_year: seeded_year, season_type: 'REG', week: 19 }
      ]
    })

    expect(count).to.equal(0)
  })

  /*
    The trap this filter exists to avoid. A single per-season "maximum seeded
    week" mixes the 1-18 regular-season scale with the 1-4 postseason one, so a
    wild card row -- feed week 19, translated week 1 -- reads as past the
    ceiling and gets exempted. From 2021 onward that is every postseason row,
    which is precisely the population the matcher change exists to fix.
  */
  it('counts a postseason row whose feed week exceeds the regular-season ceiling', async function () {
    const count = await count_unmatched_within_seeded_weeks({
      unmatched_game_params: [
        translate_nflverse_game_params({
          season: String(seeded_year),
          game_type: 'WC',
          week: '19'
        })
      ]
    })

    expect(count).to.equal(1)
  })

  it('excludes a season_type with no seeded row at all', async function () {
    // The live shape of season 2026: a full REG schedule and zero POST rows.
    // Absent is not a maximum of zero, and must not be compared against one.
    const count = await count_unmatched_within_seeded_weeks({
      unmatched_game_params: [
        { season_year: unseeded_year, season_type: 'POST', week: 1 },
        { season_year: unseeded_year, season_type: 'REG', week: 1 }
      ]
    })

    expect(count).to.equal(0)
  })
})
