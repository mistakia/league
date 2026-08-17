import debug from 'debug'

import db from '#db'
import { is_main, getLeague } from '#libs-server'
import {
  find_or_create_scoring_format,
  find_or_create_league_format
} from '#libs-server/find-or-create-format.mjs'
import {
  scoring_formats as named_scoring_formats,
  league_formats as named_league_formats
} from '#libs-shared/league-format-definitions.mjs'

const log = debug('generate-league-formats')
debug.enable('generate-league-formats')

const generate_scoring_format_title = (scoring_format) => {
  const parts = []

  if (scoring_format.receptions === 1) {
    parts.push('PPR')
  } else if (scoring_format.receptions === 0.5) {
    parts.push('0.5PPR')
  } else if (scoring_format.receptions === 0) {
    parts.push('Standard')
  }

  if (scoring_format.tight_end_reception > scoring_format.receptions) {
    parts.push(
      `TE+${scoring_format.tight_end_reception - scoring_format.receptions}`
    )
  }

  parts.push(`${scoring_format.passing_touchdowns}PTD`)
  parts.push(`${scoring_format.passing_interceptions}INT`)

  if (scoring_format.passing_yards !== 0.04) {
    parts.push(`${scoring_format.passing_yards}PY`)
  }
  if (scoring_format.fumbles_lost !== -2) {
    parts.push(`${scoring_format.fumbles_lost}FUM`)
  }

  return parts.join(' / ')
}

