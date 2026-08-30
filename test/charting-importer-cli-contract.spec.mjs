/* global describe, it */
import fs from 'fs'
import path from 'path'
import * as chai from 'chai'
import yargs from 'yargs'

const expect = chai.expect

// Three of the four charting importers declared `--seas_type` and then read
// `argv.season_type`. yargs never sets that key, so the flag parsed cleanly,
// was dropped, and every invocation silently used the default scope --
// including the matchup importer, whose own comment tells a reader to ask for
// preseason with `--seas_type PRE`. That instruction never worked.
//
// It is the same defect class as the `qtr` / `dwn` keys find_play used to
// accept: a name the receiver does not read, dropped in silence, with no error
// and no failing test. The alias closes it by making yargs populate both keys.
//
// This spec is a SOURCE check on purpose. Each script's option list lives
// inside an is_main-guarded main(), so importing the module does not build the
// parser and there is nothing to interrogate at runtime. Reading the declared
// option names and the argv keys the same file consumes is the only way to
// compare the two halves without executing the CLI.
const CHARTING_IMPORTERS = [
  'scripts/import-plays-charting.mjs',
  'scripts/import-matchup-stats-charting.mjs',
  'scripts/import-players-charting.mjs',
  'scripts/import-player-plays-charting.mjs'
]

const read_script = (relative_path) =>
  fs.readFileSync(path.join(process.cwd(), relative_path), 'utf8')

describe('SCRIPTS charting importer CLI contract', function () {
  // The behavioural half: prove yargs really does populate both keys, so the
  // source check below is asserting something true rather than a convention.
  it('populates both spellings through the alias', function () {
    const build = (args) =>
      yargs(args)
        .option('seas_type', { type: 'string', alias: 'season_type' })
        .parseSync()

    expect(build(['--seas_type', 'PRE']).season_type).to.equal('PRE')
    expect(build(['--season_type', 'POST']).seas_type).to.equal('POST')
    expect(build([]).season_type).to.equal(undefined)
  })

  // The control that the defect was real: without the alias, the key the
  // scripts read is undefined. If this ever starts passing, yargs changed its
  // behaviour and the alias may no longer be load-bearing.
  it('drops the key the scripts read when the alias is absent', function () {
    const argv = yargs(['--seas_type', 'PRE'])
      .option('seas_type', { type: 'string' })
      .parseSync()

    expect(argv.seas_type).to.equal('PRE')
    expect(argv.season_type).to.equal(undefined)
  })

  for (const relative_path of CHARTING_IMPORTERS) {
    it(`${relative_path} reads only argv keys it declares`, function () {
      const source = read_script(relative_path)

      const declared = new Set()
      for (const match of source.matchAll(/\.option\('([a-z_]+)'/g)) {
        declared.add(match[1])
      }
      for (const match of source.matchAll(/alias: '([a-z_]+)'/g)) {
        declared.add(match[1])
      }

      // yargs supplies these itself.
      declared.add('_')
      declared.add('$0')

      const consumed = new Set(
        [...source.matchAll(/argv\.([a-zA-Z_]+)/g)].map((match) => match[1])
      )

      const unbacked = [...consumed].filter((key) => !declared.has(key))
      expect(
        unbacked,
        `argv keys with no declared option: ${unbacked}`
      ).to.deep.equal([])
    })
  }
})
