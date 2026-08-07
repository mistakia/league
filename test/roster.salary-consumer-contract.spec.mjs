/* global describe it before */

// The roster-player salary is named `player_salary` everywhere: the
// `transactions` column, the `Roster` constructor's input rows, and the shape
// `Roster` hands back from `.get()`, `.all`, `.active`, and `.players`. A
// consumer that reads `.value` off one of those gets `undefined`, and any sum
// over it collapses to `NaN`.
//
// That failure is invisible to the rest of the suite. `72346e579` renamed the
// column, `8643dc8a7` renamed the in-memory field across 31 files, and the full
// suite was green at 3304 passing with four live `.value` reads still in the
// tree -- the cutlist's freed cap space, the restricted-free-agency dialog's max
// bid, the settings roster list, and the salary-cap violation detail line. None
// of the four has a behavioral spec, and none can easily get one: two are JSX
// components, `app/core/selectors.js` imports through webpack's `@libs-shared`
// alias, and the script's read is inside a log line. All three are unreachable
// from mocha, which is why the defect class survived a green suite.
//
// So this spec checks the source rather than the behavior. It resolves which
// local bindings hold a roster player -- from `roster.get(pid)`, from a roster
// collection getter, and through the iteration and callback forms that carry
// one -- and fails on a `.value` read off any of them. That is the whole defect
// class in one assertion, and it reaches the consumers no import can.
//
// Deliberately name-anchored on the roster, not on `.value`: `value` is a
// common property and grepping it is useless, which is the argument the rename
// exists to settle. Only reads off a binding traced to a `Roster` count.

import * as chai from 'chai'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { parseSync, traverse } from '@babel/core'

import { Roster } from '#libs-shared'
import { roster_slot_types } from '#constants'

const expect = chai.expect
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

// Directories holding roster consumers. `app` covers the selectors and the two
// components, `scripts` the cap-violation check.
const SCAN_DIRS = [
  'app',
  'scripts',
  'libs-server',
  'libs-shared',
  'api',
  'jobs'
]
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', 'coverage'])

// `Roster` getters returning an array of roster players.
const ROSTER_COLLECTIONS = new Set([
  'all',
  'active',
  'players',
  'starters',
  'bench',
  'reserve',
  'practice',
  'practice_signed',
  'practice_drafted',
  'reserve_short_term_players',
  'reserve_long_term_players',
  'roster_players_for_position_limits'
])

// Array methods whose first parameter is an element of the receiver.
const ELEMENT_FIRST_METHODS = new Set([
  'map',
  'filter',
  'forEach',
  'find',
  'findIndex',
  'some',
  'every',
  'flatMap'
])

const collect_source_files = (dir, out = []) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) collect_source_files(full, out)
    } else if (/\.(js|mjs)$/.test(entry.name)) {
      out.push(full)
    }
  }
  return out
}

// A `Roster` instance is always reached through something spelled `roster`:
// the bare local in `selectors.js`, `team.roster` in the components, the
// `roster` prop in settings. Anchor on that rather than on the property read.
const is_roster_object = (node) => {
  if (!node) return false
  if (node.type === 'Identifier') return /^_?roster$/i.test(node.name)
  if (node.type === 'MemberExpression' && node.property.type === 'Identifier') {
    return /^_?roster$/i.test(node.property.name)
  }
  return false
}

// roster.get(pid) -- one roster player
const is_roster_get_call = (node) =>
  node?.type === 'CallExpression' &&
  node.callee.type === 'MemberExpression' &&
  node.callee.property.type === 'Identifier' &&
  node.callee.property.name === 'get' &&
  is_roster_object(node.callee.object)

// roster.all / roster.active / roster.players -- an array of roster players
const is_roster_collection = (node) =>
  node?.type === 'MemberExpression' &&
  node.property.type === 'Identifier' &&
  ROSTER_COLLECTIONS.has(node.property.name) &&
  is_roster_object(node.object)

