/* global describe it */

import * as chai from 'chai'

import db from '#db'
import {
  player_participation_weeks_cte_sql,
  PLAYER_PARTICIPATION_WEEKS_CTE
} from '#libs-server/data-views/player-team-bridge-cte.mjs'
import {
  register_participation_status_ctes,
  join_participation_status_ctes,
  participation_status_select,
  participation_year_reference
} from '#libs-server/data-views/participation-status-cte.mjs'

const expect = chai.expect

describe('data-views participation status', () => {
  describe('player_participation_weeks_cte_sql', () => {
    it('relaxes the active filter and groups at (pid, year, week)', () => {
      const sql = player_participation_weeks_cte_sql({ year_range: [2025] })

      // the active = TRUE filter present in player_years_teams_cte_sql MUST be
      // absent here -- we need inactive weeks to produce rows too
      expect(sql).to.not.match(/active\s*=\s*TRUE/i)
      // REG-scoped, per-year-partitioned source join (same shape as the bridge)
      expect(sql).to.match(/player_gamelogs_year_2025/)
      expect(sql).to.match(/g\.seas_type\s*=\s*'REG'/)
      expect(sql).to.match(/INNER JOIN nfl_games g ON g\.esbid = pgl\.esbid/)
      // active carried through as bool_or to defend against duplicate week rows
      expect(sql).to.match(/bool_or\(active\) AS active/)
      // grouped at week grain
      expect(sql).to.match(/GROUP BY pid, year, week/)
    })

    it('spans every year in the range via UNION ALL', () => {
      const sql = player_participation_weeks_cte_sql({
        year_range: [2024, 2025]
      })
      expect(sql).to.match(/player_gamelogs_year_2024/)
      expect(sql).to.match(/player_gamelogs_year_2025/)
      expect(sql).to.match(/UNION ALL/)
    })

    it('appends extra columns at both the inner projection and outer aggregate', () => {
      const sql = player_participation_weeks_cte_sql({
        year_range: [2025],
        columns: [
          { inner: 'pgl.started', outer: 'bool_or(started) AS started' }
        ]
      })
      expect(sql).to.match(/pgl\.active, pgl\.started/)
      expect(sql).to.match(
        /bool_or\(active\) AS active, bool_or\(started\) AS started/
      )
    })

    it('throws on empty year_range', () => {
      expect(() =>
        player_participation_weeks_cte_sql({ year_range: [] })
      ).to.throw(/non-empty year_range/)
    })

    it('exports a stable CTE name', () => {
      expect(PLAYER_PARTICIPATION_WEEKS_CTE).to.equal(
        'player_participation_weeks'
      )
    })
  })

  describe('participation_status_select', () => {
    const refs = {
      pid_reference: 'player.pid',
      year_reference: 'player_years_weeks.year',
      week_reference: 'player_years_weeks.week'
    }

    it('emits exactly the active / bye / NULL arms', () => {
      const sql = participation_status_select(refs)
      expect(sql).to.match(
        /WHEN player_participation_weeks\.active THEN 'active'/
      )
      expect(sql).to.match(/THEN 'bye'/)
      expect(sql).to.match(/ELSE NULL/)
      // exactly two WHEN arms (active, bye) -- no inactive/dnp dead precision
      expect((sql.match(/WHEN /g) || []).length).to.equal(2)
    })

    it('classifies bye via no-gamelog-row + no-team-played NOT EXISTS', () => {
      const sql = participation_status_select(refs)
      expect(sql).to.match(/player_participation_weeks\.pid IS NULL/)
      expect(sql).to.match(/player_years_teams\.teams IS NOT NULL/)
      expect(sql).to.match(/NOT EXISTS/)
      expect(sql).to.match(
        /team_weeks_played\.team = ANY\(player_years_teams\.teams\)/
      )
      // correlates on the supplied week/year references
      expect(sql).to.match(/team_weeks_played\.week = player_years_weeks\.week/)
    })
  })

  describe('register / join composition', () => {
    const make_query_context = () => ({
      registered_ctes: new Set(),
      joined_participation_ctes: new Set()
    })

    it('registers the participation, team-set, and team-weeks CTEs (idempotent)', () => {
      const players_query = db('player').select('*')
      const query_context = make_query_context()
      register_participation_status_ctes({
        players_query,
        query_context,
        year_range: [2025]
      })
      // second call is a no-op (no duplicate registration / throw)
      register_participation_status_ctes({
        players_query,
        query_context,
        year_range: [2025]
      })

      const sql = players_query.toString()
      expect(sql).to.match(/"player_participation_weeks" as/)
      expect(sql).to.match(/"player_years_teams" as/)
      expect(sql).to.match(/"team_weeks_played" as/)
      expect(query_context.registered_ctes.has('player_participation_weeks')).to
        .be.true
      expect(query_context.registered_ctes.has('team_weeks_played')).to.be.true
    })

    it('LEFT JOINs participation + team-set 1:1 (idempotent, no team_weeks_played join)', () => {
      const players_query = db('player').select('*')
      const query_context = make_query_context()
      const join_args = {
        players_query,
        query_context,
        pid_reference: 'player.pid',
        year_reference: 'player_years_weeks.year',
        week_reference: 'player_years_weeks.week'
      }
      join_participation_status_ctes(join_args)
      join_participation_status_ctes(join_args)

      const sql = players_query.toString()
      expect(
        (sql.match(/left join "player_participation_weeks"/g) || []).length
      ).to.equal(1)
      expect(
        (sql.match(/left join "player_years_teams"/g) || []).length
      ).to.equal(1)
      // team_weeks_played is read via NOT EXISTS, never joined (would fan rows)
      expect(sql).to.not.match(/join "team_weeks_played"/)
      // year reference resolves to the in-scope week source, never the
      // un-joined player_years lower-grain CTE
      expect(sql).to.not.match(
        /"player_participation_weeks"\."year" = "player_years"\."year"/
      )
    })

    it('derives the year reference from the in-scope week source CTE', () => {
      expect(
        participation_year_reference({
          week_reference: 'player_years_weeks.week'
        })
      ).to.equal('player_years_weeks.year')
    })
  })
})
