import debug from 'debug'
import dayjs from 'dayjs'
import fs from 'fs-extra'
import * as oddslib from 'oddslib'
import path, { dirname } from 'path'
import { fileURLToPath } from 'url'
import { Table } from 'console-table-printer'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { constants, format_player_name } from '#libs-shared'
import { is_main } from '#libs-server'

const argv = yargs(hideBin(process.argv)).argv
const log = debug('analyze-wagers')
debug.enable('analyze-wagers')

const __dirname = dirname(fileURLToPath(import.meta.url))
const data_path = path.join(__dirname, '../tmp')

const is_prop_equal = (prop_a, prop_b) =>
  prop_a.event_id === prop_b.event_id &&
  prop_a.market_id === prop_b.market_id &&
  prop_a.selection_id === prop_b.selection_id

const get_props_summary = (props) =>
  props.reduce(
    (accumulator, prop) => {
      const odds = prop.parsed_odds
        ? oddslib.from('moneyline', prop.parsed_odds).to('impliedProbability')
        : 0
      const is_win = prop.is_won
      return {
        total_props: accumulator.total_props + 1,
        expected_hits: accumulator.expected_hits + odds,
        actual_hits: is_win
          ? accumulator.actual_hits + 1
          : accumulator.actual_hits
      }
    },
    {
      expected_hits: 0,
      actual_hits: 0,
      total_props: 0
    }
  )

const get_wagers_summary = ({ wagers, props = [] }) =>
  wagers.reduce(
    (accumulator, wager) => {
      const lost_legs = wager.selections.filter((selection) => {
        for (const prop of props) {
          if (is_prop_equal(selection, prop)) {
            return false
          }
        }
        return selection.is_lost
      }).length

      const is_settled = wager.is_settled

      const is_won = is_settled && lost_legs === 0
      const is_lost = is_settled && lost_legs > 0

      return {
        won_wagers: is_won
          ? [...accumulator.won_wagers, wager]
          : accumulator.won_wagers,
        wagers: accumulator.wagers + 1,
        wagers_won: is_won
          ? accumulator.wagers_won + 1
          : accumulator.wagers_won,
        wagers_loss: is_lost
          ? accumulator.wagers_loss + 1
          : accumulator.wagers_loss,
        wagers_open: is_settled
          ? accumulator.wagers_open
          : accumulator.wagers_open + 1,

        total_risk: accumulator.total_risk + wager.stake,
        total_won: is_won
          ? accumulator.total_won + wager.potential_win
          : accumulator.total_won,
        max_potential_win: accumulator.max_potential_win + wager.potential_win,
        open_potential_win: is_settled
          ? accumulator.open_potential_win
          : accumulator.open_potential_win + wager.potential_win,

        lost_by_one_leg:
          lost_legs === 1
            ? accumulator.lost_by_one_leg + 1
            : accumulator.lost_by_one_leg,
        lost_by_two_legs:
          lost_legs === 2
            ? accumulator.lost_by_two_legs + 1
            : accumulator.lost_by_two_legs,
        lost_by_three_legs:
          lost_legs === 3
            ? accumulator.lost_by_three_legs + 1
            : accumulator.lost_by_three_legs,
        lost_by_four_or_more_legs:
          lost_legs >= 4
            ? accumulator.lost_by_four_or_more_legs + 1
            : accumulator.lost_by_four_or_more_legs
      }
    },
    {
      won_wagers: [],
      wagers: 0,
      wagers_won: 0,
      wagers_loss: 0,
      total_risk: 0,
      wagers_open: 0,
      total_won: 0,
      max_potential_win: 0,
      open_potential_win: 0,
      lost_by_one_leg: 0,
      lost_by_two_legs: 0,
      lost_by_three_legs: 0,
      lost_by_four_or_more_legs: 0
    }
  )

const format_fanduel_selection_name = ({ selection, week }) => {
  const player_name = selection.eventMarketDescription.split(' - ')[0]
  const stat_type = (
    selection.eventMarketDescription.includes(' - ')
      ? selection.eventMarketDescription.split(' - ')[1]
      : selection.eventMarketDescription
  )
    .replace('Alt ', '')
    .trim()
    .replace('Receptions', 'Recs')
    .replace('Passing', 'Pass')
    .replace('Rushing', 'Rush')
    .replace('Receiving', 'Recv')
    .replace('Any Time Touchdown Scorer', 'Anytime TD')
    .replace('To Score 2+ Touchdowns', '2+ TDs')
    .replace('1st Team Touchdown Scorer', '1st Team TD')
  const handicap = Math.round(Number(selection.parsedHandicap))

  let name

  if (
    stat_type === 'Moneyline' ||
    stat_type === 'Anytime TD' ||
    stat_type === '2+ TDs' ||
    stat_type === '1st Team TD'
  ) {
    name = `${selection.selectionName} ${stat_type}`
  } else if (stat_type === 'Alternate Spread') {
    name = `${selection.selectionName}`
  } else {
    name = `${player_name} ${handicap}+ ${stat_type}`
  }

  return name
}

const extract_draftkings_player_name = (market_display_name) => {
  // List of stat names to check for
  const stat_names = [
    'Rushing Yards',
    'Receiving Yards',
    'Passing Yards',
    'Receptions',
    'Touchdowns'
  ]

  // Extract player name
  const player_name = stat_names.reduce((name, stat) => {
    if (name) return name
    const index = market_display_name.indexOf(stat)
    return index !== -1 ? market_display_name.slice(0, index).trim() : ''
  }, '')

  return player_name
}

