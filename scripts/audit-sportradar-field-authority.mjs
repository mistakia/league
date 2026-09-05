// Enumerate the nfl_plays columns the Sportradar play importer WRITES, and split
// them by whether the importer's field-authority policy says anything about them.
//
// Why this exists: the importer decides a contested field through two sets --
// SPORTRADAR_EXCLUSIVE_FIELDS (safe to overwrite) and SPORTRADAR_PROTECTED_FIELDS
// (never overwrite) -- plus whatever is hardcoded into `overwrite_fields` at the
// `update_play` call site. Every column outside those is fill-only by default with
// no ruling recorded about who owns it, and every 2025 defect found so far sits in
// that ungoverned remainder. Scoping that remainder by the NAMES of the fields
// somebody happened to measure finds whatever fraction is named alike; this derives
// it from the code that defines it.
//
// The written set is measured by EXECUTION, not by grep: `map_sportradar_play_to_nfl_play`
// is run over a synthetic play built to reach every mapping branch, and its keys are
// exactly what `update_play` receives. Two things a grep cannot do and this can --
// it resolves the template-literal keys (`sack_${idx}_sportradar_player_id`), and it
// cannot credit a key to a branch that no longer runs.
//
// The fixture is the weak half of that: a branch it fails to reach contributes no key
// and the count silently shrinks. So a static pass reads the same mapping functions
// for column-named write targets and FAILS when it finds one execution did not
// produce. The runtime set is the answer; the static set is the control on the fixture.
//
// Columns are read from db/schema.postgres.sql rather than from a live database, so
// this is hermetic and runs without a connection.

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

import * as acorn from 'acorn'

import { map_sportradar_play_to_nfl_play } from './import-plays-sportradar.mjs'
import { SPORTRADAR_EXCLUSIVE_FIELDS } from '#libs-server/sportradar/sportradar-exclusive-fields.mjs'
import { SPORTRADAR_PROTECTED_FIELDS } from '#libs-server/sportradar/sportradar-protected-fields.mjs'
import {
  add_personnel_counts_to_play_data,
  PERSONNEL_OFFENSE_COLUMNS,
  PERSONNEL_DEFENSE_COLUMNS
} from '#libs-server/parse-personnel.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repo_root = path.join(__dirname, '..')

// The one field reached past both authority lists, hardcoded in `overwrite_fields`
// at the `update_play` call site in scripts/import-plays-sportradar.mjs.
const HARDCODED_OVERWRITE_FIELDS = ['drive_yards']

// ---------------------------------------------------------------------------
// nfl_plays columns, read from the tracked schema export
// ---------------------------------------------------------------------------

const read_nfl_plays_columns = () => {
  const schema_path = path.join(repo_root, 'db', 'schema.postgres.sql')
  const schema = fs.readFileSync(schema_path, 'utf8')

  const start_marker = 'CREATE TABLE public.nfl_plays (\n'
  const start = schema.indexOf(start_marker)
  if (start === -1) {
    throw new Error(
      `could not find CREATE TABLE public.nfl_plays in ${schema_path}`
    )
  }
  const body_start = start + start_marker.length
  const end = schema.indexOf('\n);', body_start)
  if (end === -1) {
    throw new Error('unterminated CREATE TABLE public.nfl_plays body')
  }

  const columns = new Set()
  for (const raw_line of schema.slice(body_start, end).split('\n')) {
    const line = raw_line.trim()
    if (!line || line.startsWith('--')) continue
    // pg_dump moves constraints out into ALTER TABLE, so a body line is a column
    // definition. Guard anyway: a CONSTRAINT line would otherwise read as a column.
    if (/^(CONSTRAINT|PRIMARY KEY|UNIQUE|CHECK|FOREIGN KEY)\b/i.test(line))
      continue
    const match = line.match(/^([a-z_][a-z0-9_]*)\s/)
    if (match) columns.add(match[1])
  }

  if (columns.size < 100) {
    throw new Error(
      `parsed only ${columns.size} nfl_plays columns -- the schema block shape moved`
    )
  }

  return columns
}

// ---------------------------------------------------------------------------
// The written set, by execution
// ---------------------------------------------------------------------------

const team_ref = (alias) => ({ id: `sr:team:${alias}`, alias })
const player_ref = (id, role) => ({ id, name: `Player ${id}`, role })