const generate_league_formats = async () => {
  const options = {
    number_teams: [10, 12],
    starter_slots_quarterback: [1],
    starter_slots_running_back: [2],
    starter_slots_wide_receiver: [2],
    starter_slots_tight_end: [1],
    starter_slots_running_back_wide_receiver_flex: [0],
    srbwrte: [1, 2],
    sqbrbwrte: [0, 1],
    starter_slots_wide_receiver_tight_end_flex: [0],
    starter_slots_defense_special_teams: [1],
    starter_slots_kicker: [0, 1],
    bench_slot_count: [7],
    practice_squad_slot_count: [4],
    reserve_short_term_limit: [3],
    passing_attempts: [0],
    passing_completions: [0],
    passing_yards: [0.04, 0.05],
    passing_interceptions: [-1, -2],
    passing_touchdowns: [4, 6],
    rushing_attempts: [0],
    rushing_yards: [0.1],
    rushing_touchdowns: [6],
    receptions: [0, 0.5, 1],
    receiving_yards: [0.1],
    two_point_conversions: [2],
    receiving_touchdowns: [6],
    fumbles_lost: [-1, -2],
    punt_return_touchdowns: [6],
    kickoff_return_touchdowns: [6],
    // The third member of the return-touchdown set. It was added as a scoring
    // column after this list was written and never added here, which left it
    // undefined in every generated combination -- and because it is NOT NULL
    // with no schema default and no registry default, resolve_scoring_config
    // mapped it to null and the seeder aborted on its first insert. All 65
    // production rows carry 6, matching its two siblings, so this value makes
    // the generated configs match existing rows and dedup onto them rather than
    // minting duplicates.
    fumble_return_touchdowns: [6],
    targets: [0],
    rushing_first_downs: [0],
    receiving_first_downs: [0],
    is_excluding_quarterback_kneels: [false],
    salary_cap: [200],
    min_bid: [0]
  }

  const keys = Object.keys(options)
  const combinations = keys.reduce(
    (acc, key) => {
      const new_combinations = []
      acc.forEach((combination) => {
        options[key].forEach((option) => {
          const new_combination = { ...combination, [key]: option }
          if (
            !(
              new_combination.starter_slots_running_back +
                new_combination.starter_slots_wide_receiver >
              5
            ) &&
            !(
              new_combination.srbwrte +
                new_combination.starter_slots_running_back_wide_receiver_flex -
                Math.max(
                  new_combination.srbwrte,
                  new_combination.starter_slots_running_back_wide_receiver_flex
                ) >
              0
            )
          ) {
            new_combinations.push(new_combination)
          }
        })
      })
      return new_combinations
    },
    [{}]
  )

  log(`Generated ${combinations.length} combinations`)

  const extract_scoring = (c) => ({
    passing_attempts: c.passing_attempts,
    passing_completions: c.passing_completions,
    passing_yards: c.passing_yards,
    passing_interceptions: c.passing_interceptions,
    passing_touchdowns: c.passing_touchdowns,
    rushing_attempts: c.rushing_attempts,
    rushing_yards: c.rushing_yards,
    rushing_touchdowns: c.rushing_touchdowns,
    receptions: c.receptions,
    running_back_reception: c.receptions,
    wide_receiver_reception: c.receptions,
    tight_end_reception: c.receptions,
    receiving_yards: c.receiving_yards,
    two_point_conversions: c.two_point_conversions,
    receiving_touchdowns: c.receiving_touchdowns,
    fumbles_lost: c.fumbles_lost,
    punt_return_touchdowns: c.punt_return_touchdowns,
    kickoff_return_touchdowns: c.kickoff_return_touchdowns,
    fumble_return_touchdowns: c.fumble_return_touchdowns,
    targets: c.targets,
    rushing_first_downs: c.rushing_first_downs,
    receiving_first_downs: c.receiving_first_downs,
    is_excluding_quarterback_kneels: c.is_excluding_quarterback_kneels
  })

  const extract_league = (c) => ({
    number_teams: c.number_teams,
    starter_slots_quarterback: c.starter_slots_quarterback,
    starter_slots_running_back: c.starter_slots_running_back,
    starter_slots_wide_receiver: c.starter_slots_wide_receiver,
    starter_slots_tight_end: c.starter_slots_tight_end,
    starter_slots_running_back_wide_receiver_flex:
      c.starter_slots_running_back_wide_receiver_flex,
    srbwrte: c.srbwrte,
    sqbrbwrte: c.sqbrbwrte,
    starter_slots_wide_receiver_tight_end_flex:
      c.starter_slots_wide_receiver_tight_end_flex,
    starter_slots_defense_special_teams: c.starter_slots_defense_special_teams,
    starter_slots_kicker: c.starter_slots_kicker,
    bench_slot_count: c.bench_slot_count,
    practice_squad_slot_count: c.practice_squad_slot_count,
    reserve_short_term_limit: c.reserve_short_term_limit,
    salary_cap: c.salary_cap,
    min_bid: c.min_bid
  })

  const default_league = await getLeague({ lid: 0 })
  const all_combinations = [...combinations, default_league]

  // Dedupe scoring tuples in-memory so each unique tuple incurs one find_or_create RTT.
  const unique_scoring = new Map()
  for (const combination of all_combinations) {
    const scoring_format = extract_scoring(combination)
    const key = JSON.stringify(scoring_format)
    if (!unique_scoring.has(key)) {
      unique_scoring.set(key, scoring_format)
    }
  }

  const scoring_id_by_key = new Map()
  for (const [key, scoring_format] of unique_scoring) {
    const scoring_format_id = await find_or_create_scoring_format(
      db,
      scoring_format
    )
    scoring_id_by_key.set(key, scoring_format_id)
    // title is not part of the unique tuple; refresh it for any new/existing row
    await db('league_scoring_formats')
      .where({ id: scoring_format_id })
      .update({
        scoring_format_title: generate_scoring_format_title(scoring_format)
      })
  }
  const scoring_inserts = unique_scoring.size

  // Dedupe league tuples + scoring_format_id in-memory.
  const unique_league = new Map()
  for (const combination of all_combinations) {
    const scoring_key = JSON.stringify(extract_scoring(combination))
    const scoring_format_id = scoring_id_by_key.get(scoring_key)
    const league_format = {
      ...extract_league(combination),
      scoring_format_id
    }
    const key = JSON.stringify(league_format)
    if (!unique_league.has(key)) {
      unique_league.set(key, league_format)
    }
  }

  for (const league_format of unique_league.values()) {
    await find_or_create_league_format(db, league_format)
  }
  const league_inserts = unique_league.size

  log('Processing named format definitions...')

  // The catalog KEY is the row's identity for a named format. Discarding it
  // here (this loop destructured `[, format_def]`) meant every named format
  // minted a uuid instead; the slugs in production came from the 2026-05-28
  // format-id migration, so nothing surfaced the gap until SFB16 became the
  // first named format added since.
  for (const [key, format_def] of Object.entries(named_scoring_formats)) {
    const scoring_format_id = await find_or_create_scoring_format(
      db,
      format_def.config,
      key
    )
    await db('league_scoring_formats')
      .where({ id: scoring_format_id })
      .update({ scoring_format_title: format_def.label })
  }

  for (const [key, format_def] of Object.entries(named_league_formats)) {
    const scoring_format_config =
      named_scoring_formats[format_def.scoring_format]?.config
    if (!scoring_format_config) {
      log(
        `Warning: Scoring format '${format_def.scoring_format}' not found for league format '${key}'`
      )
      continue
    }
    const scoring_format_id = await find_or_create_scoring_format(
      db,
      scoring_format_config,
      format_def.scoring_format
    )
    await find_or_create_league_format(
      db,
      {
        ...format_def.config,
        scoring_format_id,
        pricing_model: format_def.pricing_model || 'auction'
      },
      key
    )
  }

  log(
    `Added ${Object.keys(named_scoring_formats).length} named scoring formats`
  )
  log(`Added ${Object.keys(named_league_formats).length} named league formats`)
  log(
    `Combinations: ${scoring_inserts} new scoring rows, ${league_inserts} league upserts`
  )
}

const main = async () => {
  let error
  try {
    await generate_league_formats()
  } catch (err) {
    error = err
    log(error)
  }

  process.exit()
}

if (is_main(import.meta.url)) {
  main()
}

export default generate_league_formats