const format_draftkings_selection_name = ({ selection }) => {
  const market_display_name = selection.marketDisplayName || ''
  const selection_display_name = selection.selectionDisplayName || ''

  const player_name = extract_draftkings_player_name(market_display_name)
  if (player_name) {
    // Handle specific stats
    if (market_display_name.includes('Rushing Yards')) {
      return `${player_name} ${selection_display_name} Rush Yds`
    }
    if (market_display_name.includes('Receiving Yards')) {
      return `${player_name} ${selection_display_name} Recv Yds`
    }
    if (market_display_name.includes('Passing Yards')) {
      return `${player_name} ${selection_display_name} Pass Yds`
    }
    if (market_display_name.includes('Receptions')) {
      return `${player_name} ${selection_display_name} Recs`
    }
    if (market_display_name.includes('Touchdowns')) {
      return `${player_name} ${selection_display_name} TDs`
    }
  }

  // Default to original format if no specific case is matched
  return `${market_display_name} (${selection_display_name})`
}

// Helper function to generate combinations
const generate_round_robin_combinations = (arr, r) => {
  const combinations = []
  const combine = (start, combo) => {
    if (combo.length === r) {
      combinations.push(combo)
      return
    }
    for (let i = start; i < arr.length; i++) {
      combine(i + 1, [...combo, arr[i]])
    }
  }
  combine(0, [])
  return combinations
}

const calculate_fanduel_round_robin_wager = ({ wager }) => {
  const num_selections = Number(wager.betType.slice(3))
  const legs = wager.legs

  // Generate all possible combinations
  const all_combinations = generate_round_robin_combinations(
    legs,
    num_selections
  )

  // Filter combinations to include only one selection per market and event
  const valid_combinations = all_combinations.filter((combination) => {
    const markets = new Set()
    const events = new Set()
    for (const leg of combination) {
      const market_id = leg.parts[0].marketId
      const event_id = leg.parts[0].eventId
      if (markets.has(market_id) || events.has(event_id)) {
        return false
      }
      markets.add(market_id)
      events.add(event_id)
    }
    return true
  })

  // Calculate potential win for each combination
  const stake_per_combination = wager.currentSize / valid_combinations.length
  const round_robin_wagers = valid_combinations.map((combination) => {
    const odds_product = combination.reduce((product, leg) => {
      return product * (1 + Number(leg.parts[0].price) - 1)
    }, 1)
    const potential_win = stake_per_combination * odds_product

    return {
      stake: stake_per_combination,
      potential_win,
      parsed_odds: (odds_product - 1) * 100, // Convert to American odds
      selections: combination.map((leg) => ({
        ...leg.parts[0],
        name: format_fanduel_selection_name({
          selection: leg.parts[0],
          week: wager.week
        }),
        player_name: format_fanduel_player_name({ selection: leg.parts[0] }),
        event_id: leg.parts[0].eventId,
        market_id: leg.parts[0].marketId,
        source_id: 'FANDUEL',
        selection_id: leg.parts[0].selectionId,
        parsed_odds: Number(leg.parts[0].americanPrice),
        is_won: leg.result === 'WON',
        is_lost: leg.result === 'LOST'
      })),
      bet_receipt_id: `${wager.betReceiptId}-${combination.map((leg) => leg.parts[0].selectionId).join('-')}`,
      is_settled:
        wager.isSettled || combination.some((leg) => leg.result === 'LOST'),
      is_won: combination.every((leg) => leg.result === 'WON'),
      is_lost: combination.some((leg) => leg.result === 'LOST'),
      source_id: 'FANDUEL'
    }
  })

  return round_robin_wagers
}

const format_fanduel_player_name = ({ selection }) => {
  const player_name = selection.eventMarketDescription.split(' - ')[0]
  return format_player_name(player_name)
}

const format_draftkings_player_name = ({ selection }) => {
  const market_display_name = selection.marketDisplayName || ''

  const player_name = extract_draftkings_player_name(market_display_name)

  return format_player_name(player_name)
}

