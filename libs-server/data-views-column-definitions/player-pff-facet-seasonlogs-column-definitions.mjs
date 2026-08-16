import { current_season } from '#constants'
import get_table_hash from '#libs-server/data-views/get-table-hash.mjs'
import { create_season_cache_info } from '#libs-server/data-views/cache-info-utils.mjs'
import { career_year, year } from '#libs-shared/common-column-params.mjs'

// The pff_player_facet_seasonlogs column family: the OL / pressure / signature
// detail the archive was ingested for and that pff_player_seasonlogs does not
// carry. Each column pins one facet via an extra_predicate -- the table is one
// row per (pid, season_year, facet) -- and reads one promoted scalar.
//
// Only facets whose scalar is POPULATED are exposed. The facet table's promoted
// scalars are populated only where the source facet carries an honest
// unprefixed total (see FACET_PROJECTIONS in
// import-pff-archive-player-facet-seasonlogs.mjs); split facets (concept,
// direction, scheme) are payload-only by verification and would render a blank
// cell. Every column here was checked against production population.
//
// Source separation. The facet table is PFF data; nothing here reconciles it
// with NFL or play-by-play data, and no non-PFF importer writes it. Note that
// the QB-side passing/allowed_pressure facet carries the same four column names
// (pressures_allowed, hurries_allowed, hits_allowed, sacks_allowed) with
// DIFFERENT values -- verified 34/247 agreement with the OL side -- so it is
// deliberately NOT exposed here: exposing it would need a disambiguated name,
// and its 1,543 rows are the small half of the population. The OL-side
// pass_blocking facet is the canonical home of those four names.

const get_pff_params = ({ params = {} }) => {
  let year_param = params.year || [current_season.stats_season_year]
  if (!Array.isArray(year_param)) {
    year_param = [year_param]
  }

  if (!year_param.length) {
    year_param = [current_season.stats_season_year]
  }

  let career_year_param = params.career_year || []
  if (!Array.isArray(career_year_param)) {
    career_year_param = [career_year_param]
  }

  return {
    year: year_param,
    career_year: career_year_param
  }
}

const get_cache_info = create_season_cache_info({
  get_params: ({ params = {} } = {}) => {
    const { year: year_param } = get_pff_params({ params })
    return { year: year_param }
  }
})

const pff_facet_seasonlogs_table_alias = ({ params = {}, facet }) => {
  const { year: year_param, career_year: career_year_param } = get_pff_params({
    params
  })

  const career_year_key = career_year_param.length
    ? `_career_year_${career_year_param.join('_')}`
    : ''

  // The facet pins a discriminator the source's join predicate carries, so it
  // belongs in the alias key -- two columns differing only by facet would
  // otherwise hash alike, collapse into one join group, and both render
  // whichever column seeded the group.
  return get_table_hash(
    `pff_player_facet_seasonlogs_${facet}_${year_param.join('_')}${career_year_key}`
  )
}

const pff_facet_seasonlogs_source = (facet) => ({
  table: 'pff_player_facet_seasonlogs',
  grain: 'player_year',
  key_columns: { pid: 'pid', year: 'season_year' },
  year_default: (params) => get_pff_params({ params }).year.map(Number),
  extra_predicates: () => [{ column: 'facet', value: facet }],
  attach: ({ query_context, params, table_alias }) => {
    const { career_year: career_year_param } = get_pff_params({ params })
    if (!career_year_param.length) return
    // Secondary INNER join + WHERE filter to constrain rows by career_year,
    // mirroring the pff_player_seasonlogs family.
    const career_year_alias = `${table_alias}_career_year`
    const { db } = query_context
    query_context.players_query
      .join(`player_seasonlogs as ${career_year_alias}`, function () {
        this.on(`${career_year_alias}.pid`, '=', `${table_alias}.pid`)
          .andOn(
            `${career_year_alias}.season_year`,
            '=',
            `${table_alias}.season_year`
          )
          .andOn(`${career_year_alias}.season_type`, '=', db.raw('?', ['REG']))
      })
      .whereBetween(`${career_year_alias}.career_year`, [
        Math.min(career_year_param[0], career_year_param[1]),
        Math.max(career_year_param[0], career_year_param[1])
      ])
  }
})

