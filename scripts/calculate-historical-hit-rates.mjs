import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import oddslib from '#libs-server/odds-conversions.mjs'

import db from '#db'
import {
  is_main,
  report_job,
  selection_result,
  throw_if_shortfall
} from '#libs-server'
import {
  is_player_gamelog_market,
  grade_player_gamelog_selection
} from '#libs-server/prop-hit-rate.mjs'
import { job_types } from '#libs-shared/job-constants.mjs'
import { groupBy } from '#libs-shared'
import { current_season, stat_countable_play_types } from '#constants'
import { chunk_array } from '#libs-shared/chunk.mjs'
import { player_game_prop_types } from '#libs-shared/bookmaker-constants.mjs'
import { enable_debug_namespaces } from '#libs-shared/enable-debug-namespaces.mjs'

const initialize_cli = () => {
  return yargs(hideBin(process.argv))
    .usage(
      '$0 [options]',
      'Calculate historical hit rates for prop market selections'
    )
    .option('year', {
      type: 'number',
      describe: 'Season year to process',
      default: current_season.year
    })
    .option('missing_only', {
      type: 'boolean',
      default: false,
      describe: 'Only process selections missing hit rate data'
    })
    .option('current_week_only', {
      type: 'boolean',
      default: false,
      describe: 'Only process current NFL week'
    })
    .option('market_types', {
      type: 'array',
      describe: 'Specific market types to process (optional)'
    })
    .option('batch_size', {
      type: 'number',
      default: 1000,
      describe: 'Number of selections to process per batch'
    })
    .option('dry_run', {
      type: 'boolean',
      default: false,
      describe:
        'Compute and report what would change without writing anything. Reports the stored-versus-computed transition matrix for overall_hit_rate_hard per market type, and the empty-sample count per window.'
    })
    .example('$0 --missing_only', 'Process only missing hit rates')
    .example('$0 --year 2024 --dry_run', 'Size a recompute before running it')
    .example(
      '$0 --market_types GAME_PASSING_YARDS',
      'Process specific market type'
    )
    .help()
    .parse()
}

const log = debug('calculate-historical-hit-rates')
enable_debug_namespaces('calculate-historical-hit-rates')

// A sample in which NOTHING could be graded has no hit rate. It is unknown, not
// zero, and writing zero is the original defect in a new place: the stored rate
// then reads "this prop has never once hit" on a market nobody ever graded.
//
// The six GAME_ALT_* types are what surfaced this. Their selections carry no
// selection_metric_line at all, so determine_selection_result refuses on every
// game in every sample, and a recompute that scored those refusals as misses
// wrote 22,444 rows of exactly 0.0000 where the column had previously been NULL.
//
// A PARTIAL refusal still scores as a miss, per the ruling that a PUSH and an
// ungradable game both count against the denominator. That ruling is about
// individual GAMES inside a gradable sample; this is the different case of a
// SELECTION that cannot be graded at all.
//
// An EMPTY sample is the third case and the largest of the three. Zero games is
// not zero hits: a rookie has no last_season games and a week-1 selection has no
// current_season games, and storing 0.0000 tells the tab the prop went 0-for-its
// history when its history is empty. Measured 2026-09-04 by dry run, per season:
// last_season is empty for 109,936 of 961,142 selections in 2024 and 147,190 of
// 1,077,380 in 2025, current_season for 53,996 and 42,782, and the overall
// window for 5,011 and 3,599. This branch is shared by every market type rather
// than confined to the ungraded ones, which is why it outweighs both cases above.
export const calculate_hit_rate = ({ hits, total, ungradable }) => {
  if (total === 0) return null
  if (ungradable === total) return null
  return hits / total
}

