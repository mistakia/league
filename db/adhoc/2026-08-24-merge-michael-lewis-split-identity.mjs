/*
  Michael "Beer Man" Lewis occupies two `player` rows, and the one holding his
  whole career is labelled with Marvin Lewis's name, position and draft.

  ## The two rows

  `MARV-LEWI-006866` holds the career and the identifiers -- gsis `00-0019600`,
  esb `LEW530393`, a smart id, 102 gamelogs across 2001-2007, 4,995
  scoring_format gamelogs -- plus Michael's own birth date (1971-11-14), his
  "No College" and his Metairie high school. The NFL's own ledger names that
  gsis id `M.Lewis` on 514 stat rows and `Mike Lewis` on 63. It is Michael.

  `MICH-LEWI-022558` holds the correct name, his `nfl_player_id`, his pfr id
  `LewiMi00`, and six pff rows. No gsis, no esb, no gamelogs.

  What is grafted onto the first row is Marvin Lewis, the 1982 sixth-round RB
  out of Tulane: the first name, the RB position, `nfl_draft_year` 1982 and
  `draft_overall_pick` 142 -- which is exactly Marvin's slot on PFR -- and his
  pfr id `LewiMa22`.

  ## Why the order below matters

  `merge_player_row_fields` breaks a two-value tie by LONGEST STRING and LARGEST
  NUMBER. That is a shape rule, not a correctness rule, and on this pair it
  decides several fields:

    first_name          "Marvin"(6) vs "Michael"(7)   -> Michael, correct by luck
    primary_position    "RB" vs "WR"                  -> equal length, arbitrary
    pfr_player_id       "LewiMa22" vs "LewiMi00"      -> equal length, arbitrary
    nfl_draft_year      1982 vs 2001                  -> 2001, still wrong
    draft_overall_pick  142 vs null                   -> 142, Marvin's slot

  So the name and position are corrected BEFORE the merge, where the tie
  disappears, and the two draft fields are cleared AFTER it, where the surviving
  row is the only row left. Clearing them first would not work: the merge writes
  the folded row's values in afterwards, and an override declaring null would
  then be in permanent conflict with what the merge wrote.

  ## Which pid survives

  `MARV-LEWI-006866`, despite its name prefix. A pid's four-plus-four letter
  prefix is a courtesy snapshot that carries no identity (see the pid design in
  CLAUDE.md), and this row holds five thousand-odd referencing rows against the
  other's six. Surviving the smaller row would repoint two orders of magnitude
  more data to buy a prettier string.

  Michael Lewis was UNDRAFTED -- PFR's page for LewiMi00 carries no draft line
  at all -- so `nfl_draft_year` 2001 on the folded row is his first season
  mislabelled, and null is the honest value.
*/

import db from '#db'
import { updatePlayer } from '#libs-server'
import mergePlayer from '#libs-server/merge-player.mjs'
import set_player_field_override from '#libs-server/set-player-field-override.mjs'
import { format_player_name } from '#libs-shared'

const SURVIVOR = 'MARV-LEWI-006866'
const FOLDED = 'MICH-LEWI-022558'
const SOURCE = 'adhoc/2026-08-24-merge-michael-lewis-split-identity'
const REASON =
  'identity repair: MARV-LEWI-006866 and MICH-LEWI-022558 are one person, Michael "Beer Man" Lewis -- same birth date, and the ledger names gsis 00-0019600 as M.Lewis and Mike Lewis. The Marvin Lewis name, RB position, 1982 draft year and 142nd overall pick belong to the 1982 Tulane running back.'

const EXPECT_SURVIVOR = {
  first_name: 'Marvin',
  primary_position: 'RB',
  nfl_draft_year: 1982,
  draft_overall_pick: 142,
  pfr_player_id: 'LewiMa22',
  gsis_player_id: '00-0019600',
  date_of_birth: '1971-11-14'
}

const EXPECT_FOLDED = {
  first_name: 'Michael',
  primary_position: 'WR',
  pfr_player_id: 'LewiMi00',
  date_of_birth: '1971-11-14'
}

const assert_row = (row, expected, pid) => {
  for (const [column, value] of Object.entries(expected)) {
    if (row[column] !== value) {
      throw new Error(
        `REFUSING: ${pid}.${column} expected ${JSON.stringify(value)}, found ${JSON.stringify(row[column])} -- the adjudication no longer describes this pair`
      )
    }
  }
}

const main = async () => {
  const survivor_row = await db('player').where({ pid: SURVIVOR }).first()
  const folded_row = await db('player').where({ pid: FOLDED }).first()

  if (!survivor_row || !folded_row) {
    console.log('SKIP: one or both rows are already gone')
    await db.destroy()
    process.exit(0)
  }

  assert_row(survivor_row, EXPECT_SURVIVOR, SURVIVOR)
  assert_row(folded_row, EXPECT_FOLDED, FOLDED)

  // Both rows must agree on the birth date, which is the one field that would
  // make this two people rather than one.
  if (survivor_row.date_of_birth !== folded_row.date_of_birth) {
    throw new Error('REFUSING: the two rows disagree on date_of_birth')
  }

  // Before the merge, so the name and position tie-breaks have nothing to
  // decide.
  const corrected = await updatePlayer({
    player_row: survivor_row,
    update: {
      first_name: 'Michael',
      primary_position: 'WR',
      secondary_position: 'WR'
    },
    allow_primary_position_write: true,
    source: SOURCE,
    reason: REASON
  })
  console.log(`${SURVIVOR}: ${corrected} field(s) corrected before the merge`)

  await mergePlayer({
    update_player_row: await db('player').where({ pid: SURVIVOR }).first(),
    remove_player_row: folded_row
  })
  console.log(`merged ${FOLDED} into ${SURVIVOR}`)

  // After the merge, so nothing writes them back.
  for (const column_name of ['nfl_draft_year', 'draft_overall_pick']) {
    await set_player_field_override({
      pid: SURVIVOR,
      column_name,
      override_value: null,
      provider_name: 'nflverse',
      adjudicated_by: 'operator (approved 2026-08-24)',
      evidence_source:
        'pro-football-reference.com LewiMi00 (Michael Lewis, no draft line) and LewiMa22 (Marvin Lewis, 1982 round 6, 142nd overall)',
      reason: REASON
    })
    console.log(`${SURVIVOR}.${column_name} cleared`)
  }

  // updatePlayer excludes formatted_name, so the merge cannot have fixed it.
  // name_search_vector is left to its trigger.
  const formatted_name = format_player_name('Michael Lewis')
  await db('player').where({ pid: SURVIVOR }).update({ formatted_name })
  console.log(`${SURVIVOR}: formatted_name rebuilt as '${formatted_name}'`)

  const final_row = await db('player').where({ pid: SURVIVOR }).first()
  console.log(
    `\nfinal: ${final_row.first_name} ${final_row.last_name} ${final_row.primary_position} gsis=${final_row.gsis_player_id} esb=${final_row.esb_player_id} pfr=${final_row.pfr_player_id} nfl=${final_row.nfl_player_id} draft_year=${final_row.nfl_draft_year} pick=${final_row.draft_overall_pick}`
  )

  await db.destroy()
  process.exit(0)
}

main()