// Range year_offset reduction per column. select-string's correlated-aggregate
// path defaults to SUM, which is right for counts and wrong for rates/grades: a
// multi-year window must AVG a percentage or grade, not add it. Export so the
// parity spec can assert every key resolves to a real column -- a key that
// matches nothing silently defaults to SUM.
export const PFF_PLAYER_FACET_RANGE_OFFSET_AGGREGATE = {
  pressures_allowed: 'SUM',
  hurries_allowed: 'SUM',
  hits_allowed: 'SUM',
  sacks_allowed: 'SUM',
  pass_blocking_efficiency: 'AVG',
  pass_block_percent: 'AVG',
  true_pass_set_snaps: 'SUM',
  true_pass_set_grade: 'AVG',
  true_pass_set_pressures_allowed: 'SUM',
  pressure_percentage: 'AVG',
  time_in_pocket: 'AVG',
  targets: 'SUM',
  receptions: 'SUM',
  facet_yards: 'SUM',
  facet_touchdowns: 'SUM'
}

const create_field_from_pff_player_facet_seasonlogs = ({
  facet,
  column_name
}) => ({
  column_name,
  select_as: () => `pff_${column_name}`,
  table_alias: ({ params = {} }) =>
    pff_facet_seasonlogs_table_alias({ params, facet }),
  source: pff_facet_seasonlogs_source(facet),
  range_offset_aggregate: PFF_PLAYER_FACET_RANGE_OFFSET_AGGREGATE[column_name],
  column_params: { year, career_year },
  get_cache_info
})

export default {
  // OL pass-blocking detail (facet offense/pass_blocking) -- the OL-side
  // pressure family. All nine populated at 100% (true_pass_set_grade 7,724 of
  // 12,712).
  player_pff_pressures_allowed: create_field_from_pff_player_facet_seasonlogs({
    facet: 'offense/pass_blocking',
    column_name: 'pressures_allowed'
  }),
  player_pff_hurries_allowed: create_field_from_pff_player_facet_seasonlogs({
    facet: 'offense/pass_blocking',
    column_name: 'hurries_allowed'
  }),
  player_pff_hits_allowed: create_field_from_pff_player_facet_seasonlogs({
    facet: 'offense/pass_blocking',
    column_name: 'hits_allowed'
  }),
  player_pff_sacks_allowed: create_field_from_pff_player_facet_seasonlogs({
    facet: 'offense/pass_blocking',
    column_name: 'sacks_allowed'
  }),
  player_pff_pass_blocking_efficiency:
    create_field_from_pff_player_facet_seasonlogs({
      facet: 'offense/pass_blocking',
      column_name: 'pass_blocking_efficiency'
    }),
  player_pff_pass_block_percent: create_field_from_pff_player_facet_seasonlogs({
    facet: 'offense/pass_blocking',
    column_name: 'pass_block_percent'
  }),
  player_pff_true_pass_set_snaps: create_field_from_pff_player_facet_seasonlogs(
    {
      facet: 'offense/pass_blocking',
      column_name: 'true_pass_set_snaps'
    }
  ),
  player_pff_true_pass_set_grade: create_field_from_pff_player_facet_seasonlogs(
    {
      facet: 'offense/pass_blocking',
      column_name: 'true_pass_set_grade'
    }
  ),
  player_pff_true_pass_set_pressures_allowed:
    create_field_from_pff_player_facet_seasonlogs({
      facet: 'offense/pass_blocking',
      column_name: 'true_pass_set_pressures_allowed'
    }),

  // QB pressure rate (facet passing/pressure).
  player_pff_pressure_percentage: create_field_from_pff_player_facet_seasonlogs(
    {
      facet: 'passing/pressure',
      column_name: 'pressure_percentage'
    }
  ),

  // Pocket time (facet signature/passing/time_in_pocket).
  player_pff_time_in_pocket: create_field_from_pff_player_facet_seasonlogs({
    facet: 'signature/passing/time_in_pocket',
    column_name: 'time_in_pocket'
  }),

  // Slot-coverage receiving detail (facet signature/defense/slot_coverage) --
  // targets/receptions/yards/touchdowns ALLOWED in slot coverage, a different
  // measurement from the receiving/summary totals in pff_player_seasonlogs.
  player_pff_slot_coverage_targets:
    create_field_from_pff_player_facet_seasonlogs({
      facet: 'signature/defense/slot_coverage',
      column_name: 'targets'
    }),
  player_pff_slot_coverage_receptions:
    create_field_from_pff_player_facet_seasonlogs({
      facet: 'signature/defense/slot_coverage',
      column_name: 'receptions'
    }),
  player_pff_slot_coverage_yards: create_field_from_pff_player_facet_seasonlogs(
    {
      facet: 'signature/defense/slot_coverage',
      column_name: 'facet_yards'
    }
  ),
  player_pff_slot_coverage_touchdowns:
    create_field_from_pff_player_facet_seasonlogs({
      facet: 'signature/defense/slot_coverage',
      column_name: 'facet_touchdowns'
    })
}