const parse_source = (file, code) => {
  try {
    return parseSync(code, {
      filename: file,
      configFile: false,
      babelrc: false,
      sourceType: 'module',
      presets: [['@babel/preset-react', { runtime: 'classic' }]],
      plugins: [['@babel/plugin-proposal-class-properties', { loose: true }]]
    })
  } catch {
    // A file this parser cannot read is not a file this check can judge. The
    // build and lint both cover syntax; silence here would only hide a parse
    // regression, so surface it as a skipped file rather than a pass.
    return null
  }
}

const find_roster_value_reads = (file, ast) => {
  const players = new Set() // bindings holding one roster player
  const arrays = new Set() // bindings holding an array of roster players

  // Two passes, because a binding can be introduced after a use site inside a
  // hoisted arrow or a later method chain. The second pass sees everything the
  // first resolved; a third would add nothing, since the sets only grow through
  // one level of aliasing per pass and the sources here alias at most once.
  const resolve_bindings = () => {
    traverse(ast, {
      VariableDeclarator(node_path) {
        const { id, init } = node_path.node
        if (id.type !== 'Identifier' || !init) return
        if (is_roster_get_call(init)) {
          players.add(id.name)
        } else if (is_roster_collection(init)) {
          arrays.add(id.name)
        } else if (init.type === 'Identifier' && arrays.has(init.name)) {
          arrays.add(id.name)
        }
      },

      // for (const p of roster.active)
      // for (const [index, p] of roster.all.entries())
      ForOfStatement(node_path) {
        const { left, right } = node_path.node
        let source = right
        if (
          source.type === 'CallExpression' &&
          source.callee.type === 'MemberExpression' &&
          source.callee.property.type === 'Identifier' &&
          source.callee.property.name === 'entries'
        ) {
          source = source.callee.object
        }
        const from_roster =
          is_roster_collection(source) ||
          (source.type === 'Identifier' && arrays.has(source.name))
        if (!from_roster) return

        const target =
          left.type === 'VariableDeclaration' ? left.declarations[0].id : left
        if (target.type === 'Identifier') {
          players.add(target.name)
        } else if (target.type === 'ArrayPattern') {
          // `[index, player]` -- the index is harmless in the set, since a
          // `.value` read off a number is not a shape this check can see.
          for (const element of target.elements) {
            if (element?.type === 'Identifier') players.add(element.name)
          }
        }
      },

      // roster.active.reduce((sum, player) => ...)
      // roster.all.map((player) => ...)
      CallExpression(node_path) {
        const { callee, arguments: args } = node_path.node
        if (
          callee.type !== 'MemberExpression' ||
          callee.property.type !== 'Identifier'
        ) {
          return
        }
        const method = callee.property.name
        const source = callee.object
        const from_roster =
          is_roster_collection(source) ||
          (source.type === 'Identifier' && arrays.has(source.name))
        if (!from_roster) return

        const is_reduce = method === 'reduce' || method === 'reduceRight'
        if (!is_reduce && !ELEMENT_FIRST_METHODS.has(method)) return

        const callback = args[0]
        if (
          callback?.type !== 'ArrowFunctionExpression' &&
          callback?.type !== 'FunctionExpression'
        ) {
          return
        }
        // reduce's element is the second parameter, everything else's the first.
        const element_param = callback.params[is_reduce ? 1 : 0]
        if (element_param?.type === 'Identifier')
          players.add(element_param.name)
      }
    })
  }

  resolve_bindings()
  resolve_bindings()

  const findings = []
  traverse(ast, {
    MemberExpression(node_path) {
      const { object, property, computed } = node_path.node
      if (computed || property.type !== 'Identifier') return
      if (property.name !== 'value') return
      if (object.type !== 'Identifier' || !players.has(object.name)) return

      findings.push(
        `${path.relative(ROOT, file)}:${node_path.node.loc.start.line} ` +
          `reads \`${object.name}.value\` off a Roster player (expected \`player_salary\`)`
      )
    }
  })
  return findings
}

