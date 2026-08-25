/*
  `TYRO-WHEA-027188` is two people. It holds Tyrone Wheatley Sr's 2000-2004
  Raiders career and Tyrone Wheatley Jr's 2022-2025 career on one row, wearing a
  biography assembled from both. This splits them.

  `2026-08-24-correct-implausible-draft-age-identities.mjs` deliberately left
  this row alone and named why: moving gamelogs between people is the operation
  that deleted 450 real rows on 2026-08-04.

  ## The two men, from PFR

    WheaTy00  Tyrone Anthony Wheatley   RB  6-0 235  b. 1972-01-19 Inkster MI
              Michigan, Robichaud (MI), NYG round 1 pick 17 of 1995
              "Relatives: Son Tyrone Wheatley Jr."

    WheaTy01  Tyrone Wheatley Jr.        T  6-6 320  b. 1997-02-04 Buffalo NY
              Michigan then Stony Brook, Canisius (NY), no draft line
              "Relatives: Father Tyrone Wheatley"

  ## Which column belongs to whom

  The gsis numeric-block cohort (data-quality-and-validation.md), run per COLUMN
  because a conflated row is not cleanly native or stolen:

    gsis_player_id     00-0036966  cohort 2021  n=81   Jr
    gsis_it_player_id  54279       cohort 2021  n=5    Jr
    otc_player_id      10008       cohort 2019  n=71   Jr
    nfl_player_id      2503605     cohort 1997  n=30   SR
    gsis on 001076     00-0017486  cohort 1994  n=13   SR

  `esb_player_id` WHE088340 sits adjacent to Zakee Wheatley's WHE088341, so it
  is modern and Jr's. `cfbref_player_id` `tyrone-wheatley-1` resolves on
  sports-reference/cfb to the Michigan RB who finished 8th in the 1993 Heisman
  and went 17th overall in 1995 -- Sr, not Jr. `pff_player_id` 136206 already
  sits on Sr's row and its one gamelog is a 2002 Super Bowl XXXVII grade for an
  LV running back, so it stays.

  ## `nfl_draft_year` 2021 STAYS on Jr

  He is undrafted, and for an undrafted player the field is a synthesized entry
  year rather than a draft year -- 2021 is his real first season. Clearing it
  (the `2026-08-24-merge-michael-lewis-split-identity.mjs` precedent, where the
  folded row's 2001 was a first season mislabelled as a draft) would remove the
  only era falsifier the row carries besides its birth date. `draft_round` and
  `draft_overall_pick`, which are Sr's 1 and 17, are cleared.

  ## The two rows OVERLAP, so this is a split and a de-duplication

  `TYRO-WHEA-001076`'s 49 gamelogs are not an earlier slice of Sr's career: they
  are all 2002-2004 Raiders, and 39 of them are the same GAMES `TYRO-WHEA-027188`
  already holds. 001076's are empty roster shells (`source`
  `nflverse-weekly-rosters`, all-zero) while 027188's carry the real stats.
  Compared column by column across every numeric column of `player_gamelogs`,
  027188's row is greater-or-equal on all of them in all 39 games, with one
  exception that is an artefact of a negative: 001076 reads 0 rushing yards
  where 027188 reads -2.

  That inverts the collision rule `update_player_id` uses. That helper drops the
  row it cannot move, on the assumption the survivor already holds an equivalent
  -- false here, because 001076's equivalents were computed from empty gamelogs.
  So the 001076 row is DELETED and the 027188 row moved onto it. The one thing
  the shell holds that the stat row does not is the `source` stamp (all 70 of
  027188's 2000-2004 rows read NULL), which is carried across before the delete:
  "a dropped column DEFAULT does not make every backup value in that column a
  default" applies just as much to a value about to be deleted.

  Sr therefore ends with 80 gamelogs, not 119.

  ## What this cannot recover

  `player_gamelogs` begins at season 2000, so Sr's 1995-1999 career is outside
  the data rather than misattributed. His 2000 season is separately thin -- 2
  logs and 31 carries against PFR's 14 games and 232 carries. Neither is fixable
  here.

  The careerlogs are left stale on purpose. `scoring_format_player_careerlogs`
  and `league_format_player_careerlogs` are whole-career aggregates that no
  per-era split can correct; they need their generators re-run.
*/

import db from '#db'
import { updatePlayer } from '#libs-server'
import set_player_field_override from '#libs-server/set-player-field-override.mjs'
import { format_player_name } from '#libs-shared'