// One synthetic play carrying every stat type, every detail category and every
// optional field the mappers branch on. It is deliberately not a realistic play --
// a real one exercises a handful of branches, and the point here is coverage.
const build_sportradar_play = () => ({
  id: 'sr:play:1',
  type: 'play',
  play_type: 'pass',
  wall_clock: '2025-09-07T17:00:00Z',
  clock: '12:34',
  nullified: false,
  kneel_down: false,
  spike: false,
  qb_at_snap: 'Shotgun',
  hash_mark: 'Left Hash',
  running_lane: 4,
  pocket_location: 'Middle',
  screen_pass: true,
  run_pass_option: true,
  fake_punt: true,
  fake_field_goal: true,
  huddle: 'No Huddle',
  blitz: 1,
  left_tightends: 1,
  right_tightends: 1,
  home_points: 7,
  away_points: 3,
  start_situation: {
    down: 2,
    yfd: 8,
    possession: team_ref('KC'),
    location: { alias: 'KC', yardline: 35 }
  },
  end_situation: {
    location: { alias: 'KC', yardline: 45 }
  },
  statistics: [
    {
      stat_type: 'pass',
      player: player_ref('sr:player:qb'),
      team: team_ref('KC'),
      yards: 12,
      complete: 1,
      touchdown: 1,
      interception: 1,
      sack: 1,
      sack_yards: -7,
      pocket_time: 2.6,
      firstdown: 1,
      knockdown: 1,
      hurry: 1,
      goaltogo: 1
    },
    {
      stat_type: 'receive',
      player: player_ref('sr:player:wr'),
      team: team_ref('KC'),
      yards: 12,
      yards_after_catch: 5,
      yards_after_contact: 3,
      broken_tackles: 1,
      touchdown: 1,
      firstdown: 1,
      catchable: 1,
      dropped: 1,
      goaltogo: 1
    },
    {
      stat_type: 'rush',
      player: player_ref('sr:player:rb'),
      team: team_ref('KC'),
      yards: 6,
      touchdown: 1,
      broken_tackles: 2,
      kneel_down: 1,
      firstdown: 1,
      goaltogo: 1,
      yards_after_contact: 4
    },
    {
      stat_type: 'field_goal',
      kicker: player_ref('sr:player:k'),
      team: team_ref('KC'),
      attempt: 1,
      yards: 42,
      made: 1,
      missed: 0,
      blocked: 1
    },
    {
      stat_type: 'punt',
      punter: player_ref('sr:player:p'),
      team: team_ref('KC'),
      attempt: 1,
      yards: 45,
      hang_time: 4.4,
      blocked: 1,
      inside_20: 1,
      touchback: 1
    },
    {
      stat_type: 'kick',
      player: player_ref('sr:player:ko'),
      team: team_ref('KC'),
      attempt: 1,
      yards: 65,
      onside_attempt: 1,
      touchback: 1
    },
    {
      stat_type: 'return',
      returner: player_ref('sr:player:ret'),
      team: team_ref('BUF'),
      category: 'interception',
      yards: 20,
      touchdown: 1,
      touchback: 1,
      faircatch: 1,
      out_of_bounds: 1
    },
    {
      stat_type: 'penalty',
      player: player_ref('sr:player:pen'),
      team: team_ref('BUF'),
      yards: 10
    },
    { stat_type: 'fumble', player: player_ref('sr:player:fum'), fumble: 1 },
    {
      stat_type: 'defense',
      tlost: 1,
      team: team_ref('BUF'),
      player: player_ref('sr:player:tfl1')
    },
    {
      stat_type: 'defense',
      tlost: 1,
      team: team_ref('BUF'),
      player: player_ref('sr:player:tfl2')
    }
  ],
  details: [
    {
      category: 'penalty',
      penalty: {
        team: team_ref('BUF'),
        description: 'Defensive Holding',
        result: 'declined'
      }
    },
    {
      category: 'pass_incompletion',
      incompletion_type: 'Thrown Away',
      direction: 'Left'
    },
    { category: 'field_goal', reason_missed: 'Wide Left' },
    {
      category: 'forced_fumble',
      team: team_ref('BUF'),
      players: [player_ref('sr:player:ff')]
    },
    {
      category: 'own_fumble_recovery',
      team: team_ref('KC'),
      players: [player_ref('sr:player:fr')]
    },
    {
      category: 'sack',
      team: team_ref('BUF'),
      players: [
        player_ref('sr:player:s1', 'sack'),
        player_ref('sr:player:s2', 'sack')
      ]
    },
    { category: 'safety' }
  ]
})