// Grading routes through settlement's own derivation for every market type
// settlement grades from a player gamelog -- 33 of them, where
// selection-result.mjs had a rule for 23. The other 10 fell to its `default`,
// returned null, and `is_hit` read null as false, so a market that had never
// been graded reported that it had never hit: 31,242 stored rows at exactly
// 0.0000, four market types with a maximum rate of 0.0000 across every row.
//
// The 12 NFL_PLAYS types -- longest reception, longest rush, longest completion,
// and the first-quarter and first-half yardage types -- still go through
// selection-result.mjs. Settlement grades those by aggregating plays inside
// NFLPlaysMarketHandler before calling the same pair, while this script instead
// enriches the gamelog with two nfl_plays queries below and grades off that.
// Converting them needs the plays aggregation and is its own increment, which is
// why selection-result.mjs is still here.
// Ungradable rows, by the reason the grader refused. Settlement's
// determine_selection_result THROWS where selection-result.mjs quietly took a
// branch -- most importantly on a null selection_type, which the old `compare`
// treated as OVER and which 3,072 stored selections carry. Those rows score as
// misses, matching the ruling that a PUSH and an ungradable game both count
// against the denominator, but the count is reported at the end of the run
// rather than absorbed. A refusal nobody can see is the defect this whole change
// is about.
const ungradable_reasons = new Map()

const record_ungradable = (market_type, error) => {
  const key = `${market_type}: ${error.message}`
  ungradable_reasons.set(key, (ungradable_reasons.get(key) || 0) + 1)
}

export const get_hits = ({
  line,
  market_type,
  player_gamelogs,
  strict,
  selection_type
}) => {
  if (is_player_gamelog_market(market_type)) {
    let ungradable = 0
    const hits = player_gamelogs.filter((player_gamelog) => {
      try {
        return (
          grade_player_gamelog_selection({
            player_gamelog,
            market_type,
            selection_metric_line: line,
            selection_type,
            strict
          }) === 'WON'
        )
      } catch (error) {
        record_ungradable(market_type, error)
        ungradable += 1
        return false
      }
    })

    return { hits, ungradable }
  }

  // The same never-graded-versus-never-hit conflation, on the other branch, and
  // it is the LARGER half. A market type with no case in selection-result.mjs
  // reaches its `default`, which returns null, and `is_hit` collapses null to
  // false -- so every game in the sample scores a loss and the selection stores
  // a rate of exactly 0.0000 on a market nothing ever graded. Measured
  // 2026-09-04: 47 market types and 84,843 stored rows, led by
  // GAME_FIRST_TEAM_TOUCHDOWN_SCORER (20,947), GAME_TACKLES_ASSISTS (10,558)
  // and GAME_PPR_FANTASY_POINTS (6,278).
  //
  // Whether the type is absent from market_type_mappings or mapped to NFL_PLAYS
  // makes no difference here: neither reaches a case, so mapping status is not
  // the mechanism and cannot be used to scope the repair.
  //
  // Counting a null as ungradable rather than as a miss is all-or-nothing per
  // selection, because the market type is constant across a sample -- a type
  // with no case makes every game ungradable and calculate_hit_rate returns no
  // rate, and a type with a case never returns null here at all.
  const unsupported_market_types = new Set()
  let ungradable = 0
  const hits = player_gamelogs.filter((player_gamelog) => {
    const result = selection_result.get_selection_result({
      line,
      market_type,
      player_gamelog,
      strict,
      selection_type,
      unsupported_market_types
    })

    if (result === null) {
      record_ungradable(
        market_type,
        new Error('no case in selection-result.mjs')
      )
      ungradable += 1
      return false
    }

    return result === 'WON'
  })

  return { hits, ungradable }
}

// The row this update must land on is identified by time_type as well. Both
// prop-market index tables are unique on their key INCLUDING time_type, so a
// predicate without it matches BOTH the OPEN and the CLOSE row: the two carry
// the same hit rate (the rate is a function of the line, not the price) but
// different odds, so the later write silently overwrites the earlier row's
// edge with an edge computed against the other row's odds. Measured 2026-09-04:
// 26,710 of 27,421 sampled CLOSE rows carried their sibling's edge while only
// 8,434 shared its odds.
export const build_hit_rate_update_where_clause = (selection) => ({
  source_id: selection.source_id,
  source_market_id: selection.source_market_id,
  source_selection_id: selection.source_selection_id,
  time_type: selection.time_type,
  selection_type: selection.selection_type,
  selection_metric_line: selection.selection_metric_line,
  selection_pid: selection.selection_pid
})