const SR = 'TYRO-WHEA-001076'
const JR = 'TYRO-WHEA-027188'

const SOURCE = 'adhoc/2026-08-24-split-tyrone-wheatley-father-and-son'
const adjudicated_by = 'operator (approved 2026-08-24)'
const provider_name = 'nflverse'

const SR_EVIDENCE =
  'pro-football-reference.com WheaTy00 -- Tyrone Anthony Wheatley, RB, born January 19 1972, Michigan, Robichaud (MI), New York Giants round 1 pick 17 of 1995, "Relatives: Son Tyrone Wheatley Jr."'
const JR_EVIDENCE =
  'pro-football-reference.com WheaTy01 -- Tyrone Wheatley Jr., T, born February 4 1997, Michigan then Stony Brook, Canisius (NY), no draft line, "Relatives: Father Tyrone Wheatley"'

const REASON = `identity repair: ${JR} fused Tyrone Wheatley Sr (2000-2004 Raiders) and his son Tyrone Wheatley Jr (2022-2025). Sr's career and biography move to ${SR}; ${JR} keeps only Jr.`

// The father's era and the son's, with nothing in between. Asserted below
// rather than assumed: a row landing in the gap would mean the row fuses
// something this adjudication has not looked at.
const SR_FIRST_YEAR = 2000
const SR_LAST_YEAR = 2004
const JR_FIRST_YEAR = 2022

const EXPECT_SR = {
  first_name: 'Tyrone',
  last_name: 'Wheatley',
  primary_position: 'RB',
  date_of_birth: '1972-01-19',
  nfl_draft_year: 1995,
  draft_team: 'NYG',
  gsis_player_id: '00-0017486',
  esb_player_id: 'WHE081965',
  college: null,
  high_school: null,
  draft_round: null,
  draft_overall_pick: null,
  pfr_player_id: null,
  nfl_player_id: null,
  cfbref_player_id: null
}

const EXPECT_JR = {
  first_name: 'Tyrone',
  last_name: 'Wheatley',
  primary_position: 'RB',
  date_of_birth: '1972-01-19',
  college: 'Morgan State',
  high_school: 'Robichaud HS [Dearborn Heights, MI]',
  nfl_draft_year: 2021,
  draft_round: 1,
  draft_overall_pick: 17,
  gsis_player_id: '00-0036966',
  esb_player_id: 'WHE088340',
  pfr_player_id: 'WheaTy00',
  nfl_player_id: 2503605,
  cfbref_player_id: 'tyrone-wheatley-1'
}

const BY_SEASON_YEAR = 't.season_year BETWEEN ? AND ?'
const BY_GAME_SEASON =
  'EXISTS (SELECT 1 FROM nfl_games g WHERE g.esbid = t.esbid AND g.season_year BETWEEN ? AND ?)'

/*
  Every table holding rows for one of these two men, and how a row in it is
  dated. `key` is the unique key MINUS the pid column, which is what decides
  whether a moving row collides with one the survivor already has.

  `expect_moved` and `expect_deleted` are what production held when this was
  adjudicated. Only `player_gamelogs` is enforced -- it is the fact table the
  whole exercise is about, and a drift there means the split is being applied to
  something other than what was measured. The rest are generator output that a
  scheduled run may legitimately have rewritten since, so a mismatch is reported
  and not fatal.
*/
const MOVES = [
  {
    table: 'player_gamelogs',
    key: ['esbid', 'season_year'],
    era: BY_SEASON_YEAR,
    enforce_expected: true,
    expect_moved: 70,
    expect_deleted: 39
  },
  {
    table: 'scoring_format_player_gamelogs',
    key: ['esbid', 'scoring_format_id'],
    era: BY_GAME_SEASON,
    expect_moved: 2961,
    expect_deleted: 1944
  },
  {
    table: 'league_format_player_gamelogs',
    key: ['esbid', 'league_format_id'],
    era: BY_GAME_SEASON,
    expect_moved: 705,
    expect_deleted: 0
  },
  {
    table: 'player_rushing_gamelogs',
    key: ['esbid', 'season_year'],
    era: BY_SEASON_YEAR,
    expect_moved: 66,
    expect_deleted: 11
  },
  {
    table: 'player_receiving_gamelogs',
    key: ['esbid', 'season_year'],
    era: BY_SEASON_YEAR,
    expect_moved: 42,
    expect_deleted: 6
  },
  {
    table: 'player_seasonlogs',
    key: ['season_year', 'season_type'],
    era: BY_SEASON_YEAR,
    expect_moved: 11,
    expect_deleted: 5
  },
  {
    table: 'scoring_format_player_seasonlogs',
    key: ['season_year', 'scoring_format_id'],
    era: BY_SEASON_YEAR,
    expect_moved: 252,
    expect_deleted: 162
  },
  {
    table: 'league_format_player_seasonlogs',
    key: ['season_year', 'league_format_id'],
    era: BY_SEASON_YEAR,
    expect_moved: 56,
    expect_deleted: 0
  },
  {
    table: 'league_player_seasonlogs',
    key: ['season_year', 'lid'],
    era: BY_SEASON_YEAR,
    expect_moved: 4,
    expect_deleted: 0
  }
]

