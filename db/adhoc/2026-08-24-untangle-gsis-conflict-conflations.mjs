/*
  The two `review_gsis_id_conflict` ids, and both of them turned out to be the
  incumbent holding SOMEONE ELSE'S identifier -- but not the someone the survey
  named.

  ## What the feed actually says

  nflverse's weekly rosters and players parquet are both gsis-keyed and carry the
  esb id alongside, so neither of these is decided on a name:

    00-0033677  Dante Barnett     DB   Kansas State   esb BAR403653  gsis_it 45551  (2017 DEN)
    00-0040761  Ahmed Hassanein   DE   Boise State    esb HAS512236  born 2002-07-09, 275 lb, 2025 draft
    00-0035138  Ryan Anderson     P    Rutgers        esb AND490464  gsis_it 47570  (2019 NYG)
    00-0035335  Ryan Anderson     OL   Wake Forest    esb AND490543  gsis_it 48464  (2019 NYJ)

  The NFL's own play ledger corroborates both gsis ids independently: it names
  `00-0033677` `D.Barnett` on 7 stat rows across three 2017 preseason games, and
  `00-0040761` `A.Hassanein` on 6 rows in 2025. `00-0035138` carries 3 rows in a
  2019 preseason game, all of them stat ids 29 and 32 -- kicking stats, which
  only a K or a P records.

  ## Dante Barnett — the survey had the direction backwards

  `DANT-BARN-002837` IS the 2017 Kansas State Dante Barnett. The row holds his
  esb id BAR403653, his 2017-era nfl_player_id, a 2017 rookie contract, and his
  Booker T. Washington (OK) high school, and its own `college_division` says Big
  12. Its `smart_player_id` decodes to ASCII "00-0033677" in its own bytes.

  What is grafted onto it is AHMED HASSANEIN, the 2025 sixth-round Boise State
  edge rusher: gsis `00-0040761`, the 2025 draft year, the 6th round and the
  196th overall pick -- which is exactly Hassanein's slot -- and his 275 lb
  playing weight on a row whose own height is a 6-foot-1 defensive back's.

  Hassanein has his own row, `AHME-HASS-003538`, correctly holding esb HAS512236
  and the same 2025 pick, and MISSING the gsis id sitting on Barnett's row. So
  the repair does not merely clear: it returns each id to its owner.

  Two contaminated fields belong to a third party and are cleared rather than
  corrected, because nothing here establishes a right value:

  - `date_of_birth` 2003-02-11 is neither man's. Hassanein was born 2002-07-09
    and Barnett was a 2017 rookie, so a 2003 birth date would make him fourteen.
  - `jersey_number` 69 on a 193 lb defensive back is impossible under the NFL's
    own numbering, but no source here says whose it is. It is left alone and
    recorded as a finding rather than guessed at.

  ## Ryan Anderson — the incumbent is right and holds TWO of the punter's ids

  `RYAN-ANDE-004143` is coherently the Wake Forest offensive lineman: 6-foot-6,
  305 lb, ACC, a 2019 contract, and combine numbers (5.31 forty, 21 bench) no
  punter posts. Its own gsis `00-0035335` is correct.

  What it holds wrongly is the PUNTER's esb id AND490464 and the punter's
  gsis_it 47570. The lineman's own values are AND490543 and 48464, and the feed
  states both.

  The punter has a row too -- `RYAN-ANDE-023589`, Rutgers, 6-foot-1, listed K --
  carrying no gsis, no esb and no gsis_it at all. Every id this repair frees
  belongs there.

  ## Ordering, which is not cosmetic

  updatePlayer refuses to write an external id another row already holds, and
  that guard is what mechanically enforces the sequence: every adjudicated write happens
  before the matching ATTACH. Run in the other order, the attach is skipped and
  the override is left declared-but-unapplied for the drift check to report.

  Adjudicated writes go through `set_player_field_override` rather than a bare
  updatePlayer, because every one of them contradicts a value an importer wrote
  and would write back. The attaches onto EMPTY columns are plain updates: no
  provider is contradicting them, and an importer writing the same value later
  is the desired outcome rather than drift.

  Default is a dry run. --apply is required to write anything.
*/

