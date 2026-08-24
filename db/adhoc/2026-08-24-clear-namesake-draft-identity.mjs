/*
  Clears the historical namesake's `nfl_draft_year` -- and, where it is also an
  intruder, `pfr_player_id` -- off 18 modern `player` rows that carry them.

  ## How the class was found

  Ask each row how old it was on draft day: `nfl_draft_year` minus the birth
  year. 82 rows fall outside 20-27. Most are legitimate (late-blooming
  quarterbacks, Australian punters converting from rugby). 20 land at a NEGATIVE
  age -- the row says drafted 1973 and born 1989 -- which is impossible by
  construction and needs no judgement call to spot.

  ## Which half of the row is wrong

  The gamelogs decide it, before any external source is consulted. Every one of
  these rows has a MODERN career (2001-2022) that agrees with its birth date,
  its gsis id and its college. The draft year is the only field pointing at the
  1970s and 80s. So the identity core is sound and the draft year is the graft.

  Pro Football Reference confirms it row by row. Nine of these rows also hold a
  `pfr_player_id`, and every one of the nine resolves to a DIFFERENT person --
  the namesake who really was drafted that year -- with a birth date two to four
  decades earlier and a different college. Two of them (Lester Williams, Dennis
  Morgan) are deceased. The other nine rows hold no pfr id; for those PFR
  confirms a historical namesake exists at the stated draft year, which is where
  the value came from.

  ## Why null rather than the right value

  Most of these players are undrafted, and the ones that are not would need a
  guess. A guessed draft year is exactly how this class was created. Null is an
  honest absence; a wrong year is a false assertion that reads as data.

  ## Why an override rather than a plain update

  `updatePlayer` silently skips every null write (`update-player.mjs`
  nullable_props), so a clear is unreachable through it. More importantly the
  value did not appear by accident -- an importer wrote it and will write it
  again. `set_player_field_override` records the verdict, applies it through
  updatePlayer so the `player_changelog` trail looks like every other change,
  and leaves the player-field-override-drift check watching for a re-write.

  Two rows in this class are NOT here, because they are identity errors rather
  than field errors and are repaired separately:
    DAVI-JOHN-015871  is Dirk Johnson the punter, not David Johnson
    MARV-LEWI-006866  is Michael Lewis, and duplicates MICH-LEWI-022558
*/

import db from '#db'
import set_player_field_override from '#libs-server/set-player-field-override.mjs'

const adjudicated_by = 'operator (approved 2026-08-24)'
const evidence_source =
  'pro-football-reference.com player pages, read 2026-08-24, cross-checked against each row own player_gamelogs season range'