// Postgres binds one parameter per esbid and cannot accept more than 65,535 in
// a statement. It does not report the overflow as a limit: the 16-bit count
// wraps, and a 74,368-esbid list failed with "bind message has 8832 parameter
// formats but 0 parameters" (74368 - 65536 = 8832) and killed the whole run
// before a single update. The gamelog list carries one row per player per game,
// so it repeats each esbid once per player -- a season is about 285 distinct
// games behind about 36,000 gamelog rows, and a run loads every season those
// players ever played. Deduplicating is what makes the list small; chunking is
// what keeps it bounded however many seasons a run spans. The cron survived only
// because --current_week_only keeps the list to one week.
export const NFL_PLAYS_ESBID_CHUNK_SIZE = 1000

export const build_esbid_chunks = (esbids) =>
  chunk_array({
    items: [...new Set(esbids)],
    chunk_size: NFL_PLAYS_ESBID_CHUNK_SIZE
  })

const fetch_plays_by_esbid = async ({ esbids, apply_filters }) => {
  const chunks = build_esbid_chunks(esbids)

  const results = await Promise.all(
    chunks.map((chunk) =>
      apply_filters(
        db('nfl_plays')
          .select(
            'esbid',
            'pass_yards',
            'receiving_yards',
            'rush_yards',
            'passer_pid',
            'target_pid',
            'ball_carrier_pid'
          )
          .whereIn('esbid', chunk)
      )
    )
  )

  return results.flat()
}

// What a dry run measures. A recompute rewrites five hit-rate columns across
// every selection in a season, so "run it and look at what moved" is only a
// measurement AFTER the write has already happened. These two counters answer
// the sizing question first, with nothing written.
//
// overall_transitions is the stored-versus-computed matrix for
// overall_hit_rate_hard, keyed by market type, which is what says whether a
// change reaches only the types it meant to reach.
//
// empty_samples counts, per window, the selections whose sample has no games at
// all. That is the direct size of the calculate_hit_rate `total === 0` branch,
// which returns 0 -- the same never-graded-versus-never-hit conflation, on a
// branch every market type shares. The narrow windows are where it lives: a
// rookie has no last_season games and a week-1 selection has no current_season
// games, and both currently store 0.0000 rather than no rate.
const overall_transitions = new Map()
const empty_samples = new Map()

const classify_rate = (rate) => {
  if (rate === null || rate === undefined) return 'null'
  return Number(rate) === 0 ? 'zero' : 'nonzero'
}

const record_transition = (market_type, stored, computed) => {
  const key = `${market_type}\t${classify_rate(stored)} -> ${classify_rate(computed)}`
  overall_transitions.set(key, (overall_transitions.get(key) || 0) + 1)
}

const record_empty_sample = (window_name) => {
  empty_samples.set(window_name, (empty_samples.get(window_name) || 0) + 1)
}