// Every other table either pid appears in. Snapshotted so a count that moves
// without this script naming it is visible rather than silent.
const WITNESS_TABLES = [
  'player_changelog',
  'player_contracts',
  'historical_injury_index',
  'pff_player_gamelogs',
  'pff_player_facet_gamelogs',
  'scoring_format_player_careerlogs',
  'league_format_player_careerlogs'
]

const assert_row = (row, expected, pid) => {
  for (const [column, value] of Object.entries(expected)) {
    if (row[column] !== value) {
      throw new Error(
        `REFUSING: ${pid}.${column} expected ${JSON.stringify(value)}, found ${JSON.stringify(row[column])} -- the adjudication no longer describes this pair`
      )
    }
  }
}

const apply_override = async ({
  pid,
  column_name,
  override_value,
  evidence
}) => {
  const result = await set_player_field_override({
    pid,
    column_name,
    override_value,
    provider_name,
    adjudicated_by,
    evidence_source: evidence,
    reason: REASON
  })

  // set_player_field_override keeps a refused declaration rather than throwing,
  // so the drift check can see it. Here a refusal means the ordering below is
  // wrong, and continuing would leave the split half-done.
  if (!result.is_applied) {
    throw new Error(
      `REFUSING: ${pid}.${column_name} override declared ${JSON.stringify(override_value)} but the row holds ${JSON.stringify(result.live_value)} -- the usual cause is another row still holding the value`
    )
  }
  console.log(`  ${pid}.${column_name} = ${JSON.stringify(override_value)}`)
}

const count_rows = async (table, pid) => {
  const [row] = await db(table).where({ pid }).count('* as count')
  return Number(row.count)
}

const snapshot = async () => {
  const tables = [...MOVES.map((m) => m.table), ...WITNESS_TABLES]
  const out = {}
  for (const table of tables) {
    out[table] = {
      sr: await count_rows(table, SR),
      jr: await count_rows(table, JR)
    }
  }
  return out
}

const print_snapshot = (label, counts) => {
  console.log(`\n--- ${label} ---`)
  console.log(`${'table'.padEnd(36)} ${'SR'.padStart(7)} ${'JR'.padStart(7)}`)
  for (const [table, { sr, jr }] of Object.entries(counts)) {
    console.log(
      `${table.padEnd(36)} ${String(sr).padStart(7)} ${String(jr).padStart(7)}`
    )
  }
}

const ERA_BINDINGS = [SR_FIRST_YEAR, SR_LAST_YEAR]

const move_era_rows = async (trx, { table, key, era }) => {
  const match = key
    .map((column) => `s."${column}" IS NOT DISTINCT FROM t."${column}"`)
    .join(' AND ')

  // The survivor's colliding rows go first, because the row arriving is the one
  // holding the stats. See the header: this is the opposite of what
  // update_player_id does with a blocked row.
  const deleted = await trx.raw(
    `
    WITH removed AS (
      DELETE FROM "${table}" s
      WHERE s.pid = ?
        AND EXISTS (
          SELECT 1 FROM "${table}" t
          WHERE t.pid = ? AND ${era} AND ${match}
        )
      RETURNING 1
    )
    SELECT count(*)::int AS count FROM removed
  `,
    [SR, JR, ...ERA_BINDINGS]
  )

  const moved = await trx.raw(
    `
    WITH updated AS (
      UPDATE "${table}" t SET pid = ?
      WHERE t.pid = ? AND ${era}
      RETURNING 1
    )
    SELECT count(*)::int AS count FROM updated
  `,
    [SR, JR, ...ERA_BINDINGS]
  )

  return {
    deleted: deleted.rows[0].count,
    moved: moved.rows[0].count
  }
}

