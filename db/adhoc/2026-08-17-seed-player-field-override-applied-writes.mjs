// STATUS: APPLIED 2026-08-17 against league_production
//   declared 14, applied 14, refused 0; player rows changed 0.
//   The banner is hand-maintained here: db-exec.sh owns it for .sql only.
//
// Seed player_field_override with the fourteen adjudicated writes that are
// ALREADY in `player` and carry no provenance.
//
// Why these fourteen and no others. Measured 2026-08-17 against the live table:
// eight date_of_birth backfills and six sleeper_player_id links are present in
// `player` and NONE of them appears in player_changelog, because they were
// applied outside updatePlayer. The verdicts behind them are real -- every one
// is in scratch/adjudicate-ambiguous-players/ADJUDICATION.md with at least two
// independent sources, and the birth dates carry a third from
// Pro-Football-Reference or ESPN -- but the DATABASE has no record of who
// decided them, against which source, or on what date. This attaches that
// record to values that are already correct.
//
// This writes ONLY to player_field_override. Every value below is what `player`
// already holds, verified immediately before this file was written, so every
// apply is a no-op against `player` and nothing here is a repair. That is the
// whole point: the mechanism's first job is to make an existing correction
// falsifiable, not to make a new one.
//
// The later batch of 22 repairs (db/adhoc/2026-08-17-adjudicated-player-identity-repairs)
// is deliberately NOT seeded here. Those went through updatePlayer with a
// source and per-row reasons, so they already have a trail; they still lack a
// durable VERDICT and are a follow-on for their owning task, not this one.
//
// Idempotent: set_player_field_override upserts on (pid, column_name), and a
// value `player` already holds produces no update and no changelog row. Safe to
// re-run.
//
// Run from the repo root: node db/adhoc/2026-08-17-seed-player-field-override-applied-writes.mjs
//
// See user:task/league/design-durable-external-provider-overrides.md.

import db from '#db'
import set_player_field_override from '#libs-server/set-player-field-override.mjs'

const adjudicated_by = 'operator (approved 2026-08-17)'
const adjudicated_at = new Date('2026-08-17T00:00:00Z')

// Eight date_of_birth backfills. Our row held the '0000-00-00' placeholder in
// every case, so the override pins the adjudicated date against the importers
// that write this column -- import-players-sleeper runs on eight cron lines
// including an unconditional 03:30, which is the concrete re-import risk.
const date_of_birth_overrides = [
  {
    pid: 'GRIF-HEBE-000948',
    override_value: '1999-04-02',
    provider_name: 'sleeper',
    evidence_source:
      'nflverse on gsis 00-0038760 (Griffin Hebert, Louisiana Tech, rookie 2023); Sleeper 11224 agrees; PFR HebeGr00 gives April 2, 1999, Lafayette LA',
    reason: 'row held the 0000-00-00 placeholder'
  },
  {
    pid: 'JESS-MATT-017444',
    override_value: '1999-08-12',
    provider_name: 'sleeper',
    evidence_source:
      'nflverse on gsis 00-0038726 (Jesse Matthews, San Diego State WR, rookie 2023); Sleeper 11452 agrees; PFR MattJe00 gives August 12, 1999, San Diego CA',
    reason: 'row held the 0000-00-00 placeholder'
  },
  {
    pid: 'JORD-MURR-006621',
    override_value: '2000-04-20',
    provider_name: 'sleeper',
    evidence_source:
      'ESPN athlete 4368172 (TE, Hawaii, born 2000-04-20 in Lees Summit MO); Sleeper 11493 agrees; 247Sports agrees. PFR MurrJo00 DISAGREES and is wrong -- it merges both Jordan Murrays, carrying the North Texas OT birth date on the Hawaii TE body',
    reason:
      'row held the 0000-00-00 placeholder; the other Jordan Murray is JORD-MURR-000108, the North Texas OT'
  },
  {
    pid: 'KEIL-HARR-002651',
    override_value: '2001-01-08',
    provider_name: 'sleeper',
    evidence_source:
      'nflverse on gsis 00-0038926 (Keilahn Harris, Oklahoma Baptist WR, rookie 2023); Sleeper 11190 agrees; PFR HarrKe02 gives January 8, 2001, Richardson TX',
    reason: 'row held the 0000-00-00 placeholder'
  },
  {
    pid: 'SEAN-RYAN-027249',
    override_value: '1999-01-21',
    provider_name: 'sleeper',
    evidence_source:
      'nflverse on gsis 00-0038455 (Sean Ryan, Rutgers/West Virginia/Temple WR, rookie 2023); Sleeper 11387 agrees; PFR RyanSe01 gives January 21, 1999, Brooklyn NY',
    reason:
      'row held the 0000-00-00 placeholder; the elder Sean Ryan is SEAN-RYAN-001783, the 2004 Boston College TE'
  },
  {
    pid: 'TERR-BYNU-027186',
    override_value: '1998-08-03',
    provider_name: 'sleeper',
    evidence_source:
      'nflverse on gsis 00-0038860 (Terrell Bynum, USC/Washington WR, rookie 2023); Sleeper 11115 agrees; PFR BynuTe00 gives August 3, 1998',
    reason: 'row held the 0000-00-00 placeholder'
  },
  {
    // The one row where a provider was actively WRONG rather than merely
    // silent, so provider_name names the feed being overridden.
    pid: 'THYR-PITT-010328',
    override_value: '1999-04-08',
    provider_name: 'nfl',
    evidence_source:
      'PFR PittTh00 gives April 8, 1999, Manassas VA, agreeing with Sleeper against the NFL feed. nflverse players.csv and the 2023 weekly rosters both say 2001-04-08 but SHARE an upstream, so they were never two independent confirmations; a 2001 birth would make him a 17-year-old college freshman in 2018',
    reason:
      'the NFL feed birth YEAR is wrong; two independent sources agree on 1999'
  },
  {
    pid: 'MAXX-BRED-001713',
    override_value: '2002-10-04',
    provider_name: 'sleeper',
    evidence_source:
      'nflverse on gsis 00-0041081 (Max Bredeson, Michigan, rookie 2026, MIN, 74in/252lb -- an exact size match on a unique name); Sleeper 13516 agrees; PFR BredMa00 gives October 4, 2002, MIN 5th round 2026',
    reason: 'row held the 0000-00-00 placeholder; 2026 draft pool'
  }
]

