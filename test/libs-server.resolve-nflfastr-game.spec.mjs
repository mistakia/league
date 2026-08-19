/* global describe before it */
import * as chai from 'chai'

import db from '#db'
import {
  build_nflfastr_game_resolver,
  build_matchup_key,
  safe_fix_team
} from '#libs-server/nflfastr/resolve-nflfastr-game.mjs'

const { expect } = chai

// The 2021 REG week 15 COVID-rescheduling week, where nflfastR's old_game_id
// disagrees with our esbid on nine games. Six of those nine name a real esbid
// belonging to a DIFFERENT game in the same week, which is the shape that wrote
// one game's epa and is_qb_dropback onto another game's plays.
const WEEK_15_GAMES = [
  // esbid,      home,  away,  feed old_game_id
  [2021121600, 'LAC', 'KC', 2021121600],
  [2021121801, 'IND', 'NE', 2021121801],
  [2021121900, 'BAL', 'GB', 2021121900],
  [2021121901, 'DET', 'ARI', 2021121903],
  [2021121902, 'JAX', 'HOU', 2021121905],
  [2021121903, 'NYG', 'DAL', 2021121907],
  [2021121904, 'PIT', 'TEN', 2021121909],
  [2021121905, 'DEN', 'CIN', 2021121910],
  [2021121906, 'SF', 'ATL', 2021121911],
  [2021121908, 'TB', 'NO', 2021121913],
  [2021121909, 'BUF', 'CAR', 2021121901],
  [2021121910, 'MIA', 'NYJ', 2021121906]
]

const feed_row = ({ home, away, old_game_id, week = 15, season = 2021 }) => ({
  game_id: `${season}_${week}_${away}_${home}`,
  old_game_id: old_game_id === null ? null : String(old_game_id),
  season: String(season),
  week: String(week),
  season_type: 'REG',
  home_team: home,
  away_team: away
})

