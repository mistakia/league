/*
  `DAVI-JOHN-015871` is Dirk Johnson the punter, recorded under David Johnson's
  name, position and draft year.

  ## The evidence, and why it is not a merge

  The row's own fields already describe Dirk Johnson and nothing else:

    date of birth   1975-06-01        = PFR Dirk Johnson, born June 1, 1975
    college         Northern Colorado = PFR Dirk Johnson
    pfr id          JohnDi20          = PFR Dirk Johnson
    gamelogs        119, 2001-2009    = Dirk Johnson's punting career

  And the ledger agrees on what this person did: gsis `00-0008484` carries 475
  Punt Yards, 145 Punt Inside 20 and 41 Punt (No Return) stat rows. A defensive
  back does not punt 475 times.

  What is grafted on is the OTHER David Johnson -- the cornerback out of
  Kentucky drafted in 1989 -- and he has his own row already, `DAVI-JOHN-008819`,
  born 1966, holding no identifiers and no gamelogs. So there are two people and
  two rows, correctly. Nothing needs merging; one row is simply mislabelled.

  ## What is written

    first_name         David -> Dirk    the name the row's own evidence supports
    primary_position   DB    -> P       what the 661 punting stat rows say
    nfl_draft_year     1989  -> null    belongs to DAVI-JOHN-008819's person

  `short_name` is already `D.Johnson` and stays correct for Dirk, so it is left
  alone. `formatted_name` and `name_search_vector` are NOT maintained by
  updatePlayer (`formatted_name` is in its excluded_props), so they are rebuilt
  here through the same helpers create-player uses -- otherwise the row would
  answer to "david johnson" in search after being renamed.

  The draft year goes through set_player_field_override rather than updatePlayer
  because updatePlayer skips null writes, and because an importer put the value
  there and would put it back.
*/

import db from '#db'
import { updatePlayer } from '#libs-server'
import set_player_field_override from '#libs-server/set-player-field-override.mjs'
import { format_player_name } from '#libs-shared'

const PID = 'DAVI-JOHN-015871'
const SOURCE = 'adhoc/2026-08-24-correct-dirk-johnson-identity'
const REASON =
  'identity repair: this row is Dirk Johnson the punter -- birth date, college, pfr id and 119 gamelogs all match him, and the gsis id carries 661 punting stat rows. The David Johnson name, DB position and 1989 draft year belong to the Kentucky cornerback, who holds his own row DAVI-JOHN-008819.'

const EXPECTED = {
  first_name: 'David',
  primary_position: 'DB',
  nfl_draft_year: 1989,
  pfr_player_id: 'JohnDi20',
  date_of_birth: '1975-06-01'
}

const main = async () => {
  const player_row = await db('player').where({ pid: PID }).first()
  if (!player_row) {
    console.log(`SKIP ${PID}: no such row`)
    await db.destroy()
    process.exit(1)
  }

  // Every field the adjudication rests on, asserted before anything is written.
  // A row that has moved since the survey is a row this verdict no longer
  // describes.
  for (const [column, expected] of Object.entries(EXPECTED)) {
    if (player_row[column] !== expected) {
      console.log(
        `REFUSING: ${column} expected ${JSON.stringify(expected)}, found ${JSON.stringify(player_row[column])}`
      )
      await db.destroy()
      process.exit(1)
    }
  }

  const changes = await updatePlayer({
    player_row,
    update: { first_name: 'Dirk', primary_position: 'P' },
    allow_primary_position_write: true,
    source: SOURCE,
    reason: REASON
  })
  console.log(`${PID}: ${changes} field(s) written via updatePlayer`)

  await set_player_field_override({
    pid: PID,
    column_name: 'nfl_draft_year',
    override_value: null,
    provider_name: 'nflverse',
    adjudicated_by: 'operator (approved 2026-08-24)',
    evidence_source:
      'pro-football-reference.com Dirk Johnson (JohnDi20), plus this row own punting stat_id distribution in nfl_play_stats',
    reason: REASON
  })
  console.log(`${PID}: nfl_draft_year cleared (was 1989)`)

  // Rebuilt rather than left stale: `formatted_name` is in updatePlayer's
  // excluded_props, so a rename without this leaves the row reading "david
  // johnson". `name_search_vector` is deliberately NOT written here -- the
  // `player_name_search_vector_update` trigger owns it and has already fired on
  // the updatePlayer write above, and a hand-built vector would drift from
  // whatever the trigger actually constructs.
  const formatted_name = format_player_name(`Dirk ${player_row.last_name}`)
  await db('player').where({ pid: PID }).update({ formatted_name })
  console.log(`${PID}: formatted_name rebuilt as '${formatted_name}'`)

  await db.destroy()
  process.exit(0)
}

main()
