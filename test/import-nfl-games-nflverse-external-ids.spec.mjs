/* global describe it */
import * as chai from 'chai'

import {
  format_game,
  resolve_espn_game_id,
  find_ambiguous_espn_game_ids,
  find_stale_espn_game_id_corrections
} from '#scripts/import-nfl-games-nflverse-nfldata.mjs'

const expect = chai.expect

/*
  nfl_games.pfr_game_id and espn_game_id were 0 of 15,622 rows populated while
  this feed supplied both keys, because format_game deliberately dropped them.

  Every fixture value below is taken from the real nflverse games.csv payload
  (fetched 2026-09-02) and cross-checked against ESPN's own event API. The wrong
  espn ids in particular would not survive being invented: the whole point is
  that the feed really does hand one game's id to another.
*/

const no_ambiguity = { ambiguous_espn_game_ids: new Set() }

// 2024 week 1 opener, Ravens at Chiefs. Modern 401-prefixed id, feed correct.
const ravens_at_chiefs = {
  game_id: '2024_01_BAL_KC',
  pfr: '202409050kan',
  espn: '401671789'
}

// 2003 week 3. The feed gives BOTH this game and Jets at Patriots the id
// 230921017; ESPN says 230921017 is Jets at Patriots and this game is
// 230921011.
const jaguars_at_colts = {
  game_id: '2003_03_JAX_IND',
  pfr: '200309210clt',
  espn: '230921017'
}

// The owner of 230921017, which the feed gets right.
const jets_at_patriots = {
  game_id: '2003_03_NYJ_NE',
  pfr: '200309210nwe',
  espn: '230921017'
}

// The Music City Miracle. The feed's 200109010 is not an ESPN event at all --
// the digits of the 2000-01-08 date are transposed. The real id is 200108010.
const bills_at_titans = {
  game_id: '1999_18_BUF_TEN',
  pfr: '200001080oti',
  espn: '200109010'
}

// A wrong feed value that collides with nothing, so no uniqueness check could
// ever have caught it: the feed gives this game Kansas City at Cincinnati's id.
const rams_at_bears = {
  game_id: '2003_11_STL_CHI',
  pfr: '200311160chi',
  espn: '231116004'
}

describe('import-nfl-games-nflverse external ids', function () {
  describe('format_game', function () {
    it('writes pfr_game_id from the feed', function () {
      const game = format_game(ravens_at_chiefs, no_ambiguity)
      expect(game.pfr_game_id).to.equal('202409050kan')
    })

    it('writes espn_game_id as an integer, not the feed string', function () {
      const game = format_game(ravens_at_chiefs, no_ambiguity)
      expect(game.espn_game_id).to.equal(401671789)
    })

    it('trims whitespace off pfr_game_id', function () {
      const game = format_game(
        { ...ravens_at_chiefs, pfr: '  202409050kan  ' },
        no_ambiguity
      )
      expect(game.pfr_game_id).to.equal('202409050kan')
    })

    it('leaves both keys null when the feed omits them', function () {
      const game = format_game(
        { game_id: '2024_01_BAL_KC', pfr: null, espn: null },
        no_ambiguity
      )
      expect(game.pfr_game_id).to.equal(null)
      expect(game.espn_game_id).to.equal(null)
    })

    it('drops a non-numeric espn value rather than writing NaN', function () {
      const game = format_game(
        { ...ravens_at_chiefs, espn: '4016717x9' },
        no_ambiguity
      )
      expect(game.espn_game_id).to.equal(null)
    })

    it('drops an espn value that overflows a 32-bit integer column', function () {
      const game = format_game(
        { ...ravens_at_chiefs, espn: '2147483648' },
        no_ambiguity
      )
      expect(game.espn_game_id).to.equal(null)
    })

    it('writes the corrected espn id, not the wrong one the feed supplies', function () {
      const game = format_game(jaguars_at_colts, no_ambiguity)
      expect(game.espn_game_id).to.equal(230921011)
    })

    it('leaves the game the feed gets right untouched', function () {
      const game = format_game(jets_at_patriots, no_ambiguity)
      expect(game.espn_game_id).to.equal(230921017)
    })

    it('corrects a feed value that points at no ESPN event at all', function () {
      const game = format_game(bills_at_titans, no_ambiguity)
      expect(game.espn_game_id).to.equal(200108010)
    })

    it('corrects a wrong feed value that collides with nothing', function () {
      const game = format_game(rams_at_bears, no_ambiguity)
      expect(game.espn_game_id).to.equal(231116003)
    })

    it('drops an espn id shared by more than one game, for every game in the group', function () {
      const ambiguous = { ambiguous_espn_game_ids: new Set(['401671789']) }
      const game = format_game(ravens_at_chiefs, ambiguous)

      expect(game.espn_game_id).to.equal(null)
      // pfr is unaffected -- only the espn value is in doubt.
      expect(game.pfr_game_id).to.equal('202409050kan')
    })

    it('does not write an ftn_game_id, which has no column', function () {
      const game = format_game(
        { ...ravens_at_chiefs, ftn: '5555' },
        no_ambiguity
      )
      expect(game).to.not.have.property('ftn_game_id')
    })
  })

  describe('resolve_espn_game_id', function () {
    it('prefers a correction over the feed value', function () {
      expect(resolve_espn_game_id(jaguars_at_colts)).to.equal('230921011')
    })

    it('falls through to the feed value when there is no correction', function () {
      expect(resolve_espn_game_id(ravens_at_chiefs)).to.equal('401671789')
    })

    it('returns null when the feed supplies nothing and no correction applies', function () {
      expect(resolve_espn_game_id({ game_id: '2024_01_BAL_KC' })).to.equal(null)
    })
  })

  describe('find_ambiguous_espn_game_ids', function () {
    it('sees no collision once the corrections are applied', function () {
      // The uncorrected feed gives both of these 230921017.
      const ambiguous = find_ambiguous_espn_game_ids([
        jaguars_at_colts,
        jets_at_patriots
      ])
      expect(ambiguous.size).to.equal(0)
    })

    it('reports a collision the corrections do not cover', function () {
      const ambiguous = find_ambiguous_espn_game_ids([
        ravens_at_chiefs,
        { game_id: '2024_01_XXX_YYY', espn: '401671789' }
      ])
      expect([...ambiguous]).to.eql(['401671789'])
    })

    it('does not treat repeated absences as a collision', function () {
      const ambiguous = find_ambiguous_espn_game_ids([
        { game_id: 'a', espn: null },
        { game_id: 'b', espn: null },
        { game_id: 'c', espn: '   ' }
      ])
      expect(ambiguous.size).to.equal(0)
    })
  })

  describe('find_stale_espn_game_id_corrections', function () {
    it('reports a correction the feed has since adopted itself', function () {
      const stale = find_stale_espn_game_id_corrections([
        { game_id: '2003_03_JAX_IND', espn: '230921011' }
      ])
      expect(stale).to.include('2003_03_JAX_IND')
    })

    it('does not report a correction the feed still needs', function () {
      const stale = find_stale_espn_game_id_corrections([jaguars_at_colts])
      expect(stale).to.not.include('2003_03_JAX_IND')
    })
  })
})
