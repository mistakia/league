/* global describe it */
import * as chai from 'chai'

import {
  resolve_canonical_nfl_team,
  nfl_team_franchise_eras,
  nfl_team_spelling_aliases,
  canonical_nfl_teams,
  non_franchise_nfl_teams
} from '#libs-shared/nfl-team-franchise-eras.mjs'
import { fixTeam } from '#libs-shared'

const expect = chai.expect

/*
  The three collisions below are the whole point of this module, and each is
  pinned on BOTH sides of its split year. A resolver that answers "canonical
  returns itself" before consulting the season passes the STL cases and fails
  the BAL and HOU ones, which is exactly the bug this spec exists to catch --
  those two tokens are canonical abbreviations AND earlier franchises' era
  abbreviations, so the wrong ordering is invisible from the token alone.
*/
describe('libs-shared nfl-team-franchise-eras', function () {
  describe('resolve_canonical_nfl_team season-first ordering', function () {
    it('resolves BAL in 1975 to IND, not to itself', function () {
      expect(
        resolve_canonical_nfl_team({ era_nfl_team: 'BAL', season_year: 1975 })
      ).to.equal('IND')
    })

    it('resolves BAL in 1996 to BAL, the Ravens', function () {
      expect(
        resolve_canonical_nfl_team({ era_nfl_team: 'BAL', season_year: 1996 })
      ).to.equal('BAL')
    })

    it('resolves BAL either side of the Colts split year', function () {
      expect(
        resolve_canonical_nfl_team({ era_nfl_team: 'BAL', season_year: 1983 })
      ).to.equal('IND')
      expect(
        resolve_canonical_nfl_team({ era_nfl_team: 'BAL', season_year: 2024 })
      ).to.equal('BAL')
    })

    it('resolves HOU in 1980 to TEN, not to itself', function () {
      expect(
        resolve_canonical_nfl_team({ era_nfl_team: 'HOU', season_year: 1980 })
      ).to.equal('TEN')
    })

    it('resolves HOU either side of the Oilers split year', function () {
      expect(
        resolve_canonical_nfl_team({ era_nfl_team: 'HOU', season_year: 1996 })
      ).to.equal('TEN')
      expect(
        resolve_canonical_nfl_team({ era_nfl_team: 'HOU', season_year: 2002 })
      ).to.equal('HOU')
    })

    it('resolves STL to two different franchises by season', function () {
      expect(
        resolve_canonical_nfl_team({ era_nfl_team: 'STL', season_year: 1975 })
      ).to.equal('ARI')
      expect(
        resolve_canonical_nfl_team({ era_nfl_team: 'STL', season_year: 2000 })
      ).to.equal('LA')
    })

    it('resolves STL either side of the Cardinals-to-Rams gap', function () {
      expect(
        resolve_canonical_nfl_team({ era_nfl_team: 'STL', season_year: 1987 })
      ).to.equal('ARI')
      expect(
        resolve_canonical_nfl_team({ era_nfl_team: 'STL', season_year: 1995 })
      ).to.equal('LA')
      expect(
        resolve_canonical_nfl_team({ era_nfl_team: 'STL', season_year: 2015 })
      ).to.equal('LA')
    })
  })

  describe('resolve_canonical_nfl_team relocated franchises', function () {
    it('resolves the Chargers era token across the move', function () {
      expect(
        resolve_canonical_nfl_team({ era_nfl_team: 'SD', season_year: 2000 })
      ).to.equal('LAC')
      expect(
        resolve_canonical_nfl_team({ era_nfl_team: 'SD', season_year: 2016 })
      ).to.equal('LAC')
      expect(
        resolve_canonical_nfl_team({ era_nfl_team: 'LAC', season_year: 2017 })
      ).to.equal('LAC')
    })

    it('resolves the Rams and Raiders Los Angeles-era tokens', function () {
      expect(
        resolve_canonical_nfl_team({ era_nfl_team: 'RAM', season_year: 1990 })
      ).to.equal('LA')
      expect(
        resolve_canonical_nfl_team({ era_nfl_team: 'RAI', season_year: 1990 })
      ).to.equal('LV')
    })

    it('resolves the Cardinals Phoenix era', function () {
      expect(
        resolve_canonical_nfl_team({ era_nfl_team: 'PHO', season_year: 1990 })
      ).to.equal('ARI')
    })

    it('resolves the Raiders Oakland feed token', function () {
      expect(
        resolve_canonical_nfl_team({ era_nfl_team: 'OAK', season_year: 2005 })
      ).to.equal('LV')
    })

    it('resolves the Patriots Boston era', function () {
      expect(
        resolve_canonical_nfl_team({ era_nfl_team: 'BOS', season_year: 1970 })
      ).to.equal('NE')
    })
  })

  describe('resolve_canonical_nfl_team pass-through cases', function () {
    it('returns a canonical token with no range entry unchanged', function () {
      expect(
        resolve_canonical_nfl_team({ era_nfl_team: 'KC', season_year: 1975 })
      ).to.equal('KC')
      expect(
        resolve_canonical_nfl_team({ era_nfl_team: 'GB', season_year: 2024 })
      ).to.equal('GB')
    })

    it('returns every canonical token unchanged in a modern season', function () {
      for (const nfl_team of canonical_nfl_teams) {
        expect(
          resolve_canonical_nfl_team({
            era_nfl_team: nfl_team,
            season_year: 2024
          })
        ).to.equal(nfl_team)
      }
    })

    it('returns the non-franchise tokens unchanged', function () {
      for (const nfl_team of non_franchise_nfl_teams) {
        expect(
          resolve_canonical_nfl_team({
            era_nfl_team: nfl_team,
            season_year: 2014
          })
        ).to.equal(nfl_team)
      }
    })
  })

  describe('resolve_canonical_nfl_team rejects what it cannot model', function () {
    it('throws on an unknown token rather than passing it through', function () {
      expect(() =>
        resolve_canonical_nfl_team({ era_nfl_team: 'XXX', season_year: 2024 })
      ).to.throw(/unknown nfl_team XXX/)
    })

    it('throws on a missing season_year rather than guessing', function () {
      expect(() =>
        resolve_canonical_nfl_team({ era_nfl_team: 'STL' })
      ).to.throw(/invalid season_year/)
    })

    it('throws on every falsy season_year that Number() would coerce to 0', function () {
      /*
        The guard used to be Number.isInteger(Number(season_year)), which
        ACCEPTS all three of these: Number(null), Number('') and Number([]) are
        0, and 0 is an integer. Resolution then ran at year 0, matched no era
        range, fell through to the canonical-identity case, and answered BAL
        for a Colts row whose season was unknown -- the module's own collision
        case, resolved wrongly and silently. Only `undefined` threw, which is
        why the omitted-key test below did not catch it.
      */
      for (const season_year of [null, '', [], {}, NaN, '   ']) {
        expect(
          () =>
            resolve_canonical_nfl_team({ era_nfl_team: 'BAL', season_year }),
          `season_year ${JSON.stringify(season_year)} must throw`
        ).to.throw(/invalid season_year/)
      }
    })

    it('still accepts a numeric string, which is what a driver may hand back', function () {
      // The green half: the guard above must reject absence without rejecting
      // a legitimately-typed year.
      expect(
        resolve_canonical_nfl_team({ era_nfl_team: 'BAL', season_year: '1975' })
      ).to.equal('IND')
    })

    it('throws on a non-numeric season_year', function () {
      expect(() =>
        resolve_canonical_nfl_team({
          era_nfl_team: 'STL',
          season_year: 'nineteen'
        })
      ).to.throw(/invalid season_year/)
    })

    it('throws on a missing era_nfl_team', function () {
      expect(() =>
        resolve_canonical_nfl_team({ era_nfl_team: null, season_year: 2024 })
      ).to.throw(/missing era_nfl_team/)
    })
  })

  describe('resolve_canonical_nfl_team vendor spelling aliases', function () {
    /*
      These are the tokens a production sweep found in neither the canonical
      set nor the era table on 2026-09-02: ARZ/BLT/CLV/HST on 239
      nfl_play_stats rows and LAR on one player.draft_team row. Before the
      alias map they THREW, which would have aborted the conform mid-file.
    */
    it('resolves each alias to its franchise', function () {
      const cases = [
        ['ARZ', 'ARI'],
        ['BLT', 'BAL'],
        ['CLV', 'CLE'],
        ['HST', 'HOU'],
        ['LAR', 'LA']
      ]

      for (const [alias, canonical] of cases) {
        // Season-independent by construction, so both ends of the corpus must
        // give the same answer -- an alias that moved with the season would be
        // an era and would belong in the table instead.
        expect(
          resolve_canonical_nfl_team({ era_nfl_team: alias, season_year: 1994 })
        ).to.equal(canonical)
        expect(
          resolve_canonical_nfl_team({ era_nfl_team: alias, season_year: 2021 })
        ).to.equal(canonical)
      }
    })

    it('agrees with fixTeam on every alias', function () {
      // The aliases exist because other code already collapses them. If this
      // map and fixTeam disagreed, the conform would write a token the rest of
      // the codebase resolves somewhere else.
      for (const [alias, canonical] of Object.entries(
        nfl_team_spelling_aliases
      )) {
        expect(fixTeam(alias)).to.equal(canonical)
      }
    })

    it('no alias shadows a canonical token or an era token', function () {
      // What makes the alias case SAFE to consult after the two season-aware
      // cases. An alias that were also canonical, or also an era token, would
      // be resolved by an earlier branch and this map would silently not apply.
      for (const alias of Object.keys(nfl_team_spelling_aliases)) {
        expect(canonical_nfl_teams, `${alias} is canonical`).to.not.include(
          alias
        )
        expect(
          nfl_team_franchise_eras.map((era) => era.era_nfl_team),
          `${alias} is an era token`
        ).to.not.include(alias)
      }
    })
  })

  describe('tokens that name one franchise across their whole history', function () {
    /*
      RAM, RAI and OAK were originally bounded to a stadium or a city era --
      RAM to 1980-1994 (the move to Anaheim, which changed neither name nor
      abbreviation), RAI to 1982-1994, OAK to 1960-2019. None of the three is
      season-ambiguous: each has only ever named one franchise, so a bound on
      them buys nothing and costs a THROW on any row outside it. That is the
      failure a too-narrow range actually produces -- it cannot mis-write a row,
      it refuses to resolve one it should have repaired.
    */
    it('resolves outside the ranges those tokens used to carry', function () {
      const cases = [
        ['RAM', 1975, 'LA'],
        ['RAM', 2024, 'LA'],
        ['RAI', 1975, 'LV'],
        ['RAI', 2024, 'LV'],
        ['OAK', 2024, 'LV']
      ]

      for (const [era_nfl_team, season_year, canonical] of cases) {
        expect(
          resolve_canonical_nfl_team({ era_nfl_team, season_year }),
          `${era_nfl_team} ${season_year}`
        ).to.equal(canonical)
      }
    })

    it('still resolves them inside the old ranges, unchanged', function () {
      // Widening must not move an answer that already resolved. These are the
      // readings the narrow ranges gave.
      expect(
        resolve_canonical_nfl_team({ era_nfl_team: 'RAM', season_year: 1990 })
      ).to.equal('LA')
      expect(
        resolve_canonical_nfl_team({ era_nfl_team: 'RAI', season_year: 1990 })
      ).to.equal('LV')
      expect(
        resolve_canonical_nfl_team({ era_nfl_team: 'OAK', season_year: 2000 })
      ).to.equal('LV')
    })

    it('does not disturb the three tokens that ARE season-ambiguous', function () {
      // The contrast that makes the widening safe: STL, BAL and HOU stay
      // bounded, because for them the season is the only thing that answers.
      expect(
        resolve_canonical_nfl_team({ era_nfl_team: 'STL', season_year: 1975 })
      ).to.equal('ARI')
      expect(
        resolve_canonical_nfl_team({ era_nfl_team: 'STL', season_year: 2000 })
      ).to.equal('LA')
      expect(
        resolve_canonical_nfl_team({ era_nfl_team: 'BAL', season_year: 1975 })
      ).to.equal('IND')
      expect(
        resolve_canonical_nfl_team({ era_nfl_team: 'BAL', season_year: 2020 })
      ).to.equal('BAL')
    })
  })

  describe('nfl_team_franchise_eras table', function () {
    it('resolves every era entry to a canonical abbreviation', function () {
      for (const era of nfl_team_franchise_eras) {
        expect(canonical_nfl_teams).to.include(era.canonical_nfl_team)
      }
    })

    it('has no overlapping range for the same token', function () {
      const by_token = new Map()
      for (const era of nfl_team_franchise_eras) {
        const list = by_token.get(era.era_nfl_team) || []
        list.push(era)
        by_token.set(era.era_nfl_team, list)
      }

      for (const [era_nfl_team, list] of by_token) {
        const sorted = [...list].sort((a, b) => a.start_year - b.start_year)
        for (let i = 1; i < sorted.length; i++) {
          expect(
            sorted[i - 1].end_year,
            `${era_nfl_team} range ending null cannot be followed by another`
          ).to.not.equal(null)
          expect(
            sorted[i].start_year,
            `${era_nfl_team} ranges overlap`
          ).to.be.greaterThan(sorted[i - 1].end_year)
        }
      }
    })
  })
})
