/* global describe it */
import * as chai from 'chai'

import parse_table_state_from_url from '../app/core/data-views/parse-table-state-from-url.mjs'

chai.should()
const expect = chai.expect

const build = (params) => {
  const sp = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    sp.set(key, value)
  }
  return sp
}

describe('parse_table_state_from_url', function () {
  it('parses each of the supported keys into the superset shape', () => {
    const sp = build({
      columns: JSON.stringify(['player_name']),
      prefix_columns: JSON.stringify(['player_position']),
      where: JSON.stringify([
        { column_id: 'player_position', operator: '=', value: 'QB' }
      ]),
      sort: JSON.stringify([{ column_id: 'player_name', desc: false }]),
      splits: JSON.stringify(['year']),
      view_name: 'My View',
      view_search_column_id: 'player_name',
      view_description: 'Notes'
    })

    const out = parse_table_state_from_url(sp)
    out.columns.should.deep.equal(['player_name'])
    out.prefix_columns.should.deep.equal(['player_position'])
    out.where.should.have.length(1)
    out.where[0].should.include({
      column_id: 'player_position',
      operator: '=',
      value: 'QB'
    })
    out.sort.should.have.length(1)
    out.sort[0].column_id.should.equal('player_name')
    out.splits.should.deep.equal(['year'])
    out.view_name.should.equal('My View')
    out.view_search_column_id.should.equal('player_name')
    out.view_description.should.equal('Notes')
  })

  it('parses view_id from the URL', () => {
    const sp = build({
      view_id: '1fd23039-c8c8-4774-bdb8-a8e98083706a'
    })
    const out = parse_table_state_from_url(sp)
    out.view_id.should.equal('1fd23039-c8c8-4774-bdb8-a8e98083706a')
  })

  it('defaults missing params to [] / "" matching prior inline-parser behavior', () => {
    const sp = build({})
    const out = parse_table_state_from_url(sp)
    out.columns.should.deep.equal([])
    out.prefix_columns.should.deep.equal([])
    out.where.should.deep.equal([])
    out.sort.should.deep.equal([])
    out.splits.should.deep.equal([])
    out.q.should.equal('')
    out.rank_aggregation.should.deep.equal({})
    out.scatter_plot_options.should.deep.equal({})
    out.disable_scatter_plot.should.equal(false)
    out.view_id.should.equal('')
    out.view_name.should.equal('')
    out.view_search_column_id.should.equal('')
    out.view_description.should.equal('')
  })

  it('parses q, rank_aggregation, scatter_plot_options, disable_scatter_plot, view_search_column_id', () => {
    const sp = build({
      q: 'mahomes',
      rank_aggregation: JSON.stringify({ weights: { a: 1.0 } }),
      scatter_plot_options: JSON.stringify({ x: 'a', y: 'b' }),
      disable_scatter_plot: 'true',
      view_search_column_id: 'player_name'
    })
    const out = parse_table_state_from_url(sp)
    out.q.should.equal('mahomes')
    out.rank_aggregation.should.deep.equal({ weights: { a: 1.0 } })
    out.scatter_plot_options.should.deep.equal({ x: 'a', y: 'b' })
    out.disable_scatter_plot.should.equal(true)
    out.view_search_column_id.should.equal('player_name')
  })

  it('returns a flat object shape (not the helper two-key wrapper) so call sites destructure unchanged', () => {
    const sp = build({ columns: JSON.stringify(['a']), view_id: 'v1' })
    const out = parse_table_state_from_url(sp)
    out.should.have.property('columns')
    out.should.have.property('view_id')
    out.should.not.have.property('table_state')
    out.should.not.have.property('view_fields')
  })

  it('treats "null" json values as empty arrays / strings', () => {
    const sp = build({
      columns: 'null',
      prefix_columns: 'null',
      where: 'null',
      sort: 'null',
      splits: 'null'
    })
    const out = parse_table_state_from_url(sp)
    out.columns.should.deep.equal([])
    out.prefix_columns.should.deep.equal([])
    out.where.should.deep.equal([])
    out.sort.should.deep.equal([])
    out.splits.should.deep.equal([])
  })

  it('applies migrate_entries_array to columns (legacy single-week column gets nfl_week_id)', () => {
    const sp = build({
      columns: JSON.stringify([
        {
          column_id: 'player_dfs_salary',
          params: { year: 2024, week: 1, seas_type: 'REG' }
        }
      ])
    })
    const out = parse_table_state_from_url(sp)
    out.columns.should.have.length(1)
    const migrated = out.columns[0]
    migrated.column_id.should.equal('player_dfs_salary')
    expect(migrated.params.year).to.be.undefined
    expect(migrated.params.week).to.be.undefined
    expect(migrated.params.seas_type).to.be.undefined
    migrated.params.single_nfl_week_id.should.be.an('array').with.length(1)
    migrated.params.single_nfl_week_id[0].should.equal('2024_REG_WEEK_1')
  })

  it('applies migrate_entries_array to prefix_columns and where', () => {
    const sp = build({
      prefix_columns: JSON.stringify([
        {
          column_id: 'player_games_played',
          params: { year: 2023, week: 5, seas_type: 'REG' }
        }
      ]),
      where: JSON.stringify([
        {
          column_id: 'player_dfs_salary',
          operator: '>',
          value: 5000,
          params: { year: 2024, week: 2, seas_type: 'REG' }
        }
      ])
    })
    const out = parse_table_state_from_url(sp)
    out.prefix_columns[0].params.nfl_week_id.should.deep.equal([
      '2023_REG_WEEK_5'
    ])
    out.where[0].params.single_nfl_week_id.should.deep.equal([
      '2024_REG_WEEK_2'
    ])
    out.where[0].operator.should.equal('>')
    out.where[0].value.should.equal(5000)
  })

  it('applies migrate_sort_array to legacy ranking sort entries', () => {
    const sp = build({
      sort: JSON.stringify([
        { column_id: 'player_overall_ranking', desc: true }
      ])
    })
    const out = parse_table_state_from_url(sp)
    out.sort[0].column_id.should.equal('player_season_overall_ranking')
    out.sort[0].desc.should.equal(true)
  })

  it('round-trips a year-array-columns + per_team_pass_play URL into the shape both pages dispatch', () => {
    const columns = [
      {
        column_id: 'player_pass_yds_from_plays',
        params: {
          year: [2022, 2023, 2024],
          rate_type: ['per_team_pass_play']
        }
      }
    ]
    const sp = build({
      columns: JSON.stringify(columns),
      prefix_columns: JSON.stringify(['player_name', 'player_nfl_teams']),
      where: JSON.stringify([]),
      sort: JSON.stringify([
        { column_id: 'player_pass_yds_from_plays_0', desc: true }
      ]),
      splits: JSON.stringify(['year']),
      view_name: 'Pass yds 22-24'
    })
    const out = parse_table_state_from_url(sp)
    out.columns.should.have.length(1)
    out.columns[0].column_id.should.equal('player_pass_yds_from_plays')
    out.columns[0].params.year.should.deep.equal([2022, 2023, 2024])
    out.columns[0].params.rate_type.should.deep.equal(['per_team_pass_play'])
    out.prefix_columns.should.deep.equal(['player_name', 'player_nfl_teams'])
    out.sort[0].column_id.should.equal('player_pass_yds_from_plays_0')
    out.splits.should.deep.equal(['year'])
    out.view_name.should.equal('Pass yds 22-24')
  })
})