const standardize_wager = ({ wager, source }) => {
  if (source === 'fanduel') {
    const week = dayjs(wager.settledDate)
      .subtract('2', 'day')
      .diff(constants.season.start, 'weeks')

    // check if the wager is a round robin
    if (wager.numLines > 1) {
      const round_robin_wagers = calculate_fanduel_round_robin_wager({
        wager: { ...wager, week }
      })
      return round_robin_wagers
    }

    return {
      ...wager,
      week,
      selections: wager.legs.map((leg) => ({
        ...leg.parts[0],
        name: format_fanduel_selection_name({ selection: leg.parts[0], week }),
        player_name: format_fanduel_player_name({ selection: leg.parts[0] }),
        event_id: leg.parts[0].eventId,
        market_id: leg.parts[0].marketId,
        source_id: 'FANDUEL',
        selection_id: leg.parts[0].selectionId,
        result: leg.result || 'OPEN',
        parsed_odds: Number(leg.parts[0].americanPrice),
        is_won: leg.result === 'WON',
        is_lost: leg.result === 'LOST'
      })),
      bet_receipt_id: wager.betReceiptId.replace(
        /(\d{4})(\d{4})(\d{4})(\d{4})/,
        '$1-$2-$3-$4'
      ),
      parsed_odds: Number(wager.americanBetPrice),
      is_settled: wager.isSettled,
      is_won: wager.result === 'WON',
      potential_win: wager.betPrice * wager.currentSize,
      stake: wager.currentSize,
      source_id: 'FANDUEL'
    }
  } else if (source === 'draftkings') {
    if (wager.type === 'RoundRobin') {
      return wager.combinations.map((combination) => {
        const selections = combination.selectionsMapped.flatMap(
          (selectionId) => {
            const selection =
              wager.selections.find((s) => s.selectionId === selectionId) ||
              wager.selections.find(
                (s) =>
                  s.nestedSGPSelections &&
                  s.nestedSGPSelections.some(
                    (ns) => ns.selectionId === selectionId
                  )
              )

            if (!selection) {
              throw new Error(`Selection not found for ID: ${selectionId}`)
            }

            const standardize_selection = (sel) => ({
              name: format_draftkings_selection_name({
                selection: sel
              }),
              player_name: format_draftkings_player_name({ selection: sel }),
              event_id: sel.eventId,
              market_id: sel.marketId,
              selection_id: sel.selectionId,
              bet_receipt_id: wager.receiptId,
              source_id: 'DRAFTKINGS',
              result: sel.settlementStatus.toUpperCase(),
              parsed_odds: sel.displayOdds
                ? Number(sel.displayOdds.replace(/—|-|−/g, '-'))
                : null,
              is_won: sel.settlementStatus === 'Won',
              is_lost: sel.settlementStatus === 'Lost'
            })

            if (selection.nestedSGPSelections) {
              return selection.nestedSGPSelections.map(standardize_selection)
            } else {
              return [standardize_selection(selection)]
            }
          }
        )

        const stake = wager.stake / wager.numberOfBets
        const parsed_odds = combination.displayOdds
          ? Number(combination.displayOdds.replace(/\+/g, ''))
          : combination.trueOdds

        const is_won = combination.status === 'Won'
        const is_lost = combination.status === 'Lost'

        return {
          ...wager,
          selections,
          bet_receipt_id: `${wager.receiptId}-${combination.id}`,
          parsed_odds,
          is_settled: wager.status === 'Settled' || is_lost || is_won,
          is_won,
          is_lost,
          potential_win: combination.potentialReturns,
          stake,
          source_id: 'DRAFTKINGS'
        }
      })
    } else {
      return {
        ...wager,
        selections: wager.selections.map((selection) => ({
          ...selection,
          name: format_draftkings_selection_name({ selection }),
          player_name: format_draftkings_player_name({ selection }),
          event_id: selection.eventId,
          market_id: selection.marketId,
          selection_id: selection.selectionId,
          bet_receipt_id: wager.betReceiptId,
          source_id: 'DRAFTKINGS',
          result: selection.settlementStatus.toUpperCase(),
          parsed_odds: selection.displayOdds
            ? Number(selection.displayOdds.replace(/—|-|−/g, '-'))
            : null,
          is_won: selection.settlementStatus === 'Won',
          is_lost: selection.settlementStatus === 'Lost'
        })),
        bet_receipt_id: wager.receiptId,
        parsed_odds: wager.displayOdds
          ? Number(wager.displayOdds.replace(/—|-|−/g, '-'))
          : null,
        is_settled: wager.status === 'Settled',
        is_won: wager.settlementStatus === 'Won',
        potential_win: wager.potentialReturns,
        stake: wager.stake,
        source_id: 'DRAFTKINGS'
      }
    }
  }
  throw new Error(`Unknown wager source: ${source}`)
}