import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { updatePlayer } from '#libs-server'
import set_player_field_override from '#libs-server/set-player-field-override.mjs'

const PROVIDER = 'nflverse'
const ADJUDICATED_BY = 'operator (approved 2026-08-24)'

const BARNETT_EVIDENCE =
  'nflverse weekly rosters 2017: gsis 00-0033677 is Dante Barnett, DB, Kansas State, esb BAR403653, gsis_it 45551, 193 lb. nflverse players parquet: gsis 00-0040761 is Ahmed Hassanein, DE, Boise State, esb HAS512236, born 2002-07-09, 275 lb, 2025 draft. nfl_play_stats names 00-0033677 D.Barnett on 7 rows in 2017 and 00-0040761 A.Hassanein on 6 rows in 2025.'

const ANDERSON_EVIDENCE =
  'nflverse weekly rosters 2019: gsis 00-0035138 is Ryan Anderson, P, Rutgers, esb AND490464, gsis_it 47570; gsis 00-0035335 is Ryan Anderson, OL, Wake Forest, esb AND490543, gsis_it 48464. nfl_play_stats carries 00-0035138 on stat ids 29 and 32 only, which are kicking stats.'

const BARNETT_PID = 'DANT-BARN-002837'
const HASSANEIN_PID = 'AHME-HASS-003538'
const LINEMAN_PID = 'RYAN-ANDE-004143'
const PUNTER_PID = 'RYAN-ANDE-023589'

/*
  The preconditions. A row that has moved since this was adjudicated -- picked up
  the id elsewhere, been merged by a sibling session, had a field corrected --
  fails here and nothing is written, rather than the script writing over a
  situation it no longer describes.
*/
const EXPECT = {
  [BARNETT_PID]: {
    last_name: 'Barnett',
    esb_player_id: 'BAR403653',
    gsis_player_id: '00-0040761',
    gsis_it_player_id: 58805,
    nfl_draft_year: 2025,
    draft_round: 6,
    draft_overall_pick: 196,
    weight_pounds: 275,
    college: 'Dickinson, Pa.',
    date_of_birth: '2003-02-11'
  },
  [HASSANEIN_PID]: {
    last_name: 'Hassanein',
    esb_player_id: 'HAS512236',
    gsis_player_id: null,
    nfl_draft_year: 2025,
    draft_overall_pick: 196
  },
  [LINEMAN_PID]: {
    last_name: 'Anderson',
    primary_position: 'OL',
    college: 'Wake Forest',
    gsis_player_id: '00-0035335',
    esb_player_id: 'AND490464',
    gsis_it_player_id: 47570
  },
  [PUNTER_PID]: {
    last_name: 'Anderson',
    college: 'Rutgers',
    gsis_player_id: null,
    esb_player_id: null,
    gsis_it_player_id: null
  }
}

