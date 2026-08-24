/*
  Two of the three rows whose draft age reads 35 or older. Both hold a
  historical namesake's BIRTH DATE, which is the opposite orientation to the
  negative-age class repaired in
  `2026-08-24-clear-namesake-draft-identity.mjs`: there the draft year was the
  graft and the birth date was sound.

  The third, `TYRO-WHEA-027188`, is deliberately NOT here. That row fuses two
  people's GAMELOGS -- 70 from 2000-2004 with the Raiders belonging to Tyrone
  Wheatley Sr, and 40 from 2022-2025 belonging to Tyrone Wheatley Jr -- so it
  needs rows re-attributed, not fields corrected. Moving gamelogs between people
  is the operation that deleted 450 real rows on 2026-08-04, and it is a
  separate, operator-gated exercise.

  ## MICH-YOUN-003774 -- clear the birth date

  The row is the modern Michael Young: Cincinnati, first season 2022, gsis
  `00-0037409`, one 2022 gamelog. Its birth date 1962-02-21 is an EXACT match to
  PFR's Mike Young (YounMi00), the WR taken by the Rams in the sixth round of
  1985 out of UCLA, who is a different person entirely.

  Null rather than the real date: PFR does not list the modern player, so we do
  not have his birth date, and inventing one is how this class is made.

  ## BRIA-SMIT-019225 + BRIA-SMIT-002149 -- one person, two rows

  PFR's Brian Smith (SmitBr02) is a Notre Dame linebacker born January 8, 1989.

    BRIA-SMIT-019225  Notre Dame, pfr SmitBr02, 2 gamelogs, born 1973-11-21 (wrong)
    BRIA-SMIT-002149  gsis 00-0028695, esb SMI082550, born 1989-01-08 (PFR's date)

  Same person, same 2011 entry, same position. The halves are complementary:
  one has the college and the pfr id, the other has the identifiers and the
  right birth date.

  `BRIA-SMIT-019225` survives because it holds the gamelogs. The birth date is
  then written EXPLICITLY after the merge rather than left to
  `merge_player_row_fields`, whose tie-break between two equal-length date
  strings would decide it by argument order -- correct here by accident, which
  is not a property worth depending on.
*/

import db from '#db'
import { updatePlayer } from '#libs-server'
import mergePlayer from '#libs-server/merge-player.mjs'
import set_player_field_override from '#libs-server/set-player-field-override.mjs'

const SOURCE = 'adhoc/2026-08-24-correct-implausible-draft-age-identities'
const adjudicated_by = 'operator (approved 2026-08-24)'

const YOUNG_PID = 'MICH-YOUN-003774'
const SMITH_SURVIVOR = 'BRIA-SMIT-019225'
const SMITH_FOLDED = 'BRIA-SMIT-002149'
const SMITH_BIRTH_DATE = '1989-01-08'

const assert_row = (row, expected, pid) => {
  for (const [column, value] of Object.entries(expected)) {
    if (row[column] !== value) {
      throw new Error(
        `REFUSING: ${pid}.${column} expected ${JSON.stringify(value)}, found ${JSON.stringify(row[column])} -- the adjudication no longer describes this row`
      )
    }
  }
}

const main = async () => {
  // --- Michael Young -------------------------------------------------------
  const young_row = await db('player').where({ pid: YOUNG_PID }).first()
  if (!young_row) throw new Error(`no row for ${YOUNG_PID}`)
  assert_row(
    young_row,
    {
      date_of_birth: '1962-02-21',
      nfl_draft_year: 2022,
      college: 'Cincinnati',
      gsis_player_id: '00-0037409'
    },
    YOUNG_PID
  )

  await set_player_field_override({
    pid: YOUNG_PID,
    column_name: 'date_of_birth',
    override_value: null,
    provider_name: 'nflverse',
    adjudicated_by,
    evidence_source:
      'pro-football-reference.com Mike Young (YounMi00), born February 21, 1962, Rams 1985 round 6 -- an exact match to the date this row carries, and a different person',
    reason:
      'identity repair: 1962-02-21 belongs to the 1985 Rams WR Mike Young. This row is the modern Michael Young out of Cincinnati, first season 2022, and a 60-year-old rookie is impossible.'
  })
  console.log(`${YOUNG_PID}: date_of_birth cleared (was 1962-02-21)`)

  // --- Brian Smith ---------------------------------------------------------
  const smith_survivor = await db('player')
    .where({ pid: SMITH_SURVIVOR })
    .first()
  const smith_folded = await db('player').where({ pid: SMITH_FOLDED }).first()

  if (!smith_survivor || !smith_folded) {
    console.log('SKIP Brian Smith: one or both rows are already gone')
    await db.destroy()
    process.exit(0)
  }

  assert_row(
    smith_survivor,
    {
      date_of_birth: '1973-11-21',
      college: 'Notre Dame',
      pfr_player_id: 'SmitBr02',
      nfl_draft_year: 2011
    },
    SMITH_SURVIVOR
  )
  assert_row(
    smith_folded,
    {
      date_of_birth: SMITH_BIRTH_DATE,
      gsis_player_id: '00-0028695',
      nfl_draft_year: 2011
    },
    SMITH_FOLDED
  )

  await mergePlayer({
    update_player_row: smith_survivor,
    remove_player_row: smith_folded
  })
  console.log(`merged ${SMITH_FOLDED} into ${SMITH_SURVIVOR}`)

  // Explicit, not left to the merge's equal-length tie-break.
  const merged_smith = await db('player').where({ pid: SMITH_SURVIVOR }).first()
  if (merged_smith.date_of_birth !== SMITH_BIRTH_DATE) {
    const changes = await updatePlayer({
      player_row: merged_smith,
      update: { date_of_birth: SMITH_BIRTH_DATE },
      source: SOURCE,
      reason:
        'identity repair: PFR SmitBr02 gives January 8, 1989 for this Notre Dame linebacker; 1973-11-21 belonged to a namesake'
    })
    console.log(
      `${SMITH_SURVIVOR}: date_of_birth corrected to ${SMITH_BIRTH_DATE} (${changes} field)`
    )
  } else {
    console.log(
      `${SMITH_SURVIVOR}: date_of_birth already ${SMITH_BIRTH_DATE} after the merge`
    )
  }

  const final_smith = await db('player').where({ pid: SMITH_SURVIVOR }).first()
  console.log(
    `\nfinal: ${final_smith.first_name} ${final_smith.last_name} ${final_smith.primary_position} dob=${final_smith.date_of_birth} college=${final_smith.college} gsis=${final_smith.gsis_player_id} esb=${final_smith.esb_player_id} pfr=${final_smith.pfr_player_id}`
  )

  await db.destroy()
  process.exit(0)
}

main()