// Six sleeper_player_id links. Each row's column was EMPTY and the SAME verdict
// was established without using the sleeper id as evidence, so recording the id
// keeps a future run from re-deriving identity -- and keeps a name-fallback
// match from writing a different human's id into the empty column.
const sleeper_player_id_overrides = [
  {
    pid: 'DEVO-GARR-002154',
    override_value: '12443',
    evidence_source:
      'TE=TE; college Pittsburg State exact; entry 2024 = Sleeper years_exp 1; weight 240=240, height 78 vs 77',
    reason: 'confirmed SAME; column was empty'
  },
  {
    pid: 'JEQU-EZZA-010179',
    override_value: '8410',
    evidence_source:
      'WR=WR; college Sam Houston State exact; entry 2022 = years_exp 1; height 70=70 and weight 195=195',
    reason: 'confirmed SAME; column was empty'
  },
  {
    pid: 'KAIR-ROBI-001627',
    override_value: '12434',
    evidence_source:
      'RB=RB; college San Jose State exact; entry 2024 = years_exp 1; height 67=67 and weight 195=195',
    reason: 'confirmed SAME; column was empty'
  },
  {
    pid: 'KYRE-DUPL-030498',
    override_value: '14056',
    evidence_source:
      'nflverse on gsis 00-0041536 (Kyre Duplessis, Delaware/Coastal Carolina WR, rookie 2026, DEN) matches Sleeper 14056 (WR, Delaware, DEN)',
    reason: 'confirmed SAME; column was empty'
  },
  {
    pid: 'NOLA-GIVA-022802',
    override_value: '8817',
    evidence_source:
      'TE=TE; college Southeastern Louisiana exact; entry 2022 = years_exp 1; height 75=75; high school matches exactly (Berkley HS [MI] against Berkley (MI))',
    reason: 'confirmed SAME; column was empty'
  },
  {
    pid: 'STEP-BAGG-023788',
    override_value: '5609',
    evidence_source:
      'HARD ID MATCH: our gsis_player_id and Sleeper 5609 gsis_id are both 00-0034494; college East Carolina and position TE agree independently',
    reason: 'confirmed SAME; column was empty'
  }
]

const overrides = [
  ...date_of_birth_overrides.map((row) => ({
    ...row,
    column_name: 'date_of_birth'
  })),
  ...sleeper_player_id_overrides.map((row) => ({
    ...row,
    column_name: 'sleeper_player_id',
    provider_name: 'sleeper'
  }))
]

const main = async () => {
  // console.log, not debug: the ESM import graph clobbers the namespace set
  // before a module-scope debug.enable runs, and a one-shot repair that writes
  // rows while printing nothing has destroyed its own audit trail.
  console.log(`seeding ${overrides.length} player field overrides`)

  let applied = 0
  let refused = 0
  let changed = 0

  for (const override of overrides) {
    const result = await set_player_field_override({
      ...override,
      adjudicated_by,
      adjudicated_at
    })

    if (result.is_applied) {
      applied += 1
    } else {
      refused += 1
      console.error(
        `REFUSED ${override.pid}.${override.column_name}: player holds ${JSON.stringify(result.live_value)}, override declares ${JSON.stringify(result.override_value)}`
      )
    }
    changed += result.changes

    console.log(
      `  ${result.is_applied ? 'ok  ' : 'FAIL'} ${override.pid}.${override.column_name} = ${JSON.stringify(override.override_value)}`
    )
  }

  const [{ count: total }] = await db('player_field_override').count(
    '* as count'
  )

  console.log(
    `declared ${overrides.length}, applied ${applied}, refused ${refused}`
  )
  console.log(
    `player rows changed: ${changed} (expected 0 -- every value was already correct)`
  )
  console.log(`player_field_override now holds ${total} row(s)`)

  // The oracle is the DISPOSITION, never the exit code of the loop. Two
  // conditions are failures: any refusal, and any write to `player`, since
  // every value here was verified present before this file was written and a
  // change means the table moved under it.
  const is_healthy = refused === 0 && changed === 0
  if (!is_healthy) {
    console.error(
      `SEED FAILED: refused=${refused} changed=${changed}; both must be 0`
    )
  }

  await db.destroy()
  process.exit(is_healthy ? 0 : 1)
}

// A relative-path invocation makes is_main false, so this file calls main()
// bare -- the convention for everything under db/. See db/README.md.
main()