describe('libs-server resolve-nflfastr-game', function () {
  this.timeout(30000)

  describe('safe_fix_team', function () {
    it('normalizes a relocated franchise', () => {
      expect(safe_fix_team('SD')).to.equal('LAC')
      expect(safe_fix_team('STL')).to.equal('LA')
      expect(safe_fix_team('OAK')).to.equal('LV')
      expect(safe_fix_team('PHO')).to.equal('ARI')
      expect(safe_fix_team('RAI')).to.equal('LV')
    })

    // fixTeam once threw on PHO (live in nfl_games for the Phoenix Cardinals),
    // and this guard exists so a resolver never throws on a legacy row. PHO now
    // resolves through fixTeam; the degradation path still matters for codes
    // fixTeam genuinely rejects.
    it('degrades rather than throwing on an abbreviation fixTeam rejects', () => {
      expect(() => safe_fix_team('XYZ')).to.not.throw()
      expect(safe_fix_team('XYZ')).to.equal('XYZ')
    })

    it('returns null for an absent team', () => {
      expect(safe_fix_team(null)).to.equal(null)
      expect(safe_fix_team('')).to.equal(null)
    })
  })

  describe('build_matchup_key', function () {
    // nflfastR numbers postseason weeks continuously (18-21) while nfl_games
    // numbers them within the postseason (1-4). Keying on week makes every
    // postseason game in the corpus look like a mismatch -- 336 phantom
    // cross-matches on a first pass over the real data.
    it('excludes week so postseason numbering cannot split a game', () => {
      const feed_side = build_matchup_key({
        season_year: 2021,
        season_type: 'POST',
        home_team: 'KC',
        away_team: 'BUF'
      })
      const our_side = build_matchup_key({
        season_year: 2021,
        season_type: 'POST',
        home_team: 'KC',
        away_team: 'BUF'
      })
      expect(feed_side).to.equal(our_side)
      expect(feed_side).to.not.include('18')
    })

    it('normalizes both teams through fixTeam', () => {
      expect(
        build_matchup_key({
          season_year: 2016,
          season_type: 'REG',
          home_team: 'SD',
          away_team: 'STL'
        })
      ).to.equal(
        build_matchup_key({
          season_year: 2016,
          season_type: 'REG',
          home_team: 'LAC',
          away_team: 'LA'
        })
      )
    })

    it('collapses every non-REG game type onto POST', () => {
      const wildcard = build_matchup_key({
        season_year: 2021,
        season_type: 'WC',
        home_team: 'KC',
        away_team: 'BUF'
      })
      const divisional = build_matchup_key({
        season_year: 2021,
        season_type: 'DIV',
        home_team: 'KC',
        away_team: 'BUF'
      })
      expect(wildcard).to.equal(divisional)
    })
  })

  describe('build_nflfastr_game_resolver', function () {
    before(async () => {
      await db('nfl_games').where({ season_year: 2021 }).del()
      await db('nfl_games').insert(
        WEEK_15_GAMES.map(([esbid, home, away]) => ({
          esbid,
          season_year: 2021,
          week: 15,
          season_type: 'REG',
          home_nfl_team: home,
          away_nfl_team: away
        }))
      )
    })

    it('resolves a game whose old_game_id agrees with the matchup', async () => {
      const resolver = await build_nflfastr_game_resolver({ year: 2021 })
      const result = resolver.resolve(
        feed_row({ home: 'LAC', away: 'KC', old_game_id: 2021121600 })
      )
      expect(result.esbid).to.equal(2021121600)
      expect(result.method).to.equal('direct')
    })

    // The defect. old_game_id 2021121903 IS a real esbid -- it is DAL@NYG --
    // so an absence-only fallback never fires and the plays match the wrong
    // game rather than failing to match.
    it('corrects a cross-match where old_game_id names a real but wrong game', async () => {
      const resolver = await build_nflfastr_game_resolver({ year: 2021 })
      const result = resolver.resolve(
        feed_row({ home: 'DET', away: 'ARI', old_game_id: 2021121903 })
      )
      expect(result.esbid).to.equal(2021121901)
      expect(result.method).to.equal('matchup_corrected')

      const correction = resolver.corrections.find(
        (entry) => entry.feed_game_id === '2021_15_ARI_DET'
      )
      expect(correction).to.exist
      expect(correction.collided_with_esbid).to.equal(2021121903)
    })

    it('resolves a game whose old_game_id names nothing at all', async () => {
      const resolver = await build_nflfastr_game_resolver({ year: 2021 })
      const result = resolver.resolve(
        feed_row({ home: 'NYG', away: 'DAL', old_game_id: 2021121907 })
      )
      expect(result.esbid).to.equal(2021121903)
      expect(result.method).to.equal('matchup_corrected')
    })

    it('resolves all nine 2021 week 15 disagreements to the right esbid', async () => {
      const resolver = await build_nflfastr_game_resolver({ year: 2021 })
      for (const [esbid, home, away, old_game_id] of WEEK_15_GAMES) {
        const result = resolver.resolve(feed_row({ home, away, old_game_id }))
        expect(result.esbid, `${away}@${home}`).to.equal(esbid)
      }
      expect(resolver.stats.direct).to.equal(3)
      expect(resolver.stats.matchup_corrected).to.equal(9)
      expect(resolver.stats.refused_ambiguous).to.equal(0)
      expect(resolver.stats.refused_no_matchup).to.equal(0)
    })

    // resolve() is called per PLAY. Without memoization a single corrected game
    // reports one correction per play, and games_refused -- which feeds the
    // import's per-game oracle -- over-reports by three orders of magnitude.
    it('counts corrections per game rather than per call', async () => {
      const resolver = await build_nflfastr_game_resolver({ year: 2021 })
      const row = feed_row({
        home: 'DET',
        away: 'ARI',
        old_game_id: 2021121903
      })
      for (let i = 0; i < 180; i++) {
        resolver.resolve(row)
      }
      expect(resolver.stats.matchup_corrected).to.equal(1)
      expect(resolver.corrections).to.have.length(1)
    })

    it('refuses rather than guessing when the matchup is absent', async () => {
      const resolver = await build_nflfastr_game_resolver({ year: 2021 })
      const result = resolver.resolve(
        feed_row({ home: 'SEA', away: 'LA', old_game_id: 2021121600 })
      )
      expect(result.esbid).to.equal(null)
      expect(result.method).to.equal('refused_no_matchup')
      expect(resolver.refusals).to.have.length(1)
      // The refusal must name the collision rather than silently trusting it.
      expect(resolver.refusals[0].reason).to.include('2021121600')
    })

    it('refuses a feed row carrying no old_game_id and no known matchup', async () => {
      const resolver = await build_nflfastr_game_resolver({ year: 2021 })
      const result = resolver.resolve(
        feed_row({ home: 'SEA', away: 'LA', old_game_id: null })
      )
      expect(result.esbid).to.equal(null)
      expect(result.method).to.equal('refused_no_matchup')
    })
  })
})
