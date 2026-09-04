/* global describe it */
import * as chai from 'chai'
import * as table_constants from 'react-table/src/constants.mjs'

import derive_plays_percentile_stats from '../app/core/plays-view/derive-plays-percentile-stats.mjs'

const expect = chai.expect

// Percentile shading fails SILENTLY in both directions, which is why this is a
// spec rather than a browser check. A stat key the cell cannot find shades
// nothing and raises nothing; a key it finds for a column that should not shade
// paints an identifier column and raises nothing either. Neither shows up in a
// build, a lint or a type check.
//
// The keying is the part that breaks. react-table's table-cell.js looks its
// percentile up under `${accessorKey}_${column_index}` when the table sets
// `enable_duplicate_column_ids` and under the bare `accessorKey` otherwise. No
// plays table sets it, so the bare form is the correct one here -- and the
// data-views page, which every plays change is tempted to copy, uses the other.
const fields = {
  play_epa: {
    data_type: table_constants.TABLE_DATA_TYPES.NUMBER
  },
  play_yards_to_go: {
    data_type: table_constants.TABLE_DATA_TYPES.NUMBER,
    reverse_percentiles: true
  },
  play_year: {
    data_type: table_constants.TABLE_DATA_TYPES.NUMBER,
    disable_percentiles: true
  },
  play_desc: {
    data_type: table_constants.TABLE_DATA_TYPES.TEXT
  },
  play_td: {
    data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN
  },
  play_box_defenders: {
    data_type: table_constants.TABLE_DATA_TYPES.NUMBER,
    reverse_percentiles: (params) => Boolean(params.reverse_shading)
  }
}

describe('plays view percentile stats', function () {
  it('keys on the bare column id, not the data-views index-suffixed form', () => {
    const { percentile_stat_keys } = derive_plays_percentile_stats({
      table_state_columns: ['play_epa'],
      plays_view_fields: fields
    })

    expect(percentile_stat_keys).to.deep.equal(['play_epa'])
    // The failure this pins: a key of `play_epa_0` matches no cell.
    expect(percentile_stat_keys[0]).to.not.match(/_\d+$/)
  })

  it('includes numeric columns and excludes text and boolean ones', () => {
    const { percentile_stat_keys } = derive_plays_percentile_stats({
      table_state_columns: ['play_epa', 'play_desc', 'play_td'],
      plays_view_fields: fields
    })

    expect(percentile_stat_keys).to.deep.equal(['play_epa'])
  })

  it('excludes a numeric column marked disable_percentiles', () => {
    const { percentile_stat_keys } = derive_plays_percentile_stats({
      table_state_columns: ['play_year', 'play_epa'],
      plays_view_fields: fields
    })

    expect(percentile_stat_keys).to.deep.equal(['play_epa'])
  })

  it('marks a reversed column, and leaves an ordinary one unmarked', () => {
    const { reverse_percentile_stats } = derive_plays_percentile_stats({
      table_state_columns: ['play_epa', 'play_yards_to_go'],
      plays_view_fields: fields
    })

    expect(reverse_percentile_stats).to.deep.equal({ play_yards_to_go: true })
  })

  it('resolves a function-valued reverse_percentiles against column params', () => {
    const on = derive_plays_percentile_stats({
      table_state_columns: [
        { column_id: 'play_box_defenders', params: { reverse_shading: true } }
      ],
      plays_view_fields: fields
    })
    const off = derive_plays_percentile_stats({
      table_state_columns: [
        { column_id: 'play_box_defenders', params: { reverse_shading: false } }
      ],
      plays_view_fields: fields
    })

    // Asserted as a PAIR: a resolver that always returned false, or one that
    // never ran, would satisfy either reading on its own.
    expect(on.reverse_percentile_stats).to.deep.equal({
      play_box_defenders: true
    })
    expect(off.reverse_percentile_stats).to.deep.equal({})
  })

  it('accepts both the string and the object column forms', () => {
    const { percentile_stat_keys } = derive_plays_percentile_stats({
      table_state_columns: ['play_epa', { column_id: 'play_yards_to_go' }],
      plays_view_fields: fields
    })

    expect(percentile_stat_keys).to.deep.equal(['play_epa', 'play_yards_to_go'])
  })

  it('emits one key for a column added twice', () => {
    const { percentile_stat_keys } = derive_plays_percentile_stats({
      table_state_columns: ['play_epa', 'play_epa'],
      plays_view_fields: fields
    })

    // Both instances share one bare key by construction, so a duplicate entry
    // would make calculatePercentiles compute the same stat twice.
    expect(percentile_stat_keys).to.deep.equal(['play_epa'])
  })

  it('skips a column id absent from the registry', () => {
    const { percentile_stat_keys } = derive_plays_percentile_stats({
      table_state_columns: ['play_epa', 'play_not_a_real_column'],
      plays_view_fields: fields
    })

    expect(percentile_stat_keys).to.deep.equal(['play_epa'])
  })
})
