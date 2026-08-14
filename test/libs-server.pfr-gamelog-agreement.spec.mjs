/* global describe it beforeEach afterEach */
import * as chai from 'chai'

import {
  read_reference_season_file,
  read_reference_season_games,
  BOX_SCORE_STAT_FIELDS,
  SHARED_STAT_FIELDS
} from '#libs-server/pfr-gamelog-agreement.mjs'

const expect = chai.expect

/*
  The reference probe had no coverage at all, which mattered because every one
  of its failure modes is SILENT: a vocabulary drift produces totals of zero, an
  uncached game produces a short week, and both read as ordinary data rather
  than as an error.

  Stubs `globalThis.fetch` rather than the cache module, which is the house
  pattern (test/libs-shared.log.spec.mjs, test/libs-server.emit-signal.spec.mjs)
  and the only one available here -- the probe imports `get` as an ESM live
  binding, so the module object cannot be redefined. It also means these drive
  the REAL cache client, including its documented contract that a miss is a 200
  carrying `value: null` rather than a 404.
*/
describe('libs-server/pfr-gamelog-agreement', () => {
  let original_fetch

  beforeEach(() => {
    original_fetch = globalThis.fetch
  })

  afterEach(() => {
    globalThis.fetch = original_fetch
  })

  // `bodies` is keyed on the cache key. An absent key answers the way the real
  // cache route answers a miss: 200 with a null value.
  const stub_cache = (bodies) => {
    globalThis.fetch = async (url) => {
      const key = String(url).replace('https://xo.football/api/cache', '')

      if (bodies[key] === 'transport-failure') {
        return { ok: false, status: 502, statusText: 'Bad Gateway' }
      }

      return {
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({ key, value: bodies[key] ?? null })
      }
    }
  }

  describe('the per-season file reader', () => {
    it('returns null when the cache holds no season file', async () => {
      stub_cache({})

      const result = await read_reference_season_file({ season_year: 2024 })

      expect(result).to.equal(null)
    })

    it('ignores rows outside the graded season type', async () => {
      stub_cache({
        '/pro-football-reference/player-gamelogs/2022.json': [
          { seas_type: 'REG', week: 1, pfr_game_id: 'g1', rec: 5 },
          { seas_type: 'POST', week: 1, pfr_game_id: 'g2', rec: 99 }
        ]
      })

      const result = await read_reference_season_file({ season_year: 2022 })

      expect(result.get(1).totals.receptions).to.equal(5)
      expect(result.get(1).games.size).to.equal(1)
    })

    // A season file is a flat player-row list with no game-id guarantee. A
    // nullish id added to the Set would inflate the week's game count by one
    // and break the completeness equality for an undiagnosable reason.
    it('does not count a row carrying no game id toward the game count', async () => {
      stub_cache({
        '/pro-football-reference/player-gamelogs/2022.json': [
          { seas_type: 'REG', week: 1, pfr_game_id: 'g1', rec: 5 },
          { seas_type: 'REG', week: 1, pfr_game_id: null, rec: 3 }
        ]
      })

      const result = await read_reference_season_file({ season_year: 2022 })

      expect(result.get(1).games.size).to.equal(1)
      expect(result.get(1).totals.receptions).to.equal(8)
    })
  })

  describe('the per-game box-score reader', () => {
    const index_key = '/pro-football-reference/games/2024.json'

    const game_index = (ids) =>
      ids.map((pfr_game_id, position) => ({
        pfr_game_id,
        seas_type: 'REG',
        week: 1 + position
      }))

    it('counts a game only when its box score is actually cached', async () => {
      stub_cache({
        [index_key]: game_index(['a1', 'a2']),
        '/pro-football-reference/games/a1.json': {
          player_passing_rushing_receiving: [{ rec: 4, rec_yds: 40 }]
        }
        // a2 is scheduled and NOT cached, so its week must not appear at all.
      })

      const result = await read_reference_season_games({ season_year: 2024 })

      expect(result.get(1).games.size).to.equal(1)
      expect(result.has(2)).to.equal(false)
    })

    it('skips a cached game whose box score carries no player table', async () => {
      stub_cache({
        [index_key]: game_index(['c1']),
        '/pro-football-reference/games/c1.json': { some_other_table: [] }
      })

      const result = await read_reference_season_games({ season_year: 2024 })

      expect(result.size).to.equal(0)
    })

    it('returns null when the season index is absent', async () => {
      stub_cache({})

      const result = await read_reference_season_games({ season_year: 2024 })

      expect(result).to.equal(null)
    })

    // The silent one: a renamed reference field produces a total of zero and no
    // error anywhere, which the classifier then reads as a zero denominator and
    // reports un-gradeable.
    it('totals only the fields it recognises, and drops a renamed one', async () => {
      stub_cache({
        [index_key]: game_index(['d1']),
        '/pro-football-reference/games/d1.json': {
          player_passing_rushing_receiving: [
            { rec: 4, receiving_yards_renamed: 40 }
          ]
        }
      })

      const result = await read_reference_season_games({ season_year: 2024 })

      expect(result.get(1).totals.receptions).to.equal(4)
      expect(result.get(1).totals.receiving_yards).to.equal(undefined)
    })

    it('reads a numeric string and ignores a null', async () => {
      stub_cache({
        [index_key]: game_index(['e1']),
        '/pro-football-reference/games/e1.json': {
          player_passing_rushing_receiving: [
            { rec: '4', rec_yds: null },
            { rec: 2, rec_yds: 30 }
          ]
        }
      })

      const result = await read_reference_season_games({ season_year: 2024 })

      expect(result.get(1).totals.receptions).to.equal(6)
      expect(result.get(1).totals.receiving_yards).to.equal(30)
    })

    // One unreadable game out of hundreds must not take the whole check onto
    // the runner's crash path, which emits on NEITHER dedup key. Slow on
    // purpose: the cache client retries a 502 three times with 1s/2s/4s
    // backoff, so exercising the real throw costs about seven seconds.
    it('survives a box score whose read throws', async function () {
      this.timeout(20000)

      stub_cache({
        [index_key]: game_index(['b1', 'b2']),
        '/pro-football-reference/games/b1.json': 'transport-failure',
        '/pro-football-reference/games/b2.json': {
          player_passing_rushing_receiving: [{ rec: 7 }]
        }
      })

      const result = await read_reference_season_games({ season_year: 2024 })

      expect(result.get(2).totals.receptions).to.equal(7)
      expect(result.has(1)).to.equal(false)
    })
  })

  describe('the two field vocabularies', () => {
    it('map onto the same 13 of our columns', () => {
      const season_columns = Object.values(SHARED_STAT_FIELDS).sort()
      const box_score_columns = Object.values(BOX_SCORE_STAT_FIELDS).sort()

      expect(season_columns).to.have.lengthOf(13)
      expect(box_score_columns).to.deep.equal(season_columns)
    })
  })
})