const calculate_historical_hit_rates = async ({
  season_year = current_season.year,
  missing_only = false,
  current_week_only = false,
  market_types = null,
  batch_size = 1000,
  dry_run = false
} = {}) => {
  log(
    `Starting historical hit rate calculation${dry_run ? ' (DRY RUN -- nothing will be written)' : ''}`
  )

  // Build base query for prop selections
  const prop_selections_query = db('prop_market_selections_index')
    .select(
      'prop_markets_index.esbid',
      'prop_markets_index.market_type',
      'prop_market_selections_index.selection_pid',
      'prop_market_selections_index.selection_metric_line',
      'prop_market_selections_index.selection_type',
      'prop_market_selections_index.source_id',
      'prop_market_selections_index.source_market_id',
      'prop_market_selections_index.source_selection_id',
      'prop_market_selections_index.time_type',
      'prop_market_selections_index.odds_american',
      // Carried so a dry run can compare what is stored against what would be
      // written. Unused by an ordinary run, and grouped alongside every other
      // selection-grain column so it does not change the query's grain.
      'prop_market_selections_index.overall_hit_rate_hard',
      'nfl_games.season_type',
      'nfl_games.week',
      'nfl_games.season_year'
    )
    .whereNotNull('prop_market_selections_index.selection_pid')
    .whereNotNull('prop_markets_index.esbid')
    .where('prop_markets_index.season_year', season_year)
    // time_type belongs in the join: both index tables are unique on the key
    // INCLUDING time_type, so joining without it pairs every selection row with
    // both the OPEN and the CLOSE market row and fans the result out 2x.
    .join('prop_markets_index', function () {
      this.on(
        'prop_markets_index.source_id',
        '=',
        'prop_market_selections_index.source_id'
      )
        .andOn(
          'prop_markets_index.source_market_id',
          '=',
          'prop_market_selections_index.source_market_id'
        )
        .andOn(
          'prop_markets_index.time_type',
          '=',
          'prop_market_selections_index.time_type'
        )
    })
    .join('nfl_games', 'nfl_games.esbid', 'prop_markets_index.esbid')
    .groupBy(
      'prop_markets_index.esbid',
      'prop_markets_index.market_type',
      'prop_market_selections_index.selection_pid',
      'prop_market_selections_index.selection_metric_line',
      'prop_market_selections_index.selection_type',
      'prop_market_selections_index.source_id',
      'prop_market_selections_index.source_market_id',
      'prop_market_selections_index.source_selection_id',
      'prop_market_selections_index.time_type',
      'prop_market_selections_index.odds_american',
      'prop_market_selections_index.overall_hit_rate_hard',
      'nfl_games.season_type',
      'nfl_games.week',
      'nfl_games.season_year'
    )

  // Apply filters
  if (missing_only) {
    prop_selections_query.where(function () {
      this.whereNull(
        'prop_market_selections_index.overall_hit_rate_hard'
      ).orWhereNull('prop_market_selections_index.current_season_hit_rate_soft')
    })
  }

  if (current_week_only) {
    prop_selections_query
      .where('nfl_games.week', current_season.nfl_seas_week)
      .where('nfl_games.season_type', current_season.nfl_seas_type)
  }

  if (market_types && market_types.length > 0) {
    prop_selections_query.whereIn(
      'prop_markets_index.market_type',
      market_types
    )
  } else {
    // Default to player game prop types if no specific types provided
    prop_selections_query.whereIn(
      'prop_markets_index.market_type',
      Object.values(player_game_prop_types)
    )
  }

  const prop_selections = await prop_selections_query
  log(`Processing ${prop_selections.length} prop selections`)

  if (prop_selections.length === 0) {
    log('No selections found to process')
    return { shortfall: null }
  }

  // Get unique player IDs for gamelog fetching
  const unique_pids = [...new Set(prop_selections.map((s) => s.selection_pid))]
  log(`Loading gamelogs for ${unique_pids.length} unique players`)

  // Fetch all relevant player gamelogs
  const player_gamelogs = await db('player_gamelogs')
    .select(
      'player_gamelogs.*',
      'nfl_games.week',
      'nfl_games.season_year',
      'nfl_games.season_type',
      'nfl_games.esbid'
    )
    .join('nfl_games', 'nfl_games.esbid', 'player_gamelogs.esbid')
    .whereIn('nfl_games.season_type', ['REG', 'POST'])
    .whereIn('player_gamelogs.pid', unique_pids).orderByRaw(`
      nfl_games.season_year,
      CASE WHEN nfl_games.season_type = 'REG' THEN 0 ELSE 1 END,
      nfl_games.week
    `)

  log(`Loaded ${player_gamelogs.length} player gamelogs`)

  const gamelog_esbids = player_gamelogs.map((g) => g.esbid)

  // Fetch first quarter stats if needed
  const first_quarter_stats = await fetch_plays_by_esbid({
    esbids: gamelog_esbids,
    apply_filters: (query) =>
      query.where('quarter', 1).whereIn('play_type', stat_countable_play_types)
  })

  // Process first quarter stats into lookup
  const first_quarter_stats_by_game = first_quarter_stats.reduce(
    (acc, play) => {
      if (!acc[play.esbid]) {
        acc[play.esbid] = {}
      }

      ;[play.passer_pid, play.ball_carrier_pid, play.target_pid].forEach(
        (pid) => {
          if (!pid) return
          if (!acc[play.esbid][pid]) {
            acc[play.esbid][pid] = {
              passing_yards: 0,
              rushing_yards: 0,
              receiving_yards: 0
            }
          }
        }
      )

      if (play.passer_pid) {
        acc[play.esbid][play.passer_pid].passing_yards += play.pass_yards || 0
      }
      if (play.ball_carrier_pid) {
        acc[play.esbid][play.ball_carrier_pid].rushing_yards +=
          play.rush_yards || 0
      }
      if (play.target_pid) {
        acc[play.esbid][play.target_pid].receiving_yards +=
          play.receiving_yards || 0
      }

      return acc
    },
    {}
  )

  // Fetch first half stats if needed (quarters 1 and 2)
  const first_half_stats = await fetch_plays_by_esbid({
    esbids: gamelog_esbids,
    apply_filters: (query) =>
      query
        .whereIn('quarter', [1, 2])
        .whereIn('play_type', stat_countable_play_types)
  })

  // Process first half stats into lookup
  const first_half_stats_by_game = first_half_stats.reduce((acc, play) => {
    if (!acc[play.esbid]) {
      acc[play.esbid] = {}
    }

    ;[play.passer_pid, play.ball_carrier_pid, play.target_pid].forEach(
      (pid) => {
        if (!pid) return
        if (!acc[play.esbid][pid]) {
          acc[play.esbid][pid] = {
            passing_yards: 0,
            rushing_yards: 0,
            receiving_yards: 0
          }
        }
      }
    )

    if (play.passer_pid) {
      acc[play.esbid][play.passer_pid].passing_yards += play.pass_yards || 0
    }
    if (play.ball_carrier_pid) {
      acc[play.esbid][play.ball_carrier_pid].rushing_yards +=
        play.rush_yards || 0
    }
    if (play.target_pid) {
      acc[play.esbid][play.target_pid].receiving_yards +=
        play.receiving_yards || 0
    }

    return acc
  }, {})

  // Enhance player gamelogs with first quarter and first half stats
  const enhanced_player_gamelogs = player_gamelogs.map((gamelog) => ({
    ...gamelog,
    first_quarter_stats: first_quarter_stats_by_game[`${gamelog.esbid}`]?.[
      gamelog.pid
    ] || {
      passing_yards: 0,
      rushing_yards: 0,
      receiving_yards: 0
    },
    first_half_stats: first_half_stats_by_game[`${gamelog.esbid}`]?.[
      gamelog.pid
    ] || {
      passing_yards: 0,
      rushing_yards: 0,
      receiving_yards: 0
    }
  }))

  const player_gamelogs_by_pid = groupBy(enhanced_player_gamelogs, 'pid')

  // Process selections in batches
  const batches = chunk_array({
    items: prop_selections,
    chunk_size: batch_size
  })

  log(
    `Processing ${batches.length} batches of up to ${batch_size} selections each`
  )

  let processed_count = 0
  let missing_gamelogs_count = 0
  const missing_gamelogs_pids = new Set()

  for (const [batch_index, batch] of batches.entries()) {
    log(`Processing batch ${batch_index + 1}/${batches.length}`)

    const batch_updates = []

    for (const selection of batch) {
      const player_gamelogs = player_gamelogs_by_pid[selection.selection_pid]

      if (!player_gamelogs) {
        missing_gamelogs_pids.add(selection.selection_pid)
        missing_gamelogs_count++
        continue
      }

      // Filter gamelogs by time periods
      const current_season_gamelogs = player_gamelogs.filter(
        (g) =>
          g.season_year === selection.season_year &&
          ((selection.season_type === 'POST' && g.season_type === 'REG') ||
            (g.season_type === selection.season_type &&
              g.week < selection.week))
      )

      const all_gamelogs = player_gamelogs.filter(
        (g) =>
          g.season_year < selection.season_year ||
          (g.season_year === selection.season_year &&
            ((selection.season_type === 'POST' && g.season_type === 'REG') ||
              (g.season_type === selection.season_type &&
                g.week < selection.week)))
      )

      const last_five = all_gamelogs.slice(-5)
      const last_ten = all_gamelogs.slice(-10)
      const last_season = all_gamelogs.filter(
        (g) => g.season_year === selection.season_year - 1
      )

      // Calculate implied probability from odds
      let implied_probability = null
      if (selection.odds_american) {
        try {
          implied_probability = oddslib
            .from('moneyline', selection.odds_american)
            .to('impliedProbability')
        } catch (err) {
          log(
            `Error calculating implied probability for odds ${selection.odds_american}`
          )
        }
      }

      // Calculate rates for different time periods
      const calculate_rates = (gamelogs, window_name) => {
        if (dry_run && gamelogs.length === 0) record_empty_sample(window_name)

        const hits_soft = get_hits({
          line: selection.selection_metric_line,
          market_type: selection.market_type,
          player_gamelogs: gamelogs,
          strict: false,
          selection_type: selection.selection_type
        })

        const hits_hard = get_hits({
          line: selection.selection_metric_line,
          market_type: selection.market_type,
          player_gamelogs: gamelogs,
          strict: true,
          selection_type: selection.selection_type
        })

        const hit_rate_soft = calculate_hit_rate({
          hits: hits_soft.hits.length,
          total: gamelogs.length,
          ungradable: hits_soft.ungradable
        })
        const hit_rate_hard = calculate_hit_rate({
          hits: hits_hard.hits.length,
          total: gamelogs.length,
          ungradable: hits_hard.ungradable
        })

        // An edge is a rate minus a price. With no rate there is no edge, and
        // subtracting from null yields a confident negative number instead.
        return {
          hit_rate_soft,
          hit_rate_hard,
          edge_soft:
            implied_probability && hit_rate_soft !== null
              ? hit_rate_soft - implied_probability
              : null,
          edge_hard:
            implied_probability && hit_rate_hard !== null
              ? hit_rate_hard - implied_probability
              : null
        }
      }

      const current_season_rates = calculate_rates(
        current_season_gamelogs,
        'current_season'
      )
      const last_five_rates = calculate_rates(last_five, 'last_five')
      const last_ten_rates = calculate_rates(last_ten, 'last_ten')
      const last_season_rates = calculate_rates(last_season, 'last_season')
      const overall_rates = calculate_rates(all_gamelogs, 'overall')

      if (dry_run) {
        record_transition(
          selection.market_type,
          selection.overall_hit_rate_hard,
          overall_rates.hit_rate_hard
        )
        processed_count++
        continue
      }

      // Prepare update data
      const update_data = {
        current_season_hit_rate_soft: current_season_rates.hit_rate_soft,
        current_season_hit_rate_hard: current_season_rates.hit_rate_hard,
        current_season_edge_soft: current_season_rates.edge_soft,
        current_season_edge_hard: current_season_rates.edge_hard,

        last_five_hit_rate_soft: last_five_rates.hit_rate_soft,
        last_five_hit_rate_hard: last_five_rates.hit_rate_hard,
        last_five_edge_soft: last_five_rates.edge_soft,
        last_five_edge_hard: last_five_rates.edge_hard,

        last_ten_hit_rate_soft: last_ten_rates.hit_rate_soft,
        last_ten_hit_rate_hard: last_ten_rates.hit_rate_hard,
        last_ten_edge_soft: last_ten_rates.edge_soft,
        last_ten_edge_hard: last_ten_rates.edge_hard,

        last_season_hit_rate_soft: last_season_rates.hit_rate_soft,
        last_season_hit_rate_hard: last_season_rates.hit_rate_hard,
        last_season_edge_soft: last_season_rates.edge_soft,
        last_season_edge_hard: last_season_rates.edge_hard,

        overall_hit_rate_soft: overall_rates.hit_rate_soft,
        overall_hit_rate_hard: overall_rates.hit_rate_hard,
        overall_edge_soft: overall_rates.edge_soft,
        overall_edge_hard: overall_rates.edge_hard
      }

      batch_updates.push({
        where_clause: build_hit_rate_update_where_clause(selection),
        update_data
      })

      processed_count++
    }

    // Execute batch updates
    log(
      `${dry_run ? 'Would execute' : 'Executing'} ${batch_updates.length} updates for batch ${batch_index + 1}`
    )

    for (const update of dry_run ? [] : batch_updates) {
      await db('prop_market_selections_index')
        .where(update.where_clause)
        .update(update.update_data)
    }

    // Log progress
    if ((batch_index + 1) % 10 === 0) {
      log(`Completed ${batch_index + 1}/${batches.length} batches`)
    }
  }

  log('Historical hit rate calculation completed')
  log(`Total selections processed: ${processed_count}`)
  log(`Selections with missing gamelogs: ${missing_gamelogs_count}`)

  if (missing_gamelogs_pids.size > 0) {
    log(`Unique players with missing gamelogs: ${missing_gamelogs_pids.size}`)
  }

  // Every grading refusal, by reason. These rows scored as misses; this is the
  // only place that says so. Silence here means every selection graded cleanly,
  // which is the claim worth being able to check.
  if (ungradable_reasons.size > 0) {
    const total_ungradable = [...ungradable_reasons.values()].reduce(
      (sum, count) => sum + count,
      0
    )
    log(
      `Ungradable gamelog comparisons: ${total_ungradable} across ${ungradable_reasons.size} reason(s). A refusal counts against the denominator inside an otherwise gradable sample; a sample refused in FULL gets no rate at all.`
    )
    for (const [reason, count] of [...ungradable_reasons.entries()].sort(
      (a, b) => b[1] - a[1]
    )) {
      log(`  ${count} x ${reason}`)
    }
  }

  if (dry_run) {
    log('')
    log('DRY RUN -- nothing was written.')
    // Only class-CHANGING transitions are listed. A nonzero rate shifting to
    // another nonzero rate is an ordinary recompute and would bury the signal;
    // null/zero/nonzero crossings are what a blast-radius question is asking
    // about, and a type appearing here that the change did not target is the
    // regression the listing exists to surface.
    log('overall_hit_rate_hard class changes, per market type:')
    let class_changes = 0
    for (const [key, count] of [...overall_transitions.entries()].sort(
      (a, b) => b[1] - a[1]
    )) {
      const [market_type, transition] = key.split('\t')
      const [stored, computed] = transition.split(' -> ')
      if (stored === computed) continue
      class_changes += count
      log(`  ${count} x ${market_type}: ${transition}`)
    }
    log(
      `  ${class_changes} of ${processed_count} selections change class${class_changes === 0 ? ' -- no rate crosses between null, zero and nonzero' : ''}`
    )

    log('')
    log(
      'Empty samples per window -- the size of the calculate_hit_rate `total === 0` branch, which stores 0 today:'
    )
    for (const window_name of [
      'current_season',
      'last_five',
      'last_ten',
      'last_season',
      'overall'
    ]) {
      log(
        `  ${window_name}: ${empty_samples.get(window_name) || 0} of ${processed_count} selections`
      )
    }
  }

  // Post-run oracle: if selections existed but none were processed, the run was a
  // silent no-op (e.g. all gamelogs missing). Distinguish from legitimate empty
  // year (prop_selections.length === 0 returned early above).
  if (processed_count === 0) {
    return {
      shortfall: `processed 0 of ${prop_selections.length} selections for year=${season_year} (missing_gamelogs=${missing_gamelogs_count})`
    }
  }

  return { shortfall: null }
}

const main = async () => {
  let error
  let dry_run = false
  try {
    const argv = initialize_cli()
    dry_run = argv.dry_run
    const result = await calculate_historical_hit_rates({
      season_year: argv.year,
      missing_only: argv.missing_only,
      current_week_only: argv.current_week_only,
      market_types: argv.market_types,
      batch_size: argv.batch_size,
      dry_run: argv.dry_run
    })
    throw_if_shortfall(result?.shortfall)
  } catch (err) {
    error = err
    log(`Error in hit rate calculation: ${error.message}`)
    console.error(error)
  }

  // A dry run wrote nothing, so recording it as a completed job would tell the
  // monitoring surface the hit rates are fresh when nothing was refreshed.
  if (!dry_run) {
    await report_job({
      job_type: job_types.PROCESS_MARKET_HIT_RATES,
      error
    })
  }

  process.exit(error ? 1 : 0)
}

if (is_main(import.meta.url)) {
  main()
}

export default calculate_historical_hit_rates