const main = async () => {
  const sr_row = await db('player').where({ pid: SR }).first()
  const jr_row = await db('player').where({ pid: JR }).first()

  if (!sr_row || !jr_row) {
    throw new Error(`REFUSING: ${SR} and ${JR} must both exist`)
  }

  assert_row(sr_row, EXPECT_SR, SR)
  assert_row(jr_row, EXPECT_JR, JR)

  // Nothing may sit between the father's last season and the son's first. A row
  // in the gap belongs to neither career as described here.
  const gap = await db('player_gamelogs')
    .where({ pid: JR })
    .whereBetween('season_year', [SR_LAST_YEAR + 1, JR_FIRST_YEAR - 1])
    .count('* as count')
  if (Number(gap[0].count) > 0) {
    throw new Error(
      `REFUSING: ${JR} holds ${gap[0].count} gamelog(s) in ${SR_LAST_YEAR + 1}-${JR_FIRST_YEAR - 1}, which this adjudication assigns to neither man`
    )
  }

  const before = await snapshot()
  print_snapshot('reference counts BEFORE', before)

  // --- Jr's row: release the father's identity first -----------------------
  //
  // nfl_player_id and cfbref_player_id are protected_props, and updatePlayer's
  // cross-row uniqueness guard is NOT lifted by an override -- it is what
  // mechanically enforces this ordering. Setting them on Sr before clearing
  // them here would be refused.
  console.log(`\n--- ${JR}: releasing Sr's identity ---`)
  for (const column_name of [
    'draft_round',
    'draft_overall_pick',
    'nfl_player_id',
    'cfbref_player_id'
  ]) {
    await apply_override({
      pid: JR,
      column_name,
      override_value: null,
      evidence: SR_EVIDENCE
    })
  }

  console.log(`\n--- ${JR}: writing Jr's identity ---`)
  for (const [column_name, override_value] of [
    ['date_of_birth', '1997-02-04'],
    ['college', 'Stony Brook'],
    ['high_school', 'Canisius HS [Buffalo, NY]'],
    ['pfr_player_id', 'WheaTy01']
  ]) {
    await apply_override({
      pid: JR,
      column_name,
      override_value,
      evidence: JR_EVIDENCE
    })
  }

  // Name, position and team are not adjudicated fields -- they are what a
  // roster feed legitimately owns, and freezing them with an override would
  // outlive the reason for it.
  const jr_changes = await updatePlayer({
    player_row: await db('player').where({ pid: JR }).first(),
    update: {
      last_name: 'Wheatley Jr.',
      short_name: 'T.Wheatley Jr.',
      primary_position: 'T',
      secondary_position: 'T'
    },
    allow_primary_position_write: true,
    source: SOURCE,
    reason: REASON
  })
  console.log(`  ${JR}: ${jr_changes} name/position field(s) written`)

  // updatePlayer excludes formatted_name; name_search_vector is the trigger's.
  const jr_formatted_name = format_player_name('Tyrone Wheatley Jr.')
  await db('player')
    .where({ pid: JR })
    .update({ formatted_name: jr_formatted_name })
  console.log(`  ${JR}: formatted_name rebuilt as '${jr_formatted_name}'`)

  // --- Sr's row: take the identity Jr's row was wearing ---------------------
  console.log(`\n--- ${SR}: writing Sr's identity ---`)
  for (const [column_name, override_value] of [
    ['college', 'Michigan'],
    ['high_school', 'Robichaud HS [Dearborn Heights, MI]'],
    // player_field_override.override_value is text, and the existing rows store
    // numeric columns as strings ('48464', '193'). Postgres coerces on the way
    // into the smallint and integer columns these name.
    ['draft_round', '1'],
    ['draft_overall_pick', '17'],
    ['pfr_player_id', 'WheaTy00'],
    ['nfl_player_id', '2503605'],
    ['cfbref_player_id', 'tyrone-wheatley-1']
  ]) {
    await apply_override({
      pid: SR,
      column_name,
      override_value,
      evidence: SR_EVIDENCE
    })
  }

  // A man born in 1972 who last played in 2004 is not on a roster, and
  // current_nfl_team is what excludes a player from the active-only cache
  // process-plays enrichment reads.
  const sr_changes = await updatePlayer({
    player_row: await db('player').where({ pid: SR }).first(),
    update: { current_nfl_team: 'INA' },
    source: SOURCE,
    reason: REASON
  })
  console.log(`  ${SR}: ${sr_changes} roster field(s) written`)

  // --- move the father's rows ----------------------------------------------
  //
  // One transaction, because a failure part way through leaves one man's career
  // spread over two rows in a shape nobody measured. The field writes above are
  // outside it: updatePlayer and set_player_field_override own the global
  // connection and take no trx, and each is individually idempotent on a re-run.
  await db.transaction(async (trx) => {
    // All 70 of Jr's-row 2000-2004 gamelogs read source NULL; the shells about
    // to be deleted carry a real stamp. Done before the delete, or it is lost.
    const stamped = await trx.raw(
      `
      WITH updated AS (
        UPDATE player_gamelogs t SET source = s.source
        FROM player_gamelogs s
        WHERE t.pid = ? AND s.pid = ?
          AND t.esbid = s.esbid AND t.season_year = s.season_year
          AND t.season_year BETWEEN ? AND ?
          AND t.source IS NULL AND s.source IS NOT NULL
        RETURNING 1
      )
      SELECT count(*)::int AS count FROM updated
    `,
      [JR, SR, ...ERA_BINDINGS]
    )
    console.log(
      `\n--- ${stamped.rows[0].count} gamelog source stamp(s) carried from the shells ---`
    )

    console.log('\n--- moving 2000-2004 rows ---')
    console.log(
      `${'table'.padEnd(36)} ${'moved'.padStart(7)} ${'deleted'.padStart(8)}  expected`
    )
    for (const spec of MOVES) {
      const { deleted, moved } = await move_era_rows(trx, spec)
      const is_expected =
        moved === spec.expect_moved && deleted === spec.expect_deleted
      const note = is_expected
        ? ''
        : `  DRIFT: expected ${spec.expect_moved} moved / ${spec.expect_deleted} deleted`
      console.log(
        `${spec.table.padEnd(36)} ${String(moved).padStart(7)} ${String(deleted).padStart(8)}${note}`
      )
      if (!is_expected && spec.enforce_expected) {
        throw new Error(
          `REFUSING: ${spec.table} moved ${moved} and deleted ${deleted}, adjudicated against ${spec.expect_moved} and ${spec.expect_deleted} -- production is not what this split was measured on`
        )
      }
    }
  })

  // --- verify ---------------------------------------------------------------
  const after = await snapshot()
  print_snapshot('reference counts AFTER', after)

  const residue = await db('player_gamelogs')
    .where({ pid: JR })
    .where('season_year', '<=', SR_LAST_YEAR)
    .count('* as count')
  if (Number(residue[0].count) > 0) {
    throw new Error(
      `REFUSING TO REPORT SUCCESS: ${JR} still holds ${residue[0].count} gamelog(s) at or before ${SR_LAST_YEAR}`
    )
  }

  const sr_modern = await db('player_gamelogs')
    .where({ pid: SR })
    .where('season_year', '>=', JR_FIRST_YEAR)
    .count('* as count')
  if (Number(sr_modern[0].count) > 0) {
    throw new Error(
      `REFUSING TO REPORT SUCCESS: ${SR} holds ${sr_modern[0].count} gamelog(s) from ${JR_FIRST_YEAR} onward`
    )
  }

  const seasons = await db('player_gamelogs')
    .whereIn('pid', [SR, JR])
    .groupBy('pid', 'season_year')
    .orderBy('pid')
    .orderBy('season_year')
    .select('pid', 'season_year')
    .count('* as count')
  console.log('\n--- gamelogs by season AFTER ---')
  for (const row of seasons) {
    console.log(`${row.pid}  ${row.season_year}  ${row.count}`)
  }

  const final_sr = await db('player').where({ pid: SR }).first()
  const final_jr = await db('player').where({ pid: JR }).first()
  for (const row of [final_sr, final_jr]) {
    console.log(
      `\n${row.pid}: ${row.first_name} ${row.last_name} ${row.primary_position} dob=${row.date_of_birth} college=${row.college} hs=${row.high_school} draft=${row.nfl_draft_year} r${row.draft_round} p${row.draft_overall_pick} gsis=${row.gsis_player_id} esb=${row.esb_player_id} pfr=${row.pfr_player_id} nfl=${row.nfl_player_id} cfbref=${row.cfbref_player_id} team=${row.current_nfl_team}`
    )
  }

  console.log(
    '\nSTALE ON PURPOSE: scoring_format_player_careerlogs and league_format_player_careerlogs on both pids are whole-career aggregates no per-era split can correct. Re-run their generators.'
  )

  await db.destroy()
  process.exit(0)
}

main()