/*
  Ordered, and the order is load-bearing: each ADJUDICATED write frees an id the ATTACH
  below it would otherwise be refused.
*/
const WRITES = [
  {
    kind: 'adjudicate',
    pid: BARNETT_PID,
    column_name: 'gsis_player_id',
    value: '00-0033677',
    note: "Hassanein's gsis id off Barnett's row, replaced by Barnett's own",
    evidence_source: BARNETT_EVIDENCE
  },
  {
    kind: 'adjudicate',
    pid: BARNETT_PID,
    column_name: 'gsis_it_player_id',
    value: 45551,
    note: "58805 is a 2025-era id; the feed states Barnett's as 45551",
    evidence_source: BARNETT_EVIDENCE
  },
  {
    kind: 'adjudicate',
    pid: BARNETT_PID,
    column_name: 'nfl_draft_year',
    value: 2017,
    note: "Hassanein's 2025 replaced by Barnett's entry year, which the roster and the 2017 stat rows both give",
    evidence_source: BARNETT_EVIDENCE
  },
  {
    kind: 'adjudicate',
    pid: BARNETT_PID,
    column_name: 'draft_round',
    value: null,
    note: "Hassanein's 6th round; Barnett went undrafted",
    evidence_source: BARNETT_EVIDENCE
  },
  {
    kind: 'adjudicate',
    pid: BARNETT_PID,
    column_name: 'draft_overall_pick',
    value: null,
    note: "Hassanein's 196th overall; Barnett went undrafted",
    evidence_source: BARNETT_EVIDENCE
  },
  {
    kind: 'adjudicate',
    pid: BARNETT_PID,
    column_name: 'weight_pounds',
    value: 193,
    note: "275 is Hassanein's listed weight; the roster gives Barnett 193",
    evidence_source: BARNETT_EVIDENCE
  },
  {
    kind: 'adjudicate',
    pid: BARNETT_PID,
    column_name: 'college',
    value: 'Kansas State',
    note: "the row's own college_division already says Big 12",
    evidence_source: BARNETT_EVIDENCE
  },
  {
    kind: 'adjudicate',
    pid: BARNETT_PID,
    column_name: 'date_of_birth',
    value: null,
    note: '2003-02-11 belongs to neither man and no source here gives Barnett a birth date',
    evidence_source: BARNETT_EVIDENCE
  },
  {
    kind: 'attach',
    pid: HASSANEIN_PID,
    update: { gsis_player_id: '00-0040761' },
    note: "the id Barnett's row was holding, returned to its owner",
    evidence_source: BARNETT_EVIDENCE
  },
  {
    kind: 'adjudicate',
    pid: LINEMAN_PID,
    column_name: 'esb_player_id',
    value: 'AND490543',
    note: "the punter's AND490464 replaced by the lineman's own",
    evidence_source: ANDERSON_EVIDENCE
  },
  {
    kind: 'adjudicate',
    pid: LINEMAN_PID,
    column_name: 'gsis_it_player_id',
    value: 48464,
    note: "the punter's 47570 replaced by the lineman's own",
    evidence_source: ANDERSON_EVIDENCE
  },
  {
    kind: 'attach',
    pid: PUNTER_PID,
    update: {
      gsis_player_id: '00-0035138',
      esb_player_id: 'AND490464',
      gsis_it_player_id: 47570
    },
    note: "the three ids the lineman's row was holding, returned to their owner",
    evidence_source: ANDERSON_EVIDENCE
  }
]

const check_preconditions = async () => {
  const failures = []
  for (const [pid, expected] of Object.entries(EXPECT)) {
    const row = await db('player').where({ pid }).first()
    if (!row) {
      failures.push(`${pid} no longer exists`)
      continue
    }
    for (const [column, value] of Object.entries(expected)) {
      const found = row[column]
      const matches =
        value === null
          ? found === null || found === '' || found === undefined
          : String(found) === String(value)
      if (!matches) {
        failures.push(
          `${pid}.${column} expected ${JSON.stringify(value)}, found ${JSON.stringify(found)}`
        )
      }
    }
  }
  return failures
}

const describe = () => {
  for (const write of WRITES) {
    if (write.kind === 'adjudicate') {
      console.log(
        `  ${write.pid}.${write.column_name} := ${JSON.stringify(write.value)} — ${write.note}`
      )
    } else {
      console.log(
        `  ${write.pid} attach ${JSON.stringify(write.update)} — ${write.note}`
      )
    }
  }
}

const apply_writes = async () => {
  const unapplied = []
  for (const write of WRITES) {
    if (write.kind === 'adjudicate') {
      const result = await set_player_field_override({
        pid: write.pid,
        column_name: write.column_name,
        override_value: write.value,
        provider_name: PROVIDER,
        adjudicated_by: ADJUDICATED_BY,
        evidence_source: write.evidence_source,
        reason: `identity repair: ${write.note}`
      })
      console.log(
        `${write.pid}.${write.column_name} ${result.is_applied ? 'applied' : 'DECLARED BUT NOT APPLIED'} — holds ${JSON.stringify(result.live_value)}`
      )
      if (!result.is_applied) {
        unapplied.push(`${write.pid}.${write.column_name}`)
      }
      continue
    }

    const changes = await updatePlayer({
      pid: write.pid,
      update: write.update,
      source: 'adhoc/2026-08-24-untangle-gsis-conflict-conflations',
      reason: `identity repair: ${write.note}`
    })
    const row = await db('player').where({ pid: write.pid }).first()
    for (const [column, value] of Object.entries(write.update)) {
      const applied = String(row[column]) === String(value)
      console.log(
        `${write.pid}.${column} ${applied ? 'attached' : 'NOT ATTACHED'} — holds ${JSON.stringify(row[column])}`
      )
      if (!applied) unapplied.push(`${write.pid}.${column}`)
    }
    if (!changes) {
      console.log(`  (updatePlayer reported no change on ${write.pid})`)
    }
  }
  return unapplied
}