const analyze_prop_combinations = (lost_props, filtered, wager_summary) => {
  const one_prop = []
  const two_props = []
  const three_props = []

  const prop_summaries = new Map()
  const actual_prop_summaries = new Map()
  const wager_indices = new Map()
  const props_by_source = new Map()
  const wagers_by_source = new Map()

  // Index wagers and props by source_id
  filtered.forEach((wager, index) => {
    if (!wagers_by_source.has(wager.source_id)) {
      wagers_by_source.set(wager.source_id, [])
    }
    wagers_by_source.get(wager.source_id).push(wager)

    wager.selections.forEach((selection) => {
      const key = `${wager.source_id}:${selection.selection_id}`
      if (!wager_indices.has(key)) {
        wager_indices.set(key, new Set())
      }
      wager_indices.get(key).add(index)
    })
  })

  // Pre-calculate summaries for individual props
  const calculate_summary = ({ source_id, prop_ids, actual = false }) => {
    // Get the set of wager indices for the first prop
    const first_prop_key = `${source_id}:${prop_ids[0]}`
    let relevant_wager_indices = new Set(
      wager_indices.get(first_prop_key) || []
    )

    // Intersect with the indices of the remaining props
    for (let i = 1; i < prop_ids.length; i++) {
      const prop_key = `${source_id}:${prop_ids[i]}`
      const prop_indices = wager_indices.get(prop_key) || []
      relevant_wager_indices = new Set(
        [...relevant_wager_indices].filter((index) => prop_indices.has(index))
      )
    }

    const relevant_wagers = Array.from(relevant_wager_indices).map(
      (index) => filtered[index]
    )

    return get_wagers_summary({
      wagers: relevant_wagers,
      props: actual
        ? []
        : prop_ids.map((id) =>
            lost_props.find(
              (p) => p.selection_id === id && p.source_id === source_id
            )
          )
    })
  }

  const get_prop_summary = ({ source_id, prop_ids = [], actual = false }) => {
    const key = `${source_id}:${prop_ids.sort().join('|')}${actual ? ':actual' : ''}`
    if (!prop_summaries.has(key)) {
      prop_summaries.set(
        key,
        calculate_summary({ source_id, prop_ids, actual })
      )
    }
    return prop_summaries.get(key)
  }

  const calculate_potential_gain = ({ actual_summary, prop_summary }) => ({
    potential_gain: prop_summary.total_won - actual_summary.total_won,
    potential_wins: prop_summary.wagers_won - actual_summary.wagers_won,
    potential_roi_added:
      ((prop_summary.total_won - actual_summary.total_won) /
        wager_summary.total_risk) *
      100
  })

  lost_props.forEach((prop) => {
    if (!props_by_source.has(prop.source_id)) {
      props_by_source.set(prop.source_id, [])
    }
    props_by_source.get(prop.source_id).push(prop)
    const summary = calculate_summary({
      source_id: prop.source_id,
      prop_ids: [prop.selection_id]
    })
    const actual_summary = calculate_summary({
      source_id: prop.source_id,
      prop_ids: [prop.selection_id],
      actual: true
    })
    prop_summaries.set(prop.selection_id, summary)
    actual_prop_summaries.set(prop.selection_id, actual_summary)
  })

  // Use a Set for faster lookups
  const processed_combinations = new Set()

  // Analyze combinations for each source_id
  for (const [source_id, source_props] of props_by_source.entries()) {
    // Single prop analysis
    source_props.forEach((prop) => {
      const actual_summary = get_prop_summary({
        source_id,
        prop_ids: [prop.selection_id],
        actual: true
      })
      const summary = get_prop_summary({
        source_id,
        prop_ids: [prop.selection_id]
      })
      const { potential_gain, potential_wins, potential_roi_added } =
        calculate_potential_gain({ actual_summary, prop_summary: summary })

      if (prop.selectionName.includes('Justin Herbert 200+')) {
        console.log(actual_summary)
        console.log(summary)
        console.log(prop)
      }

      if (potential_gain > 0) {
        one_prop.push({
          name: prop.name,
          selection_id: prop.selection_id,
          source_id,
          potential_gain,
          potential_wins,
          potential_roi_added
        })
      }
    })

    // Two-prop and three-prop combinations
    for (let i = 0; i < source_props.length - 1; i++) {
      for (let j = i + 1; j < source_props.length; j++) {
        const two_prop_ids = [
          source_props[i].selection_id,
          source_props[j].selection_id
        ]
        const two_prop_key = `${source_id}:${two_prop_ids.sort().join('|')}`

        if (!processed_combinations.has(two_prop_key)) {
          processed_combinations.add(two_prop_key)
          const actual_summary = get_prop_summary({
            source_id,
            prop_ids: two_prop_ids,
            actual: true
          })
          const two_prop_summary = get_prop_summary({
            source_id,
            prop_ids: two_prop_ids
          })
          const { potential_gain, potential_wins, potential_roi_added } =
            calculate_potential_gain({
              actual_summary,
              prop_summary: two_prop_summary
            })

          const individual_gains = [
            get_prop_summary({
              source_id,
              prop_ids: [source_props[i].selection_id]
            }).total_won,
            get_prop_summary({
              source_id,
              prop_ids: [source_props[j].selection_id]
            }).total_won
          ]

          if (
            potential_gain > 0 &&
            two_prop_summary.total_won > Math.max(...individual_gains)
          ) {
            two_props.push({
              name: [source_props[i].name, source_props[j].name].join(' / '),
              selection_ids: two_prop_ids,
              source_id,
              potential_gain,
              potential_wins,
              potential_roi_added
            })
          }

          // Three-prop combinations
          for (let k = j + 1; k < source_props.length; k++) {
            const three_prop_ids = [
              ...two_prop_ids,
              source_props[k].selection_id
            ]
            const three_prop_key = `${source_id}:${three_prop_ids.sort().join('|')}`

            if (!processed_combinations.has(three_prop_key)) {
              processed_combinations.add(three_prop_key)
              const actual_summary = get_prop_summary({
                source_id,
                prop_ids: three_prop_ids,
                actual: true
              })
              const three_prop_summary = get_prop_summary({
                source_id,
                prop_ids: three_prop_ids
              })
              const three_prop_result = calculate_potential_gain({
                actual_summary,
                prop_summary: three_prop_summary
              })

              const two_prop_gains = [
                get_prop_summary({
                  source_id,
                  prop_ids: [
                    source_props[i].selection_id,
                    source_props[j].selection_id
                  ]
                }).total_won,
                get_prop_summary({
                  source_id,
                  prop_ids: [
                    source_props[i].selection_id,
                    source_props[k].selection_id
                  ]
                }).total_won,
                get_prop_summary({
                  source_id,
                  prop_ids: [
                    source_props[j].selection_id,
                    source_props[k].selection_id
                  ]
                }).total_won
              ]

              if (
                three_prop_result.potential_gain > 0 &&
                three_prop_summary.total_won >
                  Math.max(...two_prop_gains, ...individual_gains)
              ) {
                three_props.push({
                  name: [
                    source_props[i].name,
                    source_props[j].name,
                    source_props[k].name
                  ].join(' / '),
                  selection_ids: three_prop_ids,
                  source_id,
                  ...three_prop_result
                })
              }
            }
          }
        }
      }
    }
  }

  return { one_prop, two_props, three_props }
}

