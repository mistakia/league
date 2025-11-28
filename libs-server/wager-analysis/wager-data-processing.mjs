import dayjs from 'dayjs'

import db from '#db'
import { current_season } from '#constants'

/**
 * Build a selections index from a filtered list of wagers.
 * Adds exposure and payout aggregations and computes week from selection time.
 *
 * @param {object} params
 * @param {Array} params.wagers
 * @returns {{ selections_index: Object }}
 */
export const build_selection_index = ({ wagers }) => {
  const selections_index = {}

  for (const wager of wagers) {
    for (const selection of wager.selections) {
      const key = `${selection.event_id}/${selection.selection_id}/${selection.market_type || 'unknown'}`

      if (!selections_index[key]) {
        selections_index[key] = {
          ...selection,
          exposure_count: 0,
          open_wagers: 0,
          open_potential_payout: 0,
          max_potential_payout: 0,
          week: dayjs(selection.start_time)
            .subtract(2, 'day')
            .diff(current_season.regular_season_start, 'weeks')
        }
      }

      selections_index[key].exposure_count += 1
      selections_index[key].max_potential_payout += wager.potential_win

      if (!wager.is_settled) {
        selections_index[key].open_wagers += 1
        selections_index[key].open_potential_payout += wager.potential_win
      }
    }
  }

  return { selections_index }
}

/**
 * Enrich selections with DB results keyed by event/selection/market_type.
 * Also enriches wager selections to include the same enriched fields.
 * Returns matching stats and mutated indexes.
 *
 * @param {object} params
 * @param {Object} params.selections_index
 * @param {Array} params.filtered_wagers
 * @returns {Promise<{ matching_stats: Object, selections_index: Object }>}
 */
export const enrich_selections_from_db = async ({
  selections_index,
  filtered_wagers
}) => {
  const selection_keys_by_source = {
    FANDUEL: [],
    DRAFTKINGS: [],
    FANATICS: []
  }

  for (const [key, selection] of Object.entries(selections_index)) {
    const source = selection.source_id
    if (selection_keys_by_source[source]) {
      selection_keys_by_source[source].push({
        key,
        event_id: selection.event_id,
        selection_id: selection.selection_id,
        market_type: selection.market_type
      })
    }
  }

  const results_map = new Map()

  for (const [source, selections] of Object.entries(selection_keys_by_source)) {
    if (selections.length === 0) continue

    const selection_ids = selections.map((s) => s.selection_id)
    const event_ids = [...new Set(selections.map((s) => s.event_id))]

    const db_results = await db('prop_market_selections_index as pms')
      .join('prop_markets_index as pm', function () {
        this.on('pms.source_id', '=', 'pm.source_id')
        this.on('pms.source_market_id', '=', 'pm.source_market_id')
      })
      .where('pms.source_id', source)
      .whereIn('pms.source_selection_id', selection_ids)
      .whereIn('pm.source_event_id', event_ids)
      .select(
        'pms.source_selection_id',
        'pm.source_event_id',
        'pm.metric_result_value',
        'pm.market_type',
        'pms.selection_metric_line',
        'pms.selection_type'
      )

    for (const row of db_results) {
      const key = `${row.source_event_id}/${row.source_selection_id}/${row.market_type || 'unknown'}`
      const fallback_key = `${row.source_event_id}/${row.source_selection_id}/unknown`

      if (!results_map.has(key)) {
        results_map.set(key, {
          metric_result_value: row.metric_result_value,
          selection_metric_line: row.selection_metric_line,
          selection_type: row.selection_type,
          market_type: row.market_type
        })
      }

      if (!results_map.has(fallback_key) && row.market_type !== null) {
        results_map.set(fallback_key, {
          metric_result_value: row.metric_result_value,
          selection_metric_line: row.selection_metric_line,
          selection_type: row.selection_type,
          market_type: row.market_type
        })
      }
    }
  }

  const matching_stats = {
    total_selections: Object.keys(selections_index).length,
    found_in_db: 0,
    with_results: 0,
    pending: 0,
    not_found: 0
  }

  for (const key of Object.keys(selections_index)) {
    const db_result = results_map.get(key)
    if (db_result) {
      matching_stats.found_in_db++
      if (db_result.metric_result_value !== null) {
        matching_stats.with_results++
      } else {
        matching_stats.pending++
      }
    } else {
      matching_stats.not_found++
    }
  }

  for (const [key] of Object.entries(selections_index)) {
    const db_result = results_map.get(key)
    if (db_result) {
      selections_index[key].metric_result_value = db_result.metric_result_value
      selections_index[key].selection_metric_line =
        db_result.selection_metric_line
      selections_index[key].selection_type = db_result.selection_type
      selections_index[key].market_type = db_result.market_type

      if (
        db_result.metric_result_value !== null &&
        db_result.selection_metric_line !== null
      ) {
        selections_index[key].distance_from_threshold =
          Number(db_result.metric_result_value) -
          Number(db_result.selection_metric_line)
      }
    }
  }

  for (const wager of filtered_wagers) {
    for (const selection of wager.selections) {
      const key = `${selection.event_id}/${selection.selection_id}/${selection.market_type || 'unknown'}`
      const enriched = selections_index[key]
      if (enriched) {
        selection.metric_result_value = enriched.metric_result_value
        selection.selection_metric_line = enriched.selection_metric_line
        selection.selection_type = enriched.selection_type
        selection.market_type = enriched.market_type
        selection.distance_from_threshold = enriched.distance_from_threshold
      }
    }
  }

  return { matching_stats, selections_index }
}

/**
 * Transform selections index into a sorted list with derived fields.
 *
 * @param {object} params
 * @param {Object} params.selections_index
 * @param {Array} params.filtered_wagers
 * @param {number} params.total_risk
 * @returns {Array}
 */
export const build_unique_selections = ({
  selections_index,
  filtered_wagers,
  total_risk
}) => {
  return Object.values(selections_index)
    .map((selection) => {
      return {
        ...selection,
        name: selection.name,
        exposure_rate: `${((selection.exposure_count / filtered_wagers.length) * 100).toFixed(2)}%`,
        open_potential_roi: `${((selection.open_potential_payout / total_risk) * 100).toFixed(0)}%`,
        max_potential_roi: `${((selection.max_potential_payout / total_risk) * 100).toFixed(0)}%`
      }
    })
    .sort((a, b) => b.exposure_count - a.exposure_count)
}
