/* global describe it before */
import * as chai from 'chai'

import { get_data_view_results_query } from '#libs-server'
import get_data_view_hash from '#libs-server/data-views/get-data-view-hash.mjs'
import validate_line_axis_columns from '#libs-server/data-views/validate-line-axis-columns.mjs'

import { identity_for } from '#libs-server/data-views/row-grain-registry.mjs'
import {
  get_identity,
  identities
} from '#libs-server/data-views/identities.mjs'
// The rule modules self-register on import; the registry alone is empty.
import '#libs-server/data-views/source-attach/rules/index.mjs'
import {
  rules,
  resolve as resolve_source_attach
} from '#libs-server/data-views/source-attach/source-attach-registry.mjs'
import {
  has_bridge,
  resolve as resolve_bridge
} from '#libs-server/data-views/identity-bridge-registry.mjs'
import {
  is_line_axis_active,
  is_ladder_market_type,
  resolve_line_axis_sources
} from '#libs-server/data-views/line-axis-sources.mjs'
import { bookmaker_constants } from '#libs-shared'

const expect = chai.expect

describe('data views line row axis', function () {
  describe('identity resolution', function () {
    it('resolves the line identity under year, week and line', () => {
      expect(
        identity_for({
          row_grain_id: 'player',
          row_axes: ['year', 'week', 'line']
        })
      ).to.equal('player_year_week_line')
    })

    // The whole point of adding a branch to a function every existing request
    // already goes through: none of them may move.
    it('leaves the existing player resolutions unchanged', () => {
      expect(identity_for({ row_grain_id: 'player', row_axes: [] })).to.equal(
        'player'
      )
      expect(
        identity_for({ row_grain_id: 'player', row_axes: ['year'] })
      ).to.equal('player_year')
      expect(
        identity_for({ row_grain_id: 'player', row_axes: ['year', 'week'] })
      ).to.equal('player_year_week')
      expect(
        identity_for({ row_grain_id: 'player', row_axes: ['week'] })
      ).to.equal('player_year_week')
    })

    it('leaves the existing team resolutions unchanged', () => {
      expect(identity_for({ row_grain_id: 'team', row_axes: [] })).to.equal(
        'team'
      )
      expect(
        identity_for({ row_grain_id: 'team', row_axes: ['year'] })
      ).to.equal('team_year')
      expect(
        identity_for({ row_grain_id: 'team', row_axes: ['year', 'week'] })
      ).to.equal('team_year_week')
    })

    it('refuses a line axis without a week axis', () => {
      expect(() =>
        identity_for({ row_grain_id: 'player', row_axes: ['year', 'line'] })
      ).to.throw(/requires 'week'/)
    })

    it('refuses a line axis at team grain', () => {
      expect(() =>
        identity_for({
          row_grain_id: 'team',
          row_axes: ['year', 'week', 'line']
        })
      ).to.throw(/not supported for row_grain 'team'/)
    })
  })

  describe('identity shape', function () {
    it('keys on the line alongside pid, year and week', () => {
      const identity = get_identity('player_year_week_line')
      expect(identity.key_columns).to.eql([
        'pid',
        'year',
        'week',
        'selection_metric_line'
      ])
      expect(identity.row_axes).to.eql(['year', 'week', 'line'])
      expect(identity.row_grain).to.equal('player')
    })

    // year and week deliberately reference the week relation rather than the
    // line CTE; see the identity's comment for why the shallower one is safe.
    it('sources year and week from the week relation', () => {
      const identity = get_identity('player_year_week_line')
      expect(identity.year_column).to.equal('player_years_weeks.year')
      expect(identity.week_column).to.equal('player_years_weeks.week')
      expect(identity.line_column).to.equal(
        'player_years_weeks_lines.selection_metric_line'
      )
    })
  })

  describe('bridge registration', function () {
    it('registers a bridge from the week identity to the line identity', () => {
      expect(has_bridge('player_year_week', 'player_year_week_line')).to.equal(
        true
      )
      const bridge = resolve_bridge('player_year_week', 'player_year_week_line')
      expect(bridge.from).to.equal('player_year_week')
      expect(bridge.to).to.equal('player_year_week_line')
    })

    // A line axis whose rungs nothing defines is an un-answerable request, and
    // an empty domain would render an empty view that reads like "no data".
    it('refuses to build the rung CTE with no market source', () => {
      const bridge = resolve_bridge('player_year_week', 'player_year_week_line')
      const query_context = {
        players_query: {
          with: () => {
            throw new Error('should not register a CTE')
          }
        },
        registered_ctes: new Set(),
        line_axis_sources: [],
        year_range: [2024],
        week_range: [1]
      }
      expect(() => bridge.add_cte({ query_context })).to.throw(
        /nothing defines the rungs/
      )
    })
  })

  describe('line axis source resolution', function () {
    const data_views_column_definitions = {
      player_game_prop_line_from_betting_markets: {
        is_player_game_prop: true
      },
      player_game_prop_american_odds_from_betting_markets: {
        is_player_game_prop: true
      },
      player_week_projected_points: {}
    }

    it('is inactive without the axis', () => {
      expect(is_line_axis_active([])).to.equal(false)
      expect(is_line_axis_active(['year', 'week'])).to.equal(false)
      expect(is_line_axis_active(['year', 'week', 'line'])).to.equal(true)
    })

    it('reads market selectors off betting columns only', () => {
      const sources = resolve_line_axis_sources({
        columns: [
          {
            column_id: 'player_game_prop_line_from_betting_markets',
            params: {
              market_type: ['GAME_ALT_PASSING_YARDS'],
              source_id: ['FANDUEL'],
              time_type: ['CLOSE'],
              selection_type: ['OVER']
            }
          },
          { column_id: 'player_week_projected_points', params: {} }
        ],
        data_views_column_definitions
      })
      expect(sources).to.have.length(1)
      expect(sources[0].market_type).to.eql(['GAME_ALT_PASSING_YARDS'])
      expect(sources[0].source_id).to.eql(['FANDUEL'])
    })

    // Line and odds on one market are one domain entry, not two: they select
    // the same selections, so unioning them twice would be unioning the rung
    // set with itself.
    it('collapses two columns reading different values of one market', () => {
      const params = {
        market_type: ['GAME_ALT_PASSING_YARDS'],
        source_id: ['FANDUEL'],
        time_type: ['CLOSE'],
        selection_type: ['OVER']
      }
      const sources = resolve_line_axis_sources({
        columns: [
          {
            column_id: 'player_game_prop_line_from_betting_markets',
            params
          },
          {
            column_id: 'player_game_prop_american_odds_from_betting_markets',
            params
          }
        ],
        data_views_column_definitions
      })
      expect(sources).to.have.length(1)
    })

    // Two books on one market type is the line-shopping case and must produce
    // two arms, so the rung domain is their union.
    it('keeps two books on one market type as two sources', () => {
      const sources = resolve_line_axis_sources({
        columns: [
          {
            column_id: 'player_game_prop_line_from_betting_markets',
            params: {
              market_type: ['GAME_ALT_PASSING_YARDS'],
              source_id: ['FANDUEL']
            }
          },
          {
            column_id: 'player_game_prop_line_from_betting_markets',
            params: {
              market_type: ['GAME_ALT_PASSING_YARDS'],
              source_id: ['DRAFTKINGS']
            }
          }
        ],
        data_views_column_definitions
      })
      expect(sources).to.have.length(2)
    })

    // The ladder predicate itself. A standard market posts one selection per
    // player-game and defines no rungs, so admitting it both polluted the
    // domain with its own line and made the same-quantity rule count it as a
    // second quantity -- which refused the reported view outright.
    it('separates a ladder market from a single-line one', () => {
      expect(is_ladder_market_type('GAME_ALT_PASSING_YARDS')).to.equal(true)
      expect(
        is_ladder_market_type('GAME_FIRST_QUARTER_ALT_RUSHING_YARDS')
      ).to.equal(true)
      expect(is_ladder_market_type('GAME_PASSING_YARDS')).to.equal(false)
      expect(is_ladder_market_type('GAME_RECEIVING_YARDS')).to.equal(false)
      expect(is_ladder_market_type(undefined)).to.equal(false)
    })

    // The predicate reads the constant groups, not the substring ALT. The two
    // agree today across the whole Market control, and that agreement is the
    // reason the string match was never worth writing -- pinned so a future
    // ladder that is not named ALT fails here rather than silently collapsing.
    it('agrees with the constant groups across every offered market', () => {
      const offered = Object.values(bookmaker_constants.player_game_prop_types)
      const by_predicate = offered.filter(is_ladder_market_type)
      const by_substring = offered.filter((market_type) =>
        market_type.includes('ALT')
      )
      expect(by_predicate).to.eql(by_substring)
      expect(by_predicate.length).to.be.greaterThan(0)
      expect(by_predicate.length).to.be.lessThan(offered.length)
    })

    // The shape the UI actually produces: market_type is a SELECT carrying a
    // default_value, so a column built through the Market control always names
    // one explicitly. An explicit single-line market must contribute no rungs.
    it('skips a betting column on an explicit single-line market', () => {
      const sources = resolve_line_axis_sources({
        columns: [
          {
            column_id: 'player_game_prop_line_from_betting_markets',
            params: {
              market_type: ['GAME_PASSING_YARDS'],
              source_id: ['FANDUEL']
            }
          }
        ],
        data_views_column_definitions
      })
      expect(sources).to.eql([])
    })

    // A betting column naming no market_type takes a single-line default and
    // contributes no rungs, so it must not enter the domain.
    it('skips a betting column with no explicit market_type', () => {
      const sources = resolve_line_axis_sources({
        columns: [
          {
            column_id: 'player_game_prop_line_from_betting_markets',
            params: { source_id: ['FANDUEL'] }
          }
        ],
        data_views_column_definitions
      })
      expect(sources).to.have.length(0)
    })
  })
  // The half that makes the axis do anything: with it live the markets CTE
  // stops deduping and the join selects the rung. Emitted-SQL assertions rather
  // than executed rows, because CI holds no betting data at all -- the executed
  // oracle for the ladder belongs in a seeded result-equivalence fixture.
  describe('markets CTE under the axis', function () {
    const market_params = {
      source_id: ['FANDUEL'],
      selection_type: ['OVER'],
      time_type: ['CLOSE'],
      single_nfl_week_id: ['2024_REG_WEEK_1', '2024_REG_WEEK_2'],
      market_type: ['GAME_ALT_PASSING_YARDS']
    }

    const emit = async (row_axes) => {
      const { query } = await get_data_view_results_query({
        columns: [
          {
            column_id: 'player_game_prop_line_from_betting_markets',
            params: market_params
          },
          {
            column_id: 'player_game_prop_american_odds_from_betting_markets',
            params: market_params
          }
        ],
        prefix_columns: ['player_name'],
        row_axes,
        row_grain: ['player']
      })
      return String(query)
    }

    let without_axis
    let with_axis

    before(async function () {
      without_axis = await emit(['year', 'week'])
      with_axis = await emit(['year', 'week', 'line'])
    })

    it('keeps the dedup and builds no rung CTE without the axis', () => {
      expect(without_axis).to.match(/distinct on/)
      expect(without_axis).to.not.include('player_years_weeks_lines')
    })

    it('suppresses the dedup under the axis', () => {
      expect(with_axis).to.not.match(/distinct on/)
    })

    it('builds the rung CTE and correlates the join on the rung', () => {
      expect(with_axis).to.include('player_years_weeks_lines')
      // Quoted on the CTE side, bare on the reference side, because the
      // reference is emitted through db.raw from the identity.
      expect(with_axis).to.match(
        /"selection_metric_line" = player_years_weeks_lines\.selection_metric_line/
      )
    })

    // Line and odds share one CTE, so the rendered pair always belongs to one
    // selection. Rows multiplying is exactly the change that could break that,
    // which is why it is asserted here rather than assumed.
    it('keeps line and odds on one shared CTE', () => {
      const cte_names = [
        ...with_axis.matchAll(/"(t[0-9a-f]{32})" as (?:materialized )?\(/g)
      ].map((match) => match[1])
      expect(new Set(cte_names).size).to.equal(1)
    })

    // Suppressing the dedup also removed the optimization fence it incidentally
    // provided, and Postgres then inlined this CTE into the join and re-probed
    // prop_markets_index once per candidate cell -- 203,456 loops per column on
    // a single week, which took the saved 18-week view past the 40s statement
    // timeout. The fence has to be asked for explicitly once the dedup is gone.
    it('materializes the market CTE under the axis', () => {
      expect(with_axis).to.match(/"t[0-9a-f]{32}" as materialized \(/)
    })

    // Gated, not unconditional: without the axis the dedup is back and the same
    // 18-week request measured the same either way, so materializing there
    // would take on planner risk for nothing.
    it('leaves the market CTE un-materialized without the axis', () => {
      expect(without_axis).to.not.match(/"t[0-9a-f]{32}" as materialized \(/)
    })
  })
  // The same-quantity rule. Two books on one market type share a rung and
  // compare like with like; two market types share only a numeral.
  describe('same-quantity rule', function () {
    const defs = {
      player_game_prop_line_from_betting_markets: { is_player_game_prop: true }
    }
    const column = (market_type, source_id = 'FANDUEL') => ({
      column_id: 'player_game_prop_line_from_betting_markets',
      params: { market_type: [market_type], source_id: [source_id] }
    })

    it('admits two books on one market type', () => {
      const errors = validate_line_axis_columns({
        row_axes: ['year', 'week', 'line'],
        columns: [
          column('GAME_ALT_PASSING_YARDS', 'FANDUEL'),
          column('GAME_ALT_PASSING_YARDS', 'DRAFTKINGS')
        ],
        defs
      })
      expect(errors).to.eql([])
    })

    it('refuses two market types and names both columns', () => {
      const errors = validate_line_axis_columns({
        row_axes: ['year', 'week', 'line'],
        columns: [
          column('GAME_ALT_PASSING_YARDS'),
          column('GAME_ALT_RUSHING_YARDS')
        ],
        defs
      })
      expect(errors).to.have.length(1)
      expect(errors[0]).to.include('GAME_ALT_PASSING_YARDS')
      expect(errors[0]).to.include('GAME_ALT_RUSHING_YARDS')
      expect(errors[0]).to.include('player_game_prop_line_from_betting_markets')
    })

    // The rule is scoped to the axis: the same pair of columns without it is an
    // ordinary two-column request and must stay legal.
    it('says nothing without the axis', () => {
      const errors = validate_line_axis_columns({
        row_axes: ['year', 'week'],
        columns: [
          column('GAME_ALT_PASSING_YARDS'),
          column('GAME_ALT_RUSHING_YARDS')
        ],
        defs
      })
      expect(errors).to.eql([])
    })
  })

  // The four refusals, asserted through the REAL request pipeline rather than
  // by calling each rule directly.
  //
  // WHY BOTH. The blocks above call identity_for and
  // validate_line_axis_columns in isolation, so they prove each rule computes
  // the right answer -- and stay green if a rule is never reached. A validator
  // that exists and is never called is the failure mode these cover, and it is
  // not hypothetical for this feature: validate_line_axis_columns is invoked
  // from exactly one line of get-data-view-results, and nothing above would
  // notice that line being dropped.
  //
  // These cannot live in test/data-view-queries/ instead. Neither fixture
  // runner has any notion of an expected error -- a fixture whose request
  // throws is a red test, not a passing refusal -- so a refusal is only
  // expressible as a spec.
  describe('refusals through the request pipeline', function () {
    const ladder_column = (market_type) => ({
      column_id: 'player_game_prop_line_from_betting_markets',
      params: {
        market_type: [market_type],
        source_id: ['FANDUEL'],
        time_type: ['CLOSE'],
        selection_type: ['OVER'],
        single_nfl_week_id: ['2023_REG_WEEK_1']
      }
    })

    const rejects = async (request, pattern) => {
      let error = null
      try {
        await get_data_view_results_query(request)
      } catch (err) {
        error = err
      }
      expect(error, 'expected the request to be refused').to.not.equal(null)
      expect(error.message).to.match(pattern)
    }

    // A line is posted for one game, so a year-only view would stack every
    // week's ladders onto one rung value.
    it('refuses a line axis without a week axis', async () => {
      await rejects(
        {
          columns: [ladder_column('GAME_ALT_PASSING_YARDS')],
          row_axes: ['year', 'line'],
          row_grain: ['player']
        },
        /requires 'week'/
      )
    })

    // Anchored on a team-grain column, because a player-grain column at team
    // grain is refused first by ColumnRowGrainMismatch and would pass this
    // assertion without the axis rule ever running.
    it('refuses a line axis at team grain', async () => {
      await rejects(
        {
          columns: ['team_name'],
          row_axes: ['year', 'week', 'line'],
          row_grain: ['team']
        },
        /not supported for row_grain 'team'/
      )
    })

    it('refuses two ladder columns on different market types', async () => {
      await rejects(
        {
          columns: [
            ladder_column('GAME_ALT_PASSING_YARDS'),
            ladder_column('GAME_ALT_RUSHING_YARDS')
          ],
          row_axes: ['year', 'week', 'line'],
          row_grain: ['player']
        },
        /LineAxisQuantityMismatch/
      )
    })

    // An empty rung domain would render an empty view, which reads as "this
    // player had no data" rather than as "this request cannot be answered".
    it('refuses a line axis no column defines rungs for', async () => {
      await rejects(
        {
          columns: ['player_name'],
          row_axes: ['year', 'week', 'line'],
          row_grain: ['player']
        },
        /nothing defines the rungs/
      )
    })
  })

  // The route layer needs no change -- `line` rides inside row_axes, which
  // /search and the export route already forward whole. What that leaves worth
  // pinning is the CACHE key: the row_grain omission that put two grains on one
  // key is the precedent, and a shared key here would feed rung rows back as
  // flat ones.
  describe('cache key separation', function () {
    it('hashes a line-axis request differently', () => {
      const base = {
        columns: ['player_name'],
        row_grain: ['player'],
        user_id: null
      }
      const without_axis = get_data_view_hash({
        ...base,
        row_axes: ['year', 'week']
      })
      const with_axis = get_data_view_hash({
        ...base,
        row_axes: ['year', 'week', 'line']
      })
      expect(with_axis).to.not.equal(without_axis)
    })
  })

  // The axis shipped with an identity, a row grain and a bridge, but with no
  // source-attach rule naming the identity it introduced -- so every column
  // routed through attach_source threw `No source-attach rule for
  // (cell=player_year_week_line, ...)` the moment the axis went live, and the
  // saved view /u/4f45c2424b9601a740045d428b97e44d rendered an error instead of
  // a ladder. The betting columns were the ones that worked, which is why the
  // rest of this file never saw it: they carry their own `with`/`join` and
  // never reach the dispatcher, and `player_name` reads straight off the FROM
  // table. A column with a joined SOURCE is the case that was missing.
  describe('non-betting columns under the axis', function () {
    const projection_params = {
      nfl_week_id: ['2024_REG_WEEK_1', '2024_REG_WEEK_2'],
      sourceid: [18]
    }

    let with_axis

    before(async function () {
      const { query } = await get_data_view_results_query({
        columns: [
          {
            column_id: 'player_game_prop_line_from_betting_markets',
            params: {
              source_id: ['FANDUEL'],
              selection_type: ['OVER'],
              time_type: ['CLOSE'],
              single_nfl_week_id: ['2024_REG_WEEK_1', '2024_REG_WEEK_2'],
              market_type: ['GAME_ALT_RECEIVING_YARDS']
            }
          },
          {
            column_id: 'player_week_projected_rec_yds',
            params: projection_params
          }
        ],
        prefix_columns: ['player_name'],
        row_axes: ['year', 'week', 'line'],
        row_grain: ['player']
      })
      with_axis = String(query)
    })

    it('attaches a source-joined column rather than refusing it', () => {
      expect(with_axis).to.include('projections_index')
    })

    // The rung is a dimension the projection has no column for, so it repeats
    // down the ladder. Correlating it on pid, year and week and NOT on the rung
    // is what produces that, and is the whole reason the parent identity's rule
    // is the right one to reuse.
    it('correlates it on pid, year and week without a rung predicate', () => {
      // Anchored on the RELATION, not on a bare alias shape: every join in a
      // data-view query carries a get_table_hash alias, so a pattern matching
      // the alias alone is satisfied by any of the twenty-odd joins here.
      const projection_join = with_axis.match(
        /(?:inner|left) join "projections_index" as "(t[0-9a-f]{32})" on (.*?)(?= (?:inner|left) join | where | group by |$)/
      )
      expect(projection_join, 'projection join not emitted').to.not.equal(null)

      const [, alias, join_predicate] = projection_join
      expect(join_predicate).to.include(`"${alias}"."pid" = "player"."pid"`)
      expect(join_predicate).to.include(
        `${alias}.season_year = player_years_weeks.year`
      )
      expect(join_predicate).to.include(
        `${alias}.week = player_years_weeks.week`
      )
      expect(join_predicate).to.not.include('selection_metric_line')
    })
  })

  // The registration gap above was a whole CLASS, not one pair: six rule files
  // each enumerate the cell identities they serve, and the axis added a seventh
  // identity to none of them. Rather than enumerate it seven more times, the
  // identity declares what it refines and the registry walks that -- so what is
  // worth pinning is the walk, on the population the identity table defines
  // rather than on the pairs this incident happened to surface.
  describe('refined cell identities reach their parent rules', function () {
    it('declares the line identity as a refinement of the week identity', () => {
      expect(get_identity('player_year_week_line').refines).to.equal(
        'player_year_week'
      )
    })

    it('resolves every parent rule from every refining identity', () => {
      const refining_identity_ids = Object.values(identities)
        .filter((identity) => identity.refines)
        .map((identity) => identity.id)

      // A vacuous pass if the filter ever finds nothing; the assertion below
      // reads green on an empty population by construction.
      expect(refining_identity_ids).to.not.be.empty

      const unreachable = []
      for (const identity_id of refining_identity_ids) {
        const { refines } = get_identity(identity_id)
        for (const rule of rules.values()) {
          if (rule.cell_identity !== refines) continue
          if (
            resolve_source_attach(identity_id, rule.source_grain, rule.mode)
          ) {
            continue
          }
          unreachable.push(
            `${identity_id} cannot reach ${refines}|${rule.source_grain}|${rule.mode}`
          )
        }
      }

      expect(unreachable).to.deep.equal([])
    })

    // The walk must not manufacture a rule the parent does not have either --
    // a fallback that answers everything is indistinguishable from no registry.
    it('still refuses a pair neither the identity nor its parent registers', () => {
      expect(
        resolve_source_attach('player_year_week_line', 'nonexistent_grain')
      ).to.equal(null)
    })
  })
})