const format_round_robin_display = (wager) => {
  // Group selections by event_id
  const selections_by_event = wager.legs.reduce((acc, leg) => {
    const selection = leg.parts[0]
    if (!acc[selection.eventId]) {
      acc[selection.eventId] = []
    }
    acc[selection.eventId].push(selection)
    return acc
  }, {})

  // Format each event's selections
  const formatted_lines = Object.values(selections_by_event).map(
    (event_selections) => {
      // Group selections by player name
      const selections_by_player = event_selections.reduce((acc, selection) => {
        // Extract player name from eventMarketDescription
        const player_name = selection.eventMarketDescription.split(' - ')[0]
        if (!acc[player_name]) {
          acc[player_name] = []
        }
        acc[player_name].push(selection)
        return acc
      }, {})

      // Format each player's selections
      const player_lines = Object.entries(selections_by_player).map(
        ([player_name, player_selections]) => {
          // Group by stat type and quarter
          const grouped_by_stat = player_selections.reduce((acc, selection) => {
            const is_q1 = selection.eventMarketDescription.includes('1st Qtr')
            const parts = selection.eventMarketDescription.split(' - ')
            const stat_type =
              parts.length > 1
                ? parts[1]
                    .replace('Alt ', '')
                    .replace('1st Qtr ', '')
                    .replace('Receptions', 'recs')
                    .replace('Receiving Yds', 'recv')
                    .replace('Rushing Yds', 'rush')
                    .replace('Passing Yds', 'pass')
                : ''

            const key = is_q1 ? `q1_${stat_type}` : stat_type
            if (!acc[key]) {
              acc[key] = []
            }
            acc[key].push(selection)
            return acc
          }, {})

          // Format each stat type group
          const stat_lines = Object.entries(grouped_by_stat).map(
            ([stat_key, stat_selections]) => {
              const thresholds = stat_selections
                .map((selection) => {
                  const match =
                    selection.selectionName.match(/(\d+)\+ ?(Yards?)?/)
                  return match ? match[1] : null
                })
                .filter(Boolean)
                .sort((a, b) => Number(a) - Number(b))
                .map((threshold) => `${threshold}+`)
                .join(' / ')

              const is_q1 = stat_key.startsWith('q1_')
              const stat_type = is_q1 ? stat_key.replace('q1_', '') : stat_key

              return `${thresholds} ${is_q1 ? 'q1 ' : ''}${stat_type}`
            }
          )

          return `${player_name} ${stat_lines.join(' / ')}`
        }
      )

      return player_lines.join(' / ')
    }
  )

  return formatted_lines.join('\n')
}

const analyze_round_robin_selections = (wagers) => {
  // Track selection usage and combinations
  const selection_stats = new Map()

  wagers.forEach((wager) => {
    // Group selections by event for this wager
    const selections_by_event = wager.legs.reduce((acc, leg) => {
      const selection = leg.parts[0]
      if (!acc[selection.eventId]) {
        acc[selection.eventId] = []
      }
      acc[selection.eventId].push(selection)
      return acc
    }, {})

    // Process each selection
    Object.entries(selections_by_event).forEach(
      ([event_id, event_selections]) => {
        event_selections.forEach((selection) => {
          const is_q1 = selection.eventMarketDescription.includes('1st Qtr')
          const market_parts = selection.eventMarketDescription.split(' - ')
          const stat_type = market_parts[1]
            ? market_parts[1]
                .replace('Alt ', '')
                .replace('1st Qtr ', '')
                .replace('Receiving Yds', 'rec')
                .replace('Rushing Yds', 'rush')
                .replace('Passing Yds', 'pass')
            : ''

          const player_name = selection.eventMarketDescription.split(' - ')[0]
          const match = selection.selectionName.match(/(\d+)\+ ?(Yards?)?/)
          const threshold = match ? match[1] : null

          const selection_key = `${player_name} ${threshold}+ ${is_q1 ? 'q1 ' : ''}${stat_type}`

          if (!selection_stats.has(selection_key)) {
            selection_stats.set(selection_key, {
              count: 0,
              combinations: []
            })
          }

          const stat = selection_stats.get(selection_key)
          stat.count++

          // Add the other selections from this round robin, grouped by game
          const other_selections = Object.entries(selections_by_event)
            .filter(([other_event_id]) => other_event_id !== event_id)
            .map(([_, game_selections]) => {
              // Format the selections for this game
              const formatted_selections = format_round_robin_display({
                legs: game_selections.map((sel) => ({ parts: [sel] }))
              })
              return formatted_selections
            })

          if (other_selections.length > 0) {
            stat.combinations.push(other_selections)
          }
        })
      }
    )
  })

  // Sort by usage count and format output
  const sorted_selections = Array.from(selection_stats.entries()).sort(
    (a, b) => b[1].count - a[1].count
  )

  console.log('\n\nSelection Analysis:\n')
  sorted_selections.forEach(([selection_key, stats]) => {
    console.log(`${selection_key} (${stats.count} round robins)`)
    stats.combinations.forEach((combination, index) => {
      console.log(`  Round Robin ${index + 1}:`)
      combination.forEach((game_selections) => {
        console.log(`    ${game_selections}`)
      })
    })
    console.log()
  })
}

