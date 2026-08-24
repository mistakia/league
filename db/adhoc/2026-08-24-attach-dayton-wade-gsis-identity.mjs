/*
  Attaches gsis id 00-0039259 and its identifier set to DAYT-WADE-006551
  (Dayton Wade, WR), the single `review_name_only_match` the identity repair
  held back.

  ## Why this is a one-off rather than a classifier rule

  `repair-missing-player-gsis-ids` routes this id to `review_name_only_match`
  and writes nothing, which is correct: a name-only match is exactly the
  evidence class the operator ruling excludes from mechanical adjudication, and
  loosening that rule to catch this row would re-open the hazard that produced
  70 duplicate mints. So the classifier stays as it is and this row is
  adjudicated by hand, once, with the evidence recorded.

  ## Adjudication

  The feed record (nflverse plus NFL Pro) and the incumbent row agree on every
  independent field, and NOTHING contradicts them:

    name          Dayton Wade          = Dayton Wade
    position      WR                   = WR
    college       Mississippi          = Ole Miss (the same school)
    height        69 inches            = 69 inches
    weight        184                  ~ 176 (weight varies by listing)
    draft year    first_season 2024    = nfl_draft_year 2024

  The incumbent holds ZERO external identifiers -- no gsis, esb, pfr, smart or
  gsis_it -- which is precisely why both identifier rungs were blind to it, the
  same shape as the 70 duplicates. It was invisible to the third rung (short
  name plus exact date of birth) for a separate reason: the row carries the
  `0000-00-00` sentinel instead of a birth date, and that rung excludes the
  sentinel by construction.

  No competing row holds any of the five identifiers -- asserted below rather
  than asserted here, because a cross-row uniqueness violation is the one way
  this write could corrupt an unrelated player.

  The birth date is written too, replacing the sentinel with the feed's real
  2000-09-08. That is the same direction of travel as the rest of this task:
  the sentinel reads as data and is the one value the repair may not leave
  standing once a real date is known.
*/

import db from '#db'
import { updatePlayer } from '#libs-server'

const SOURCE = 'adhoc/2026-08-24-attach-dayton-wade-gsis-identity'
const PID = 'DAYT-WADE-006551'

const IDENTIFIERS = {
  gsis_player_id: '00-0039259',
  esb_player_id: 'WAD341130',
  pfr_player_id: 'WadeDa00',
  smart_player_id: '32005741-4434-1130-4e11-cc97c4613382',
  gsis_it_player_id: '57403'
}

const main = async () => {
  const player_row = await db('player').where({ pid: PID }).first()
  if (!player_row) {
    console.log(`SKIP ${PID}: no such row`)
    await db.destroy()
    process.exit(1)
  }

  // The cross-row uniqueness gate. Any of these five landing on a row that is
  // not this one means the adjudication is wrong about who this person is, and
  // writing would put one person's identifier on another's row.
  for (const [column, value] of Object.entries(IDENTIFIERS)) {
    const holders = await db('player')
      .where(column, value)
      .whereNot('pid', PID)
      .select('pid')
    if (holders.length) {
      console.log(
        `REFUSING: ${column}=${value} is already held by ${holders.map((row) => row.pid).join(', ')}`
      )
      await db.destroy()
      process.exit(1)
    }
  }

  const update = {}
  for (const [column, value] of Object.entries(IDENTIFIERS)) {
    if (!player_row[column]) update[column] = value
  }
  if (player_row.date_of_birth === '0000-00-00' || !player_row.date_of_birth) {
    update.date_of_birth = '2000-09-08'
  }

  if (!Object.keys(update).length) {
    console.log(`SKIP ${PID}: already holds every value this would write`)
    await db.destroy()
    process.exit(0)
  }

  const changes = await updatePlayer({
    player_row,
    update,
    allow_protected_props: true,
    source: SOURCE,
    reason:
      'identity repair: gsis id 00-0039259 attached to the sole name-only match, adjudicated by hand on agreeing name, position, college, height and draft year against an incumbent holding no external identifiers'
  })

  console.log(
    `${PID}: ${changes} field(s) written — ${Object.keys(update).join(', ')}`
  )

  await db.destroy()
  process.exit(0)
}

main()