// `expect` is a pre-condition, not documentation. A row whose value has moved
// since the survey is a row the adjudication no longer describes, so it is
// skipped rather than written -- the working tree is shared and this file may
// run days after it was measured.
const CORRECTIONS = [
  {
    pid: 'LEST-WILL-008945',
    expect: { nfl_draft_year: 1982, pfr_player_id: 'WillLe22' },
    note: 'WillLe22 is the 1982 first-round NT out of Miami (FL), born 1959, died 2017. This row is born 1997, played 2021-22, Syracuse.'
  },
  {
    pid: 'CEDR-JONE-017573',
    expect: { nfl_draft_year: 1982, pfr_player_id: 'JoneCe00' },
    note: 'JoneCe00 is the 1982 third-round WR out of Duke, born 1960. This row is born 1980, played 2003-08, Iowa.'
  },
  {
    pid: 'CURT-THOM-008802',
    expect: { nfl_draft_year: 1984, pfr_player_id: 'ThomCu20' },
    note: 'ThomCu20 is the 1984 twelfth-round WR out of Missouri, born 1962. This row is born 1989, played 2014, Stanford.'
  },
  {
    pid: 'DAVI-ADAM-003626',
    expect: { nfl_draft_year: 1987, pfr_player_id: 'AdamDa20' },
    note: 'AdamDa20 is the 1987 twelfth-round RB out of Arizona, born 1964. This row is born 1990, Portland State.'
  },
  {
    pid: 'DENN-MORG-009460',
    expect: { nfl_draft_year: 1974, pfr_player_id: 'MorgDe00' },
    note: 'MorgDe00 is the 1974 tenth-round RB out of Western Illinois, born 1952, died 2015. This row is born 1989, Virginia Tech.'
  },
  {
    pid: 'LIND-SCOT-015849',
    expect: { nfl_draft_year: 1982, pfr_player_id: 'ScotLi00' },
    note: 'ScotLi00 is the 1982 first-round WR out of Georgia, born 1960. This row is born 1987, played 2012, Georgia Southern.'
  },
  {
    pid: 'MARK-LEWI-007393',
    expect: { nfl_draft_year: 1985, pfr_player_id: 'LewiMa21' },
    note: 'LewiMa21 is the 1985 sixth-round TE out of Texas A&M, born 1961. This row is born 1980, played 2006-07, Urbana.'
  },
  {
    pid: 'MELV-BAKE-010049',
    expect: { nfl_draft_year: 1974, pfr_player_id: 'BakeMe00' },
    note: 'BakeMe00 is the 1974 eighth-round WR out of Texas Southern, born 1950. This row is born 1983, played 2007-09, North Carolina.'
  },
  {
    pid: 'NEWT-WILL-010293',
    expect: { nfl_draft_year: 1982, pfr_player_id: 'WillNe20' },
    note: 'WillNe20 is the 1982 fifth-round RB out of Arizona St., born 1959. This row is born 1989, played 2011, Washington.'
  },

  {
    pid: 'BARR-SMIT-010078',
    expect: { nfl_draft_year: 1973 },
    note: 'The 1973 WR of this surname on PFR is Barry Smith, Florida State. This row is Barrett Smith, born 1989, Georgia.'
  },
  {
    pid: 'CHRI-GREE-019738',
    expect: { nfl_draft_year: 1991 },
    note: 'PFR Chris Green DB played 1991-1995. This row is born 1976 and played 2002-2010 out of UCF.'
  },
  {
    pid: 'DAVI-SIMM-020121',
    expect: { nfl_draft_year: 1979 },
    note: 'PFR Dave Simmons LB played 1979-1983. This row is born 1988 and played 2011 out of USC.'
  },
  {
    pid: 'JEFF-WEST-012747',
    expect: { nfl_draft_year: 1975 },
    note: 'PFR Jeff West P-TE played 1975-1985. This row is born 1984 and played 2008-2011 out of Texas-El Paso.'
  },
  {
    pid: 'JEFF-WILL-010058',
    expect: { nfl_draft_year: 1977 },
    note: 'PFR Jeff Williams G-T played 1977-1982. This row is born 1968 and played 2001-02 out of Cheyney.'
  },
  {
    pid: 'JEFF-WILL-010181',
    expect: { nfl_draft_year: 1977 },
    note: 'The same 1977 Jeff Williams draft year, landed on a second modern row: born 1987, played 2010, Tulane.'
  },
  {
    pid: 'JOSE-JONE-012868',
    expect: { nfl_draft_year: 1984 },
    note: 'This row is born 1993 and played 2017-2019 out of Miami (Ohio). A 1984 draft year is impossible for it whichever namesake it came from.'
  },
  {
    pid: 'MART-SMIT-013289',
    expect: { nfl_draft_year: 1975 },
    note: 'PFR Marty Smith DT-DE played 1976. This row is born 1984 and played 2008-09 out of Arizona.'
  },
  {
    pid: 'RODE-HARR-023508',
    expect: { nfl_draft_year: 1989 },
    note: 'PFR Rod Harris WR was drafted 1989 out of Texas A&M. This row is born 1992 and played 2015-16 out of New Hampshire.'
  }
]

const main = async () => {
  let cleared = 0
  let skipped = 0

  for (const correction of CORRECTIONS) {
    const player_row = await db('player').where({ pid: correction.pid }).first()

    if (!player_row) {
      console.log(`SKIP ${correction.pid}: no such row`)
      skipped += 1
      continue
    }

    for (const [column_name, expected] of Object.entries(correction.expect)) {
      if (player_row[column_name] !== expected) {
        console.log(
          `SKIP ${correction.pid}.${column_name}: expected ${JSON.stringify(expected)}, found ${JSON.stringify(player_row[column_name])} -- the adjudication no longer describes this row`
        )
        skipped += 1
        continue
      }

      await set_player_field_override({
        pid: correction.pid,
        column_name,
        override_value: null,
        provider_name: 'nflverse',
        adjudicated_by,
        evidence_source,
        reason: `identity repair: ${column_name} belongs to a historical namesake, not to this person -- ${correction.note}`
      })

      console.log(`CLEARED ${correction.pid}.${column_name} (was ${expected})`)
      cleared += 1
    }
  }

  console.log(`\n${cleared} field(s) cleared, ${skipped} skipped`)
  await db.destroy()
  process.exit(0)
}

main()
