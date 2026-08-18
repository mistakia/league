/*
  Repairs CORE-KNOX-044391 (Corey Knox, RB, Buffalo), flagged NEW by
  db/gates/check-conflated-player-rows.mjs `age` falsifier: nfl_draft_year
  2025 against date_of_birth 1989-10-13 is entry_age 36, outside the
  plausible 20-30 band.

  ## Adjudication

  This is a single-row mint, not a conflation between two rows -- no other
  `corey knox` row exists to confuse it with, and gsis_player_id /
  esb_player_id are both null, so there is no independent NFL identity chain
  to cross-check against (unlike the elder-namesake repairs in
  user:task/league/repair-player-creation-pipeline.md, which had a gsis id on
  our own row to key nflverse players.csv against). nflverse players.csv (
  data/nfl/players.csv) carries no "Corey Knox" at any birth date.

  Sleeper's own /players/nfl/2933 record is internally self-contradictory: it
  reports birth_date 1989-10-13 (age 36) AND metadata.rookie_year "2025" on
  the SAME record, with team null and gsis_id null. That is the source of the
  bad value, not a matching error on our side -- the importer wrote exactly
  what Sleeper served. There is no oracle establishing what nfl_draft_year
  SHOULD be, so it is cleared rather than replaced with a guess. The rest of
  the row (name, college, position, physical measurables, sportradar/
  fantasy_data ids) is left standing since nothing contradicts it.

  Verified: no other `formatted_name = 'corey knox'` row exists in `player`;
  no prior player_changelog entry for this pid (it was minted with none).
*/

import db from '#db'
import { record_changelog } from '#libs-server'

const SOURCE = 'adhoc/2026-08-18-clear-corey-knox-implausible-draft-year'
const PID = 'CORE-KNOX-044391'

const main = async () => {
  const player_row = await db('player').where({ pid: PID }).first()
  if (!player_row) {
    console.log(`SKIP ${PID}: no such row`)
    await db.destroy()
    process.exit(0)
  }

  // nfl_draft_year is not in updatePlayer's nullable_props, so it is cleared
  // by direct statement plus an explicit changelog row -- same shape as the
  // sleeper_player_id clears in 2026-08-17-apply-adjudicated-player-identity-repairs.mjs.
  const updated = await db('player')
    .where({ pid: PID, nfl_draft_year: player_row.nfl_draft_year })
    .update({ nfl_draft_year: null })

  if (!updated) {
    console.log(`SKIP ${PID}: nfl_draft_year changed under us`)
    await db.destroy()
    process.exit(1)
  }

  await record_changelog({
    table: 'player_changelog',
    rows: {
      pid: PID,
      column_name: 'nfl_draft_year',
      previous_value: String(player_row.nfl_draft_year),
      new_value: null,
      source: SOURCE,
      reason:
        'Sleeper /players/nfl/2933 reports birth_date 1989-10-13 (age 36) and metadata.rookie_year 2025 on the same record -- internally implausible and uncorroborated by nflverse (no Corey Knox in players.csv) or a gsis/esb id. Cleared rather than replaced: no oracle establishes the true value.',
      changed_at: new Date()
    }
  })

  console.log(
    `CLEARED ${PID} nfl_draft_year ${player_row.nfl_draft_year} -> null`
  )
  await db.destroy()
  process.exit(0)
}

main()