/*
  The end state, asserted rather than assumed. Each id must sit on exactly one
  row and it must be the right one -- which is the invariant the conflation broke
  and the only thing worth checking after a repair whose whole content is moving
  ids between rows.
*/
const verify = async () => {
  const expected_owner = {
    '00-0033677': BARNETT_PID,
    '00-0040761': HASSANEIN_PID,
    '00-0035138': PUNTER_PID,
    '00-0035335': LINEMAN_PID
  }
  const failures = []

  for (const [gsis_player_id, pid] of Object.entries(expected_owner)) {
    const rows = await db('player').where({ gsis_player_id })
    if (rows.length !== 1) {
      failures.push(
        `${gsis_player_id} is held by ${rows.length} rows (${rows.map((row) => row.pid).join(', ') || 'none'})`
      )
      continue
    }
    if (rows[0].pid !== pid) {
      failures.push(
        `${gsis_player_id} is held by ${rows[0].pid}, expected ${pid}`
      )
    }
  }

  const esb_owner = {
    BAR403653: BARNETT_PID,
    HAS512236: HASSANEIN_PID,
    AND490464: PUNTER_PID,
    AND490543: LINEMAN_PID
  }
  for (const [esb_player_id, pid] of Object.entries(esb_owner)) {
    const rows = await db('player').where({ esb_player_id })
    if (rows.length !== 1 || rows[0].pid !== pid) {
      failures.push(
        `esb ${esb_player_id} is held by ${rows.map((row) => row.pid).join(', ') || 'none'}, expected ${pid}`
      )
    }
  }

  const gsis_it_owner = {
    45551: BARNETT_PID,
    47570: PUNTER_PID,
    48464: LINEMAN_PID
  }
  for (const [gsis_it_player_id, pid] of Object.entries(gsis_it_owner)) {
    const rows = await db('player').where({ gsis_it_player_id })
    if (rows.length !== 1 || rows[0].pid !== pid) {
      failures.push(
        `gsis_it ${gsis_it_player_id} is held by ${rows.map((row) => row.pid).join(', ') || 'none'}, expected ${pid}`
      )
    }
  }

  return failures
}

const main = async () => {
  const argv = yargs(hideBin(process.argv)).option('apply', {
    type: 'boolean',
    default: false,
    describe: 'perform the writes; omit for a dry run'
  }).argv

  const precondition_failures = await check_preconditions()
  if (precondition_failures.length) {
    for (const failure of precondition_failures) {
      console.log(`PRECONDITION FAILED — ${failure}`)
    }
    throw new Error(
      'the adjudication no longer describes these rows; nothing written'
    )
  }
  console.log('preconditions hold for all four rows\n')
  describe()

  if (!argv.apply) {
    console.log('\nDRY RUN — nothing written. Pass --apply to write.')
    await db.destroy()
    process.exit(0)
  }

  console.log('')
  const unapplied = await apply_writes()
  const failures = await verify()

  for (const entry of unapplied) {
    console.log(`NOT APPLIED — ${entry}`)
  }
  for (const failure of failures) {
    console.log(`VERIFY FAILURE — ${failure}`)
  }
  if (unapplied.length || failures.length) {
    throw new Error(
      `${unapplied.length} write(s) did not apply and ${failures.length} ownership check(s) failed`
    )
  }

  console.log(
    '\nverified: every gsis, esb and gsis_it id above is held by exactly one row, and it is the right one'
  )
  console.log(
    'NOT REPAIRED, recorded as a finding: DANT-BARN-002837 carries jersey_number 69, which no 193 lb defensive back wears and which no source here attributes to anyone'
  )

  await db.destroy()
  process.exit(0)
}

main().catch(async (err) => {
  console.error(err.message)
  await db.destroy()
  process.exit(1)
})
