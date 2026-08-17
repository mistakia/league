import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import is_main from './is-main.mjs'
import db from '#db'
import updatePlayer from './update-player.mjs'

const log = debug('set-player-field-override')
if (!process.env.DEBUG) {
  debug.enable('set-player-field-override')
}

/**
 * Record a human verdict about one (pid, column_name) and apply it, as ONE
 * operation.
 *
 * Declaring and applying are deliberately inseparable. If they were two calls
 * the table could accumulate verdicts nobody ever attempted to write -- which is
 * the original defect (a correction recorded in prose and never applied,
 * undetected for months) reintroduced one layer up. Here the only way to
 * declare is to also attempt the write.
 *
 * The write goes THROUGH updatePlayer rather than around it, so the
 * player_changelog entry appears the way every other change does and the trail
 * stays in one place. The override row is upserted FIRST, because updatePlayer's
 * veto reads this table: without the row present the class guards would refuse
 * exactly the writes an override exists to admit.
 *
 * A refused apply is NOT rolled back. The declaration persists so the
 * player-field-override-drift check can see the gap -- that check, not this
 * function's return value, is the durable oracle, because it catches an
 * importer forcing the field back and a hand-written UPDATE identically.
 */
export const set_player_field_override = async ({
  pid,
  column_name,
  override_value = null,
  provider_name,
  adjudicated_by,
  adjudicated_at = new Date(),
  evidence_source,
  reason
}) => {
  if (!pid) {
    throw new Error('set_player_field_override: pid is required')
  }
  if (!column_name) {
    throw new Error('set_player_field_override: column_name is required')
  }

  // Provenance is mandatory at write time, the way updatePlayer already rejects
  // a changelog write with no source. Every field is named individually because
  // "provenance missing" sends the caller looking through four possibilities.
  const required_provenance = {
    provider_name,
    adjudicated_by,
    evidence_source,
    reason
  }
  for (const [field, value] of Object.entries(required_provenance)) {
    if (typeof value !== 'string' || !value.trim()) {
      throw new Error(
        `set_player_field_override: ${field} is required and must be non-empty -- an override with no evidence is the unattributable correction this table exists to prevent (pid ${pid}, column ${column_name})`
      )
    }
  }

  const player_rows = await db('player').where({ pid })
  const player_row = player_rows[0]
  if (!player_row) {
    throw new Error(`set_player_field_override: no player row for pid ${pid}`)
  }

  // A column that is not on `player` can never reconcile, so it would sit in the
  // table as a permanent finding nobody can repair. Checked against the fetched
  // row rather than information_schema: the row is already in hand, and it is
  // the same object updatePlayer will diff against.
  if (!Object.prototype.hasOwnProperty.call(player_row, column_name)) {
    throw new Error(
      `set_player_field_override: player has no column '${column_name}'`
    )
  }

  // Mirrors excluded_props in update-player.mjs and the CHECK constraint on the
  // table. Refused here as well so the caller gets a sentence rather than a
  // constraint violation.
  if (['pid', 'formatted_name'].includes(column_name)) {
    throw new Error(
      `set_player_field_override: '${column_name}' cannot be adjudicated -- it is the row's own key or is derived, not learned from a provider`
    )
  }

  await db('player_field_override')
    .insert({
      pid,
      column_name,
      override_value,
      provider_name,
      adjudicated_by,
      adjudicated_at,
      evidence_source,
      reason
    })
    .onConflict(['pid', 'column_name'])
    .merge()

  const changes = await updatePlayer({
    pid,
    update: { [column_name]: override_value },
    source: 'player-field-override',
    reason
  })

  // Read back rather than trusting the change count. A count of zero is
  // ambiguous by design -- it means either "already correct" or "refused" -- and
  // conflating those is how a write claimed as applied went unnoticed.
  const [updated_row] = await db('player').where({ pid })
  const live_value = updated_row[column_name]
  const is_applied =
    (live_value == null && override_value == null) ||
    (live_value != null &&
      override_value != null &&
      String(live_value) === String(override_value))

  if (is_applied) {
    log(
      `override applied: ${pid}.${column_name} = ${JSON.stringify(override_value)} (${changes} change${changes === 1 ? '' : 's'})`
    )
  } else {
    log(
      `OVERRIDE DECLARED BUT NOT APPLIED: ${pid}.${column_name} holds ${JSON.stringify(live_value)}, override declares ${JSON.stringify(override_value)}. The declaration is kept so player-field-override-drift reports it. The usual cause is the cross-row uniqueness guard on an external id -- clear the value from the row that wrongly holds it first.`
    )
  }

  return { is_applied, changes, live_value, override_value }
}

export default set_player_field_override

const initialize_cli = () =>
  yargs(hideBin(process.argv))
    .option('pid', { type: 'string', demandOption: true })
    .option('column_name', { type: 'string', demandOption: true })
    .option('override_value', {
      type: 'string',
      describe: 'omit to adjudicate the field EMPTY (a clear)'
    })
    .option('provider_name', {
      type: 'string',
      demandOption: true,
      describe: 'the provider being overridden, e.g. sleeper'
    })
    .option('adjudicated_by', { type: 'string', demandOption: true })
    .option('evidence_source', {
      type: 'string',
      demandOption: true,
      describe: 'the independent evidence, not the provider that was wrong'
    })
    .option('reason', { type: 'string', demandOption: true })
    .help().argv

/**
 * Example:
 *   node libs-server/set-player-field-override.mjs \
 *     --pid JORD-MURR-006621 --column_name sleeper_player_id \
 *     --override_value 11493 --provider_name sleeper \
 *     --adjudicated_by operator \
 *     --evidence_source 'nflverse gsis 00-0038999; ESPN athlete 4368172' \
 *     --reason 'row held 8106, the North Texas OT'
 */
const main = async () => {
  try {
    const argv = initialize_cli()
    const result = await set_player_field_override({
      pid: argv.pid,
      column_name: argv.column_name,
      override_value:
        argv.override_value === undefined ? null : argv.override_value,
      provider_name: argv.provider_name,
      adjudicated_by: argv.adjudicated_by,
      evidence_source: argv.evidence_source,
      reason: argv.reason
    })
    // A refusal exits non-zero. It is a real failure of the operator's
    // intent, and an exit 0 here is the shape that let a never-applied write be
    // recorded as done.
    process.exit(result.is_applied ? 0 : 1)
  } catch (error) {
    log(error)
    process.exit(1)
  }
}

if (is_main(import.meta.url)) {
  main()
}