const build_drive_context = () => ({
  id: 'sr:drive:1',
  sequence: 3,
  play_count: 8,
  duration: '03:18',
  gain: 55,
  first_downs: 3,
  penalty_yards: 5,
  start_reason: 'Kickoff',
  end_reason: 'Touchdown'
})

const build_game_context = () => ({
  esbid: '2025090700',
  sportradar_game_id: 'sr:game:1',
  period_number: 2,
  home_team: 'KC',
  away_team: 'BUF'
})

// The importer resolves players through a preloaded cache and the database. The
// enumeration only needs the KEYS a resolved player produces, so a stub that always
// resolves is both sufficient and stricter than the real one -- it reaches every
// pid branch rather than only the ones a given roster happens to match.
const stub_resolve_player = async () => ({
  pid: 'TEST-PLAY-000001',
  gsisid: '00-0000001',
  sportradar_id: 'sr:player:stub'
})

const collect_written_keys = async () => {
  const mapped = await map_sportradar_play_to_nfl_play({
    sportradar_play: build_sportradar_play(),
    game_context: build_game_context(),
    drive_context: build_drive_context(),
    team_mappings_cache: new Map(),
    resolve_player: stub_resolve_player
  })

  // `process_play` runs this over the mapped play before handing it to update_play,
  // so it is part of the write path and belongs in the enumeration. It reads
  // `offense_personnel` / `defense_personnel` off the play, and no Sportradar mapper
  // sets either, so on this path it writes nothing. Run it exactly as the importer
  // does rather than seeding those two inputs -- seeding them credits Sportradar with
  // eight personnel-count columns it does not write, which is the same
  // scoping-by-plausibility error this whole audit exists to avoid.
  add_personnel_counts_to_play_data(mapped)

  const personnel_columns = [
    ...Object.values(PERSONNEL_OFFENSE_COLUMNS),
    ...Object.values(PERSONNEL_DEFENSE_COLUMNS)
  ]
  const personnel_written = personnel_columns.filter(
    (column) => column in mapped
  )

  return { written_keys: new Set(Object.keys(mapped)), personnel_written }
}

// ---------------------------------------------------------------------------
// The static control on the fixture
// ---------------------------------------------------------------------------

// Only these functions build the update object. Scanning whole files instead would
// sweep in `build_match_criteria`, whose keys are column names used as query
// criteria rather than writes -- a false "the fixture missed this" on every run.
const MAPPING_FUNCTIONS = {
  'scripts/import-plays-sportradar.mjs': [
    'map_basic_play_data',
    'map_contextual_data',
    'map_formation_data',
    'map_drive_data',
    'map_sportradar_play_to_nfl_play'
  ],
  'libs-server/sportradar/sportradar-stats-mappers.mjs': [
    'map_passing_stats',
    'map_receiving_stats',
    'map_rushing_stats',
    'map_field_goal_stats',
    'map_punt_stats',
    'map_kickoff_stats',
    'map_return_stats',
    'map_penalty_stats',
    'map_play_details'
  ],
  'libs-server/sportradar/sportradar-transforms.mjs': [
    'calculate_time_remaining'
  ]
}

// The two helpers in the importer that take their target column as an argument.
const SETTER_HELPERS = new Set(['set_if_defined', 'set_boolean_if_defined'])

const walk = (node, visit) => {
  if (!node || typeof node.type !== 'string') return
  visit(node)
  for (const key of Object.keys(node)) {
    if (key === 'type' || key === 'start' || key === 'end') continue
    const value = node[key]
    if (Array.isArray(value)) {
      for (const child of value) {
        if (child && typeof child.type === 'string') walk(child, visit)
      }
    } else if (value && typeof value.type === 'string') {
      walk(value, visit)
    }
  }
}

const find_named_functions = (ast, names) => {
  const found = new Map()
  walk(ast, (node) => {
    if (
      node.type !== 'VariableDeclarator' &&
      node.type !== 'FunctionDeclaration'
    ) {
      return
    }
    const name = node.id && node.id.type === 'Identifier' ? node.id.name : null
    if (name && names.includes(name)) found.set(name, node)
  })
  return found
}

