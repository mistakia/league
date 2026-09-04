import { market_type_mappings } from '#libs-server/prop-market-settlement/market-type-mappings.mjs'
import {
  calculate_metric_value,
  determine_selection_result
} from '#libs-server/prop-market-settlement/prop-market-utils.mjs'

// One grading derivation, and it is the one settlement uses.
//
// The hit rates used to have their own: libs-server/selection-result.mjs, a
// second partial copy of settlement's two halves fused into a switch. It had no
// case for 10 of the 33 market types settlement grades from a player gamelog, so
// those fell to `default`, returned null, and `is_hit` collapsed null to false --
// scoring every game a loss rather than refusing. 31,242 stored rows read
// exactly 0.0000 as a result, on the tab and in the data-view column.
//
// Settlement instead resolves the metric and then compares it to the line, as
// two pure functions over a data item and a mapping with no database handle.
// PlayerGamelogMarketHandler._process_single_market calls exactly the pair
// below on a raw player_gamelogs row, so a hit rate is that same call over a
// chosen set of games. The only thing a hit rate adds is WHICH games.
//
// WHAT THIS MODULE DOES NOT COVER. 12 of selection-result.mjs's 35 cases are
// NFL_PLAYS markets in settlement -- the longest-play, first-quarter and
// first-half types -- and settlement aggregates plays for them inside
// NFLPlaysMarketHandler before calling the pair. selection-result.mjs instead
// grades them off fields that calculate-historical-hit-rates.mjs enriches onto
// the gamelog. Converting those needs the plays aggregation and is a separate
// increment, so selection-result.mjs cannot be deleted yet.
//
//   node -e "Promise.all([import('./libs-server/prop-market-settlement/market-type-mappings.mjs'),
//     import('fs')]).then(([m, fs]) => {
//     const src = fs.readFileSync('libs-server/selection-result.mjs','utf8')
//     const cased = Object.keys(m.market_type_mappings).filter(t => src.includes('.'+t+':'))
//     console.log(cased.reduce((a,t) => (a[m.market_type_mappings[t].handler]=(a[m.market_type_mappings[t].handler]||0)+1, a), {}))
//   })"
//
// Reads { PLAYER_GAMELOG: 23, NFL_PLAYS: 12 }.

const PLAYER_GAMELOG_HANDLER = 'PLAYER_GAMELOG'

// The soft hit rate, expressed as data rather than as 24 copies of an if/else.
//
// A "soft" hit asks whether the player came CLOSE to the line, by subtracting a
// per-market-type cushion from it before comparing. That is the entire
// difference between the `_hard` and `_soft` stored columns, and they differ on
// 747,826 of the 1,513,572 rows carrying both, so it is not a rounding detail.
//
// Settlement has no cushion concept -- it grades a real bet, where close does
// not pay -- which is why this table lives here and not in market-type-mappings.
//
// Two properties carried over verbatim from selection-result.mjs, both
// deliberate rather than transcription accidents:
//
//   1. The cushion is subtracted from the line for EVERY selection type, so it
//      makes an OVER easier and an UNDER harder. Soft is a directional measure,
//      not a symmetric tolerance band.
//   2. GAME_RECEPTIONS and GAME_RECEIVING_TARGETS have a rate and no cap, where
//      every yardage type caps. A 15-reception line yields a cushion of 2.
//
// A market type absent here has no cushion, so its soft rate equals its hard
// rate. That was true before this module and stays true.
const market_type_line_cushions = {
  GAME_PASSING_YARDS: { rate: 0.06, max: 16 },
  GAME_ALT_PASSING_YARDS: { rate: 0.06, max: 16 },
  GAME_RUSHING_YARDS: { rate: 0.12, max: 9 },
  GAME_ALT_RUSHING_YARDS: { rate: 0.12, max: 9 },
  GAME_RECEIVING_YARDS: { rate: 0.12, max: 9 },
  GAME_ALT_RECEIVING_YARDS: { rate: 0.12, max: 9 },
  GAME_RECEPTIONS: { rate: 0.15, max: null },
  GAME_ALT_RECEPTIONS: { rate: 0.15, max: null },
  GAME_RECEIVING_TARGETS: { rate: 0.15, max: null },
  GAME_PASSING_RUSHING_YARDS: { rate: 0.06, max: 20 }
}

/**
 * Whether a hit rate for this market type can be derived from a player gamelog
 * @param {string} market_type - Market type identifier
 * @returns {boolean} True when settlement grades it with the PLAYER_GAMELOG handler
 */