const analyze_wagers = async ({
  fanduel_filename,
  draftkings_filename,
  week,
  show_potential_gain = false,
  show_counts = false,
  show_bet_receipts = false,
  wagers_limit = Infinity,
  hide_wagers = false,
  wagers_lost_leg_limit = 1,
  filter_wagers_min_legs = 0,
  include_selections = [],
  exclude_selections = [],
  sort_by = 'odds',
  show_wager_roi = false,
  show_only_open_round_robins = false,
  show_round_robins = false
} = {}) => {
  if (!fanduel_filename && !draftkings_filename) {
    throw new Error('At least one filename (FanDuel or DraftKings) is required')
  }

  log({
    fanduel_filename,
    draftkings_filename,
    week,
    show_potential_gain,
    show_counts,
    show_bet_receipts,
    wagers_limit,
    wagers_lost_leg_limit,
    include_selections,
    exclude_selections,
    sort_by
  })

  let wagers = []
  let fanduel_round_robin_wagers = []

  if (fanduel_filename) {
    try {
      const fanduel_wagers = await fs.readJson(
        `${data_path}/${fanduel_filename}`
      )
      wagers = wagers.concat(
        fanduel_wagers.flatMap((wager) =>
          standardize_wager({ wager, source: 'fanduel' })
        )
      )
      fanduel_round_robin_wagers = fanduel_wagers.filter((wager) => {
        const is_round_robin = wager.numLines > 1
        if (show_only_open_round_robins) {
          return is_round_robin && wager.potentialWin > 0
        }
        return is_round_robin
      })
    } catch (error) {
      if (error.code === 'ENOENT') {
        console.warn(
          `Warning: FanDuel file '${fanduel_filename}' not found. Skipping FanDuel wagers.`
        )
      } else {
        throw error // Re-throw if it's not a file not found error
      }
    }
  }

  if (draftkings_filename) {
    try {
      const draftkings_wagers = await fs.readJson(
        `${data_path}/${draftkings_filename}`
      )
      wagers = wagers.concat(
        draftkings_wagers.flatMap((wager) => {
          const standardized_wager = standardize_wager({
            wager,
            source: 'draftkings'
          })
          return standardized_wager
        })
      )
    } catch (error) {
      if (error.code === 'ENOENT') {
        console.warn(
          `Warning: DraftKings file '${draftkings_filename}' not found. Skipping DraftKings wagers.`
        )
      } else {
        throw error // Re-throw if it's not a file not found error
      }
    }
  }

  // After both file reads, check if we have any wagers
  if (wagers.length === 0) {
    throw new Error(
      'No wagers found. Please check the filenames and try again.'
    )
  }

  const filtered = wagers.filter((wager) => {
    if (week) {
      return wager.week === week
    }
    return true
  })

  const wager_summary = get_wagers_summary({ wagers: filtered })
  wager_summary.current_roi = `${(
    (wager_summary.total_won / wager_summary.total_risk - 1) *
    100
  ).toFixed(2)}%`
  wager_summary.total_risk = Number(wager_summary.total_risk.toFixed(2))
  wager_summary.open_potential_win = Number(
    wager_summary.open_potential_win.toFixed(2)
  )
  wager_summary.max_potential_win = Number(
    wager_summary.max_potential_win.toFixed(2)
  )

  const selections_index = {}
  const event_index = {}

  for (const wager of filtered) {
    for (const selection of wager.selections) {
      if (!event_index[selection.event_id]) {
        event_index[selection.event_id] = selection.event_description
      }

      const key = `${selection.event_id}/${selection.market_id}/${selection.selection_id}`
      if (!selections_index[key]) {
        selections_index[key] = {
          ...selection,
          exposure_count: 0,
          open_wagers: 0,
          open_potential_payout: 0,
          max_potential_payout: 0,
          week: dayjs(selection.start_time)
            .subtract(2, 'day')
            .diff(constants.season.start, 'weeks')
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

  const unique_selections = Object.values(selections_index)
    .map((selection) => {
      return {
        ...selection,
        name: selection.name,
        exposure_rate: `${((selection.exposure_count / filtered.length) * 100).toFixed(2)}%`,
        open_potential_roi: `${((selection.open_potential_payout / wager_summary.total_risk) * 100).toFixed(0)}%`,
        max_potential_roi: `${((selection.max_potential_payout / wager_summary.total_risk) * 100).toFixed(0)}%`
      }
    })
    .sort((a, b) => b.exposure_count - a.exposure_count)

  // Add player summary table
  const player_summary = unique_selections.reduce((acc, selection) => {
    if (!selection.player_name) return acc

    if (!acc[selection.player_name]) {
      acc[selection.player_name] = {
        exposure_count: 0,
        open_wagers: 0,
        open_potential_payout: 0,
        max_potential_payout: 0,
        props_count: 0
      }
    }

    acc[selection.player_name].exposure_count += selection.exposure_count
    acc[selection.player_name].open_wagers += selection.open_wagers
    acc[selection.player_name].open_potential_payout +=
      selection.open_potential_payout
    acc[selection.player_name].max_potential_payout +=
      selection.max_potential_payout
    acc[selection.player_name].props_count += 1

    return acc
  }, {})

  const player_summary_table = new Table({ title: 'Player Exposure Summary' })
  Object.entries(player_summary)
    .map(([player_name, stats]) => ({
      player_name,
      props_count: stats.props_count,
      exposure_count: stats.exposure_count,
      exposure_rate: `${((stats.exposure_count / filtered.length) * 100).toFixed(2)}%`,
      open_wagers: stats.open_wagers,
      open_potential_roi: `${((stats.open_potential_payout / wager_summary.total_risk) * 100).toFixed(0)}%`,
      max_potential_roi: `${((stats.max_potential_payout / wager_summary.total_risk) * 100).toFixed(0)}%`
    }))
    .sort((a, b) => b.exposure_count - a.exposure_count)
    .forEach((player) => player_summary_table.addRow(player))

  player_summary_table.printTable()

  const props_summary = get_props_summary(unique_selections)
  const wager_summary_table = new Table({ title: 'Execution Summary' })

  const add_row = (label, value) => {
    if (typeof value === 'number') {
      if (label.includes('Potential Win')) {
        value = value.toLocaleString('en-US', { maximumFractionDigits: 2 })
      } else if (label === 'Expected Hits') {
        value = value.toFixed(2)
      }
    }
    wager_summary_table.addRow({ Metric: label, Value: value })
  }

  add_row('Current ROI', wager_summary.current_roi)
  add_row(
    'Open Potential ROI',
    `${((wager_summary.open_potential_win / wager_summary.total_risk - 1) * 100).toFixed(0)}%`
  )
  add_row(
    'Max Potential ROI',
    `${((wager_summary.max_potential_win / wager_summary.total_risk - 1) * 100).toFixed(0)}%`
  )

  // Add rows for props_summary
  for (const [key, value] of Object.entries(props_summary)) {
    add_row(
      key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      value
    )
  }

  if (show_counts) {
    add_row('Wagers', wager_summary.wagers)
    add_row('Total Won', wager_summary.total_won.toFixed(2))
    // add_row('Wagers Won', wager_summary.wagers_won)
    // add_row('Wagers Loss', wager_summary.wagers_loss)
    add_row('Wagers Open', wager_summary.wagers_open)
    add_row('Total Risk', wager_summary.total_risk)
  }

  if (show_potential_gain) {
    add_row('Open Potential Win', wager_summary.open_potential_win)
    add_row('Max Potential Win', wager_summary.max_potential_win)
  }

  wager_summary_table.printTable()

  if (show_round_robins) {
    console.log(
      `\n\nTotal FanDuel Round Robins: ${fanduel_round_robin_wagers.length}\n`
    )

    fanduel_round_robin_wagers.forEach((wager) => {
      const formatted_display = format_round_robin_display(wager)
      console.log(formatted_display)
      console.log('---')
    })

    analyze_round_robin_selections(fanduel_round_robin_wagers)
  }

  if (show_counts) {
    const lost_by_legs_summary_table = new Table({
      title: 'Wagers Lost By # Legs'
    })
    lost_by_legs_summary_table.addRow({
      1: wager_summary.lost_by_one_leg,
      2: wager_summary.lost_by_two_legs,
      3: wager_summary.lost_by_three_legs,
      '4+': wager_summary.lost_by_four_or_more_legs
    })
    lost_by_legs_summary_table.printTable()
  }

  const unique_props_table = new Table()
  const props_with_exposure = unique_selections.map((prop) => {
    const result = {
      name: prop.name,
      odds: prop.parsed_odds,
      result: prop.result,
      exposure_rate: prop.exposure_rate
    }

    if (show_counts) {
      result.exposure_count = prop.exposure_count
      result.open_wagers = prop.open_wagers
    }

    if (show_potential_gain) {
      result.open_potential_payout = prop.open_potential_payout.toFixed(2)
      result.open_potential_roi = prop.open_potential_roi
    }
    result.max_potential_roi = prop.max_potential_roi

    if (show_potential_gain) {
      result.max_potential_payout = prop.max_potential_payout.toFixed(2)
    }

    return result
  })

  props_with_exposure.forEach((prop) => unique_props_table.addRow(prop))
  unique_props_table.printTable()

  // Get unique event_ids for each book
  const fanduel_event_ids = new Set(
    wagers
      .filter((w) => w.source_id === 'FANDUEL')
      .flatMap((w) => w.selections.map((s) => s.event_id))
  )
  const draftkings_event_ids = new Set(
    wagers
      .filter((w) => w.source_id === 'DRAFTKINGS')
      .flatMap((w) => w.selections.map((s) => s.event_id))
  )

  // Get mapping of event_id to esbid
  const fanduel_esbid_mapping = await db('prop_markets_index')
    .whereIn('source_event_id', Array.from(fanduel_event_ids))
    .where('source_id', 'FANDUEL')
    .select('source_event_id', 'esbid')

  const draftkings_esbid_mapping = await db('prop_markets_index')
    .whereIn('source_event_id', Array.from(draftkings_event_ids))
    .where('source_id', 'DRAFTKINGS')
    .select('source_event_id', 'esbid')

  // Create a combined mapping
  const event_id_to_esbid = new Map([
    ...fanduel_esbid_mapping.map((row) => [row.source_event_id, row.esbid]),
    ...draftkings_esbid_mapping.map((row) => [row.source_event_id, row.esbid])
  ])

  // Get game titles from nfl_games table
  const esbids = new Set([...event_id_to_esbid.values()])
  const game_titles = await db('nfl_games')
    .whereIn('esbid', Array.from(esbids))
    .select('esbid', db.raw("v || ' @ ' || h AS title"))

  const esbid_to_title = new Map(
    game_titles.map((row) => [row.esbid, row.title])
  )

  // Group selections by esbid
  const grouped_props_by_esbid = unique_selections.reduce(
    (grouped_props, prop) => {
      const esbid = event_id_to_esbid.get(prop.event_id)
      if (!esbid) return grouped_props
      if (!grouped_props[esbid]) {
        grouped_props[esbid] = []
      }
      grouped_props[esbid].push(prop)
      return grouped_props
    },
    {}
  )

  // Print exposures by game
  for (const esbid in grouped_props_by_esbid) {
    const event_table = new Table({
      title: esbid_to_title.get(Number(esbid)) || 'Unknown Game'
    })
    grouped_props_by_esbid[esbid]
      .sort((a, b) => b.exposure_count - a.exposure_count)
      .forEach((prop) => {
        const row = {
          name: prop.name,
          odds: prop.parsed_odds,
          exposure_rate: prop.exposure_rate,
          result: prop.result,
          max_potential_roi: prop.max_potential_roi,
          open_potential_roi: prop.open_potential_roi
        }

        if (show_counts) {
          row.open_wagers = prop.open_wagers
        }

        if (show_potential_gain) {
          row.open_potential_payout = prop.open_potential_payout.toFixed(2)
          row.max_potential_payout = prop.max_potential_payout.toFixed(2)
        }

        event_table.addRow(row)
      })
    event_table.printTable()
  }

  const lost_props = unique_selections.filter((prop) => prop.is_lost)
  const { one_prop, two_props, three_props } = analyze_prop_combinations(
    lost_props,
    filtered,
    wager_summary
  )

  // Display results
  const display_prop_table = (props, title) => {
    if (props.length) {
      const table = new Table({ title })
      for (const prop of props.sort(
        (a, b) => b.potential_gain - a.potential_gain
      )) {
        table.addRow({
          name: prop.name,
          potential_roi_added: `${prop.potential_roi_added.toFixed(2)}%`,
          potential_gain: prop.potential_gain.toFixed(2),
          potential_wins: prop.potential_wins
        })
      }
      table.printTable()
    }
  }

  display_prop_table(one_prop, 'One Leg Away')
  display_prop_table(two_props, 'Two Legs Away')
  display_prop_table(three_props, 'Three Legs Away')

  if (!hide_wagers) {
    console.log(
      '\n\nTop 50 slips sorted by highest odds (<= specified lost legs)\n\n'
    )

    const filtered_wagers = filtered.filter((wager) => {
      const lost_legs = wager.selections.filter(
        (selection) => selection.is_lost
      ).length
      return lost_legs <= wagers_lost_leg_limit
    })

    log(`filtered_wagers: ${filtered_wagers.length}`)

    const display_wagers = filtered_wagers.filter((wager) => {
      // Filter out wagers that include any of the excluded selections
      if (exclude_selections.length > 0) {
        if (
          wager.selections.some((selection) =>
            exclude_selections.some((filter) =>
              selection.name.toLowerCase().includes(filter.toLowerCase())
            )
          )
        ) {
          return false
        }
      }

      // Filter to only include wagers that have all of the included selections
      if (include_selections.length > 0) {
        return include_selections.every((filter) =>
          wager.selections.some((selection) =>
            selection.name.toLowerCase().includes(filter.toLowerCase())
          )
        )
      }

      return true
    })

    log(`display_wagers: ${display_wagers.length}`)

    const sorted_wagers = display_wagers.sort((a, b) => {
      if (sort_by === 'payout') {
        return b.potential_win - a.potential_win
      }
      return b.parsed_odds - a.parsed_odds
    })

    for (const wager of sorted_wagers.slice(0, wagers_limit)) {
      const potential_roi_gain =
        (wager.potential_win / wager_summary.total_risk) * 100
      const num_of_legs = wager.selections.length
      let wager_table_title = `[${num_of_legs} leg parlay] American odds: ${
        wager.parsed_odds > 0 ? '+' : ''
      }${Number(wager.parsed_odds).toFixed(0)}`

      if (show_wager_roi) {
        wager_table_title += ` / ${potential_roi_gain.toFixed(2)}% roi`
      }

      if (show_potential_gain) {
        wager_table_title += ` ($${wager.potential_win.toFixed(2)})`
      }

      if (show_bet_receipts && wager.bet_receipt_id) {
        wager_table_title += ` / Bet Receipt: ${wager.bet_receipt_id}`
      }

      // wager_table_title += ` [Week ${wager.week}]`

      const wager_table = new Table({ title: wager_table_title })
      for (const selection of wager.selections) {
        wager_table.addRow({
          selection: selection.name,
          odds: selection.parsed_odds,
          result: selection.is_won ? 'WON' : selection.is_lost ? 'LOST' : 'OPEN'
        })
      }
      wager_table.printTable()
    }
  }
}

const main = async () => {
  let error
  try {
    await analyze_wagers({
      fanduel_filename: argv.fanduel,
      draftkings_filename: argv.draftkings,
      week: argv.week,
      show_potential_gain: argv.show_potential_gain,
      show_counts: argv.show_counts,
      show_bet_receipts: argv.show_bet_receipts,
      wagers_limit: argv.wagers_limit,
      wagers_lost_leg_limit: argv.wagers_lost_leg_limit,
      include_selections: Array.isArray(argv.include)
        ? argv.include
        : argv.include
          ? [argv.include]
          : [],
      exclude_selections: Array.isArray(argv.exclude)
        ? argv.exclude
        : argv.exclude
          ? [argv.exclude]
          : [],
      hide_wagers: argv.hide_wagers,
      filter_wagers_min_legs: argv.min_legs,
      sort_by: argv.sort_by || 'odds',
      show_wager_roi: argv.show_wager_roi,
      show_only_open_round_robins: argv.show_only_open_round_robins,
      show_round_robins: argv.show_round_robins
    })
  } catch (err) {
    error = err
    log(error)
  }

  process.exit()
}

if (is_main(import.meta.url)) {
  main()
}

export default analyze_wagers