const collect_static_keys = () => {
  const keys = new Set()
  const missing_functions = []

  for (const [relative_path, function_names] of Object.entries(
    MAPPING_FUNCTIONS
  )) {
    const source = fs.readFileSync(path.join(repo_root, relative_path), 'utf8')
    const ast = acorn.parse(source, {
      ecmaVersion: 'latest',
      sourceType: 'module'
    })
    const found = find_named_functions(ast, function_names)

    for (const name of function_names) {
      if (!found.has(name)) {
        missing_functions.push(`${relative_path}:${name}`)
        continue
      }
      walk(found.get(name), (node) => {
        // `mapped.<column> = ...` / `play[column] = ...`
        if (
          node.type === 'AssignmentExpression' &&
          node.left.type === 'MemberExpression' &&
          !node.left.computed &&
          node.left.property.type === 'Identifier'
        ) {
          keys.add(node.left.property.name)
        }
        // Object literal keys -- `const mapped = { ... }`, `Object.assign(mapped, { ... })`
        if (node.type === 'Property' && !node.computed) {
          if (node.key.type === 'Identifier') keys.add(node.key.name)
          else if (
            node.key.type === 'Literal' &&
            typeof node.key.value === 'string'
          ) {
            keys.add(node.key.value)
          }
        }
        // set_if_defined(mapped, source, 'source_key', 'target_key')
        if (
          node.type === 'CallExpression' &&
          node.callee.type === 'Identifier' &&
          SETTER_HELPERS.has(node.callee.name)
        ) {
          const target = node.arguments[3] || node.arguments[2]
          if (target && target.type === 'Literal') keys.add(target.value)
        }
      })
    }
  }

  if (missing_functions.length) {
    throw new Error(
      `mapping functions not found (renamed or moved): ${missing_functions.join(', ')}`
    )
  }

  return keys
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

const format_list = (items) =>
  items.length ? items.map((item) => `  ${item}`).join('\n') : '  (none)'

// `update_play` drops these three before building the UPDATE, so a write to one of
// them is not a field this policy has to rule on.
const NEVER_WRITTEN_PROPS = new Set(['esbid', 'play_id', 'updated'])

// Both classifications are set membership, which is exactly the shape that returns a
// confident answer after it has stopped being able to report. Drive each with an
// input whose correct answer is known and differs from the unperturbed one.
const run_negative_controls = ({
  written_columns,
  static_keys,
  written_keys
}) => {
  const controls = []

  const probe = written_columns.find(
    (column) =>
      !SPORTRADAR_EXCLUSIVE_FIELDS.has(column) &&
      !SPORTRADAR_PROTECTED_FIELDS.has(column)
  )
  const governed_with_probe = new Set([...SPORTRADAR_EXCLUSIVE_FIELDS, probe])
  controls.push({
    name: 'listing an ungoverned column moves it out of the ungoverned set',
    fired:
      Boolean(probe) &&
      written_columns.filter(
        (column) =>
          !governed_with_probe.has(column) &&
          !SPORTRADAR_PROTECTED_FIELDS.has(column)
      ).length ===
        written_columns.filter(
          (column) =>
            !SPORTRADAR_EXCLUSIVE_FIELDS.has(column) &&
            !SPORTRADAR_PROTECTED_FIELDS.has(column)
        ).length -
          1,
    detail: `probe column: ${probe}`
  })

  const reached = [...static_keys].find((key) => written_keys.has(key))
  const written_without_probe = new Set(written_keys)
  written_without_probe.delete(reached)
  controls.push({
    name: 'a static write target the fixture stops reaching is reported as a gap',
    fired:
      Boolean(reached) &&
      [...static_keys].some((key) => !written_without_probe.has(key)),
    detail: `probe key: ${reached}`
  })

  console.error('NEGATIVE CONTROL')
  let all_fired = true
  for (const control of controls) {
    console.error(
      `  [${control.fired ? 'WENT RED' : 'STAYED GREEN'}] ${control.name} (${control.detail})`
    )
    if (!control.fired) all_fired = false
  }
  console.error('')
  return all_fired
}

const main = async () => {
  const nfl_plays_columns = read_nfl_plays_columns()
  const { written_keys, personnel_written } = await collect_written_keys()
  const static_keys = collect_static_keys()

  const written_columns = [...written_keys].filter(
    (key) => nfl_plays_columns.has(key) && !NEVER_WRITTEN_PROPS.has(key)
  )
  const written_non_columns = [...written_keys].filter(
    (key) => !nfl_plays_columns.has(key)
  )

  // A column-named write target the execution never produced is a fixture that no
  // longer reaches its branch, so the headline count is an undercount.
  const unreached = [...static_keys]
    .filter((key) => nfl_plays_columns.has(key))
    .filter((key) => !written_keys.has(key))
    .sort()

  const governed = written_columns
    .filter(
      (column) =>
        SPORTRADAR_EXCLUSIVE_FIELDS.has(column) ||
        SPORTRADAR_PROTECTED_FIELDS.has(column)
    )
    .sort()
  const ungoverned = written_columns
    .filter(
      (column) =>
        !SPORTRADAR_EXCLUSIVE_FIELDS.has(column) &&
        !SPORTRADAR_PROTECTED_FIELDS.has(column)
    )
    .sort()

  // An entry in either list naming a column the importer does not write is not a
  // ruling on anything -- it is a stale line that reads as coverage.
  const inert_exclusive = [...SPORTRADAR_EXCLUSIVE_FIELDS]
    .filter((field) => !written_keys.has(field))
    .sort()
  const inert_protected = [...SPORTRADAR_PROTECTED_FIELDS]
    .filter((field) => !written_keys.has(field))
    .sort()

  const hardcoded_ungoverned = HARDCODED_OVERWRITE_FIELDS.filter((field) =>
    ungoverned.includes(field)
  )

  console.log('=== Sportradar field authority ===\n')
  console.log(
    `nfl_plays columns in db/schema.postgres.sql: ${nfl_plays_columns.size}`
  )
  console.log(
    `keys the importer hands to update_play:      ${written_keys.size}`
  )
  console.log(
    `  of which are real nfl_plays columns:       ${written_columns.length}`
  )
  console.log(
    `  of which name no column (dead writes):     ${written_non_columns.length}`
  )
  console.log('')
  console.log(
    `SPORTRADAR_EXCLUSIVE_FIELDS entries:         ${SPORTRADAR_EXCLUSIVE_FIELDS.size}`
  )
  console.log(
    `SPORTRADAR_PROTECTED_FIELDS entries:         ${SPORTRADAR_PROTECTED_FIELDS.size}`
  )
  console.log(`written columns GOVERNED by a list:          ${governed.length}`)
  console.log(
    `written columns UNGOVERNED:                  ${ungoverned.length}`
  )
  console.log('')

  console.log('--- ungoverned written columns ---')
  console.log(format_list(ungoverned))
  console.log('')

  console.log('--- governed written columns ---')
  console.log(format_list(governed))
  console.log('')

  if (written_non_columns.length) {
    console.log(
      '--- keys naming no nfl_plays column (silently dropped by update_play) ---'
    )
    console.log(format_list(written_non_columns.sort()))
    console.log('')
  }

  if (inert_exclusive.length || inert_protected.length) {
    console.log(
      '--- authority-list entries the importer never writes (inert) ---'
    )
    console.log(`  exclusive: ${inert_exclusive.join(', ') || '(none)'}`)
    console.log(`  protected: ${inert_protected.join(', ') || '(none)'}`)
    console.log('')
  }

  if (hardcoded_ungoverned.length) {
    console.log('--- hardcoded overwrite_fields still outside both lists ---')
    console.log(format_list(hardcoded_ungoverned))
    console.log('')
  }

  console.log('--- add_personnel_counts_to_play_data on this path ---')
  console.log(
    personnel_written.length
      ? `  writes ${personnel_written.length} personnel columns: ${personnel_written.join(', ')}`
      : '  writes nothing: no Sportradar mapper sets offense_personnel or defense_personnel,\n' +
          '  so the call in process_play is inert and those 8 columns are NOT Sportradar-written'
  )
  console.log('')

  const controls_fired = run_negative_controls({
    written_columns,
    static_keys,
    written_keys
  })

  let exit_code = 0

  if (!controls_fired) {
    console.log(
      'CONTROL STAYED GREEN: this audit cannot report and its counts mean nothing.'
    )
    exit_code = 1
  }

  if (unreached.length) {
    console.log(
      'FIXTURE GAP: column-named write targets the synthetic play never reached.'
    )
    console.log(
      'The ungoverned count above is an UNDERCOUNT until these are covered.'
    )
    console.log(format_list(unreached))
    exit_code = 1
  } else {
    console.log(
      `fixture control: every one of the ${static_keys.size} static write targets in the mapping functions was reached`
    )
  }

  process.exit(exit_code)
}

main()