export const is_player_gamelog_market = (market_type) =>
  market_type_mappings[market_type]?.handler === PLAYER_GAMELOG_HANDLER

/**
 * Amount subtracted from the line for a soft comparison
 * @param {object} params - Named parameters
 * @param {string} params.market_type - Market type identifier
 * @param {number} params.selection_metric_line - The posted line
 * @returns {number} Cushion, 0 when the market type declares none
 */
export const calculate_line_cushion = ({
  market_type,
  selection_metric_line
}) => {
  const cushion = market_type_line_cushions[market_type]
  if (!cushion) return 0

  const scaled = Math.round(selection_metric_line * cushion.rate)
  return cushion.max === null ? scaled : Math.min(scaled, cushion.max)
}

/**
 * Grade one selection against one game, through settlement's own derivation
 *
 * Throws rather than returning null when the market type is not a player gamelog
 * market. That refusal is the whole point of the module: the defect it replaces
 * was a null return that a truthiness test downstream read as a loss, which is
 * indistinguishable from a real loss at every later point in the pipeline. A
 * caller that does not know whether a type is gradable should ask
 * `is_player_gamelog_market` first.
 *
 * @param {object} params - Named parameters
 * @param {object} params.player_gamelog - One player_gamelogs row
 * @param {string} params.market_type - Market type identifier
 * @param {number} params.selection_metric_line - The posted line
 * @param {string} params.selection_type - OVER/UNDER/YES/NO
 * @param {boolean} [params.strict] - False applies the soft cushion to the line
 * @returns {string} 'WON', 'LOST' or 'PUSH'
 * @throws {Error} If the market type is not graded from a player gamelog
 */
export const grade_player_gamelog_selection = ({
  player_gamelog,
  market_type,
  selection_metric_line,
  selection_type,
  strict = true
}) => {
  const mapping = market_type_mappings[market_type]
  if (mapping?.handler !== PLAYER_GAMELOG_HANDLER) {
    throw new Error(
      `Market type ${market_type} is not graded from a player gamelog (handler ${mapping?.handler ?? 'none'}), so it has no hit rate on this path`
    )
  }

  const metric_value = calculate_metric_value(player_gamelog, mapping)

  // The cushion moves the LINE, never the metric, so that a market whose grading
  // ignores the line entirely -- anytime_touchdown and two_plus_touchdowns both
  // do -- is unaffected by it, exactly as before.
  const line = strict
    ? selection_metric_line
    : selection_metric_line -
      calculate_line_cushion({ market_type, selection_metric_line })

  return determine_selection_result({
    metric_value,
    selection_type,
    selection_metric_line: line,
    mapping
  })
}

/**
 * Hit rate for one selection over a chosen set of games
 *
 * The denominator is every game handed in. A PUSH and a game the player was
 * inactive for both count against it, matching the stored columns, which divide
 * hits by the full gamelog count. Changing either is a change to the precompute
 * and to this function together, never to one of them.
 *
 * A sample with NO games has no rate. Zero games is not zero hits, and returning
 * 0 here is the same never-graded-versus-never-hit conflation the precompute
 * fixed: it tells a caller the prop went 0-for-its-history when its history is
 * empty. calculate_hit_rate in scripts/calculate-historical-hit-rates.mjs makes
 * the same call, and the two must agree or the custom path and the stored
 * defaults disagree on exactly the samples nobody can check.
 *
 * @param {object} params - Named parameters
 * @param {object[]} params.player_gamelogs - The sample, already filtered by the caller
 * @param {string} params.market_type - Market type identifier
 * @param {number} params.selection_metric_line - The posted line
 * @param {string} params.selection_type - OVER/UNDER/YES/NO
 * @param {boolean} [params.strict] - False applies the soft cushion to the line
 * @returns {object} { hits, total, rate, results } with one result per game
 * @throws {Error} If the market type is not graded from a player gamelog
 */
export const calculate_player_gamelog_hit_rate = ({
  player_gamelogs,
  market_type,
  selection_metric_line,
  selection_type,
  strict = true
}) => {
  const results = player_gamelogs.map((player_gamelog) => ({
    esbid: player_gamelog.esbid,
    pid: player_gamelog.pid,
    selection_result: grade_player_gamelog_selection({
      player_gamelog,
      market_type,
      selection_metric_line,
      selection_type,
      strict
    })
  }))

  const hits = results.filter(
    (result) => result.selection_result === 'WON'
  ).length
  const total = results.length

  return { hits, total, rate: total > 0 ? hits / total : null, results }
}