describe('roster salary consumer contract', function () {
  // Parsing every source file under app/ with JSX support is the cost here,
  // and it is well past mocha's default budget.
  this.timeout(120 * 1000)

  describe('source scan', function () {
    const findings = []
    let files_scanned = 0
    const files_unparsed = []

    before(function () {
      for (const dir of SCAN_DIRS) {
        const full_dir = path.join(ROOT, dir)
        if (!fs.existsSync(full_dir)) continue
        for (const file of collect_source_files(full_dir)) {
          const ast = parse_source(file, fs.readFileSync(file, 'utf8'))
          if (!ast) {
            files_unparsed.push(path.relative(ROOT, file))
            continue
          }
          files_scanned += 1
          findings.push(...find_roster_value_reads(file, ast))
        }
      }
    })

    it('scans the roster consumer surface', function () {
      // Guards the scan itself: a resolution change that walked zero files
      // would otherwise make the check below pass vacuously forever.
      expect(files_scanned).to.be.greaterThan(500)
      expect(files_unparsed).to.deep.equal([])
    })

    it('no consumer reads `.value` off a Roster player', function () {
      expect(findings).to.deep.equal([])
    })
  })

  // The premise of the scan above: `Roster` really does expose `player_salary`
  // and really does not expose `value`. Cheap to pin, and it is what makes a
  // `.value` read a defect rather than a style preference.
  describe('Roster player shape', function () {
    // `ext_date` in the past puts the roster on the recorded-salary basis, so
    // the arithmetic below is the stored salary rather than extension pricing.
    // That is the basis the four consumers read; extension pricing has its own
    // coverage in libs-shared.get-extension-amount.spec.mjs.
    const league = {
      ext_date: new Date(1577854800 * 1000), // 2020-01-01
      cap: 200,
      num_teams: 12,
      sqb: 1,
      srb: 2,
      swr: 2,
      ste: 1,
      sk: 1,
      sdst: 1,
      sflex: 1,
      bench: 7,
      ps: 4,
      practice_squad_slot_count: 4,
      reserve_short_term_limit: 3,
      max_roster_qb: 4
    }

    const build_roster = () =>
      new Roster({
        roster: {
          uid: 1,
          tid: 1,
          lid: 1,
          week: 0,
          season_year: 2026,
          players: [
            {
              slot: roster_slot_types.QB,
              pid: 'QB-1',
              pos: 'QB',
              player_salary: 34
            },
            {
              slot: roster_slot_types.BENCH,
              pid: 'QB-2',
              pos: 'QB',
              player_salary: 11
            },
            {
              slot: roster_slot_types.PS,
              pid: 'QB-3',
              pos: 'QB',
              player_salary: 1
            }
          ]
        },
        league
      })

    it('exposes player_salary and not value on every collection getter', function () {
      const roster = build_roster()
      const surfaces = [
        ['get', [roster.get('QB-1')]],
        ['all', roster.all],
        ['active', roster.active],
        ['players', roster.players]
      ]

      for (const [name, roster_players] of surfaces) {
        expect(roster_players.length, `${name} is empty`).to.be.greaterThan(0)
        for (const roster_player of roster_players) {
          expect(roster_player, `${name} exposes value`).to.not.have.property(
            'value'
          )
          // `.a('number')` alone would accept NaN, which is the exact value
          // this whole spec exists to catch.
          expect(roster_player, `${name} is missing player_salary`)
            .to.have.property('player_salary')
            .that.is.a('number')
          expect(
            Number.isNaN(roster_player.player_salary),
            `${name} priced a player at NaN`
          ).to.equal(false)
        }
      }
    })

    it('sums an active-slot charge to a number, never NaN', function () {
      const roster = build_roster()
      const total = roster.active.reduce(
        (sum, roster_player) => sum + roster_player.player_salary,
        0
      )
      // QB-1 (34) and QB-2 (11) are active; the practice-squad player is not.
      expect(total).to.equal(45)
      expect(roster.availableCap).to.equal(league.cap - total)
    })
  })
})
