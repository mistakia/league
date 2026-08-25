/*
  The last residue of the Tyrone Wheatley split.

  `scripts/generate-player-career-game-counts.mjs` rebuilt `career_year` across
  all history after the split, and it corrected every REG and POST row: Jr's
  seasons now read 1, 2, 3 rather than the 6, 7, 8 they inherited from the fused
  row's nine-season span.

  It cannot reach his two PRESEASON rows. Its year loop is
  `whereIn('nfl_games.season_type', ['REG', 'POST'])`, so a PRE row keeps
  whatever it was last given -- which for Jr is his father's numbering.

    2023 PRE  career_year 7   his own 2023 REG row reads 1
    2022 PRE  career_year 6   he has no 2023 REG counterpart for this season

  ## Why 2022 is cleared rather than numbered

  `career_year` is the ordinal of the season within the seasons the player
  recorded a REG or POST game in. Jr recorded none in 2022 -- a preseason
  appearance for the Raiders and nothing else -- so that definition assigns the
  season no ordinal at all. Writing 1 would contradict his 2023 REG row, which
  is already 1. An absence is not a value, and inventing one here is the same
  move as synthesizing an identifier for a row that has none.

  ## The general defect is NOT repaired here

  Measured across production before this ran, the PRE gap is league-wide and
  long-standing:

    44,779  PRE rows carrying a career_year
     5,062  disagree with the same pid and season's REG row
     8,351  have no REG row for that season at all

  So 13,413 rows are in one of the two shapes this script corrects for one
  player. Fixing them needs a decision about what `career_year` means for a
  preseason-only season, which is a modelling call and not a consequence of the
  Wheatley split. Only the two rows carrying the WRONG MAN's numbers are
  corrected; the rest is recorded as a finding.
*/

import debug from 'debug'

import db from '#db'
import { enable_debug_namespaces } from '#libs-shared/enable-debug-namespaces.mjs'

const log = debug('correct-wheatley-jr-preseason-career-year')
enable_debug_namespaces('correct-wheatley-jr-preseason-career-year')

const JR = 'TYRO-WHEA-027188'

// season_year -> the value to write, and what production must hold first.
const CORRECTIONS = [
  { season_year: 2023, expect: 7, career_year: 1 },
  { season_year: 2022, expect: 6, career_year: null }
]

const main = async () => {
  // The 2023 value is not a constant -- it is whatever the rebuilt REG row for
  // the same season says. Read it rather than trusting the number above.
  const reg_2023 = await db('player_seasonlogs')
    .where({ pid: JR, season_year: 2023, season_type: 'REG' })
    .first()

  if (!reg_2023) {
    throw new Error(`REFUSING: ${JR} has no 2023 REG seasonlog to read from`)
  }

  const expected_2023 = CORRECTIONS.find((c) => c.season_year === 2023)
  if (reg_2023.career_year !== expected_2023.career_year) {
    throw new Error(
      `REFUSING: ${JR} 2023 REG career_year is ${reg_2023.career_year}, not ${expected_2023.career_year} -- run generate-player-career-game-counts first`
    )
  }

  for (const { season_year, expect, career_year } of CORRECTIONS) {
    const row = await db('player_seasonlogs')
      .where({ pid: JR, season_year, season_type: 'PRE' })
      .first()

    if (!row) {
      log(`SKIP ${season_year} PRE: no row`)
      continue
    }

    if (row.career_year === career_year) {
      log(`SKIP ${season_year} PRE: already ${JSON.stringify(career_year)}`)
      continue
    }

    if (row.career_year !== expect) {
      throw new Error(
        `REFUSING: ${JR} ${season_year} PRE career_year is ${row.career_year}, expected ${expect} -- something else has written this row`
      )
    }

    await db('player_seasonlogs')
      .where({ pid: JR, season_year, season_type: 'PRE' })
      .update({ career_year })

    log(
      `${season_year} PRE career_year ${expect} -> ${JSON.stringify(career_year)}`
    )
  }

  const final_rows = await db('player_seasonlogs')
    .where({ pid: JR })
    .orderBy('season_year')
    .orderBy('season_type')
  for (const row of final_rows) {
    log(
      `${row.season_year} ${row.season_type} career_year=${JSON.stringify(row.career_year)} player_position=${row.player_position}`
    )
  }

  const fathers_numbering = final_rows.filter(
    (row) => row.career_year != null && row.career_year > 4
  )
  if (fathers_numbering.length) {
    throw new Error(
      `REFUSING TO REPORT SUCCESS: ${fathers_numbering.length} of Jr's seasonlogs still read a career_year above 4, which he cannot have reached`
    )
  }

  await db.destroy()
  process.exit(0)
}

main()
