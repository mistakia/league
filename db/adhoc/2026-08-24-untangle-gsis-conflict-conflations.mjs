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

  ## Dante Barnett — THREE people on one row, not two

  `DANT-BARN-002837` IS the 2017 Kansas State Dante Barnett. The row holds his
  esb id BAR403653, his 2017-era nfl_player_id, a 2017 rookie contract, his
  Booker T. Washington (OK) high school, and combine numbers (4.67 forty, 4.21
  shuttle) no 275 lb lineman runs; its own `college_division` says Big 12 and its
  `smart_player_id` decodes to ASCII "00-0033677" in its own bytes. He is
  pro-football-reference `BarnDa03`: SS, 6-0, 192 lb, Kansas St., signed and
  released by Denver in 2017 and never active for a regular-season game.

  TWO other men are grafted onto him, and separating them is what this repair is.

  AHMED HASSANEIN, the 2025 sixth-round Boise State edge rusher (pfr `HassAh00`,
  born 2002-07-09), contributed gsis `00-0040761`, gsis_it 58805, the 6th round
  and the 196th overall pick, which is exactly his slot. He has his own row,
  `AHME-HASS-003538`, holding esb HAS512236 and that same pick and MISSING the
  gsis id, so the repair returns the id rather than merely clearing it.

  A SECOND DANTE BARNETT -- pfr `BarnDa04`, a 6-1, 275 lb defensive lineman who
  signed with Cincinnati in April 2025, spent 2025 on Green Bay's practice squad
  and signed with Cleveland in August 2026 -- contributed `date_of_birth`
  2003-02-11, `college` "Dickinson, Pa.", `weight_pounds` 275 and
  `jersey_number` 69, which his pfr page displays. He has NO row of our own, and
  that absence is the mechanism: both importers match him onto the safety BY
  NAME. The player_changelog records the collision directly -- on 2026-07-24 the
  `nfl` importer rewrote date_of_birth, college, current_nfl_team and
  jersey_number TWICE in seven minutes, flip-flopping between Hassanein's values
  (2002-07-10, Boise State, DET, 99) and this man's (2003-02-11, Dickinson Pa.,
  GB, 69). Clearing without creating his row leaves that oscillation running, so
  this repair creates it.

  ## What the changelog recovers

  The safety's own values are not lost and do not have to be nulled. On
  2025-09-17 Sleeper overwrote them in one batch, and the previous_value column
  still holds them: date_of_birth 1993-06-14, college Kansas State,
  weight_pounds 193, nfl_draft_year 2017, gsis 00-0033677, gsis_it 45551. Each
  is restored to that value rather than cleared.

  `jersey_number` is the exception and goes NULL: 69 is demonstrably the 2025
  lineman's, and the safety never played a regular-season game, so pfr displays
  no number for him and no source here gives him one.

  `height_inches` 73 is deliberately NOT touched. It predates every contaminating
  write -- the changelog carries no height change at all -- so it is the safety's
  own recorded value, and the 2025 lineman being coincidentally 6-1 is not
  evidence against a field nobody overwrote.

  ## The stat row the grafted gsis id dragged in

  `DANT-BARN-002837` carries one `player_gamelogs` row, esbid 2025080851 -- DET
  against ATL in 2025, sourced `nfl-pro-gameday-roster`, and reached only through
  the grafted gsis id. It is Hassanein's game, and its `player_position` reads DB
  because it inherited the safety's position off the row it landed on. Fixing the
  id without moving the gamelog would leave a 2025 Detroit appearance on a man
  who last dressed for Denver in 2017.

  It is repointed to `AHME-HASS-003538`, which holds no gamelogs at all, so the
  move cannot collide. The safety's own `player_seasonlogs` row (2017 PRE, DB,
  career year 1) is his and stays.

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
import { updatePlayer, createPlayer } from '#libs-server'
import set_player_field_override from '#libs-server/set-player-field-override.mjs'

const PROVIDER = 'nflverse'
const ADJUDICATED_BY = 'operator (approved 2026-08-24)'

const BARNETT_EVIDENCE =
  'nflverse weekly rosters 2017: gsis 00-0033677 is Dante Barnett, DB, Kansas State, esb BAR403653, gsis_it 45551, 193 lb. nflverse players parquet: gsis 00-0040761 is Ahmed Hassanein, DE, Boise State, esb HAS512236, born 2002-07-09, 275 lb, 2025 draft. nfl_play_stats names 00-0033677 D.Barnett on 7 rows in 2017 and 00-0040761 A.Hassanein on 6 rows in 2025. pro-football-reference BarnDa03 is the Kansas St. SS, 6-0 192, Denver 2017; BarnDa04 is a second Dante Barnett, 6-1 275, jersey 69, Cincinnati 2025 / Green Bay practice squad / Cleveland 2026. player_changelog 2025-09-17 records the overwritten values as previous_value: date_of_birth 1993-06-14, college Kansas State, weight_pounds 193, nfl_draft_year 2017.'

const ANDERSON_EVIDENCE =
  'nflverse weekly rosters 2019: gsis 00-0035138 is Ryan Anderson, P, Rutgers, esb AND490464, gsis_it 47570; gsis 00-0035335 is Ryan Anderson, OL, Wake Forest, esb AND490543, gsis_it 48464. nfl_play_stats carries 00-0035138 on stat ids 29 and 32 only, which are kicking stats.'

const BARNETT_PID = 'DANT-BARN-002837'
const HASSANEIN_PID = 'AHME-HASS-003538'
const LINEMAN_PID = 'RYAN-ANDE-004143'
const PUNTER_PID = 'RYAN-ANDE-023589'

// The second Dante Barnett, who has no row yet. Created by this script.
const BARNETT_2025_PFR_ID = 'BarnDa04'
const BARNETT_2025_PLAYER = {
  first_name: 'Dante',
  last_name: 'Barnett',
  primary_position: 'DE',
  secondary_position: 'DE',
  position_depth: 'DE',
  height_inches: 73,
  weight_pounds: 275,
  date_of_birth: '2003-02-11',
  college: 'Dickinson, Pa.',
  nfl_draft_year: 2025,
  jersey_number: 69,
  current_nfl_team: 'CLE',
  pfr_player_id: BARNETT_2025_PFR_ID
}

// Hassanein's, reached only through the gsis id grafted onto the safety's row.
const HASSANEIN_GAMELOG_ESBID = 2025080851

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
    date_of_birth: '2003-02-11',
    jersey_number: 69,
    pfr_player_id: null
  },
  [HASSANEIN_PID]: {
    last_name: 'Hassanein',
    esb_player_id: 'HAS512236',
    pfr_player_id: 'HassAh00',
    gsis_player_id: null,
    nfl_draft_year: 2025,
    draft_overall_pick: 196,
    date_of_birth: '0000-00-00'
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
    note: "Sleeper wrote 275 over 193 on 2025-09-17 alongside the 2025 lineman's birth date and college; both other men weigh 275 and the safety weighs 193",
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
    value: '1993-06-14',
    note: "2003-02-11 is the 2025 lineman's; the changelog holds the safety's own date as the value Sleeper overwrote on 2025-09-17",
    evidence_source: BARNETT_EVIDENCE
  },
  {
    kind: 'adjudicate',
    pid: BARNETT_PID,
    column_name: 'jersey_number',
    value: null,
    note: 'pfr displays 69 on BarnDa04, the 2025 lineman; the safety never dressed for a regular-season game and has no number anywhere',
    evidence_source: BARNETT_EVIDENCE
  },
  {
    kind: 'attach',
    pid: BARNETT_PID,
    update: { pfr_player_id: 'BarnDa03' },
    note: 'the safety had no pfr id, which is part of why he kept absorbing the other Dante Barnett',
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
    pid: HASSANEIN_PID,
    column_name: 'date_of_birth',
    value: '2002-07-09',
    note: "0000-00-00 is not a date; pfr and the nflverse players parquet agree on Hassanein's",
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

  /*
    The two pfr ids must be unowned, or the attach and the create would each be
    refused as a duplicate and the run would report a half-done repair.
  */
  for (const pfr_player_id of ['BarnDa03', BARNETT_2025_PFR_ID]) {
    const holders = await db('player').where({ pfr_player_id })
    if (holders.length) {
      failures.push(
        `pfr ${pfr_player_id} is already held by ${holders.map((row) => row.pid).join(', ')}`
      )
    }
  }

  /*
    Exactly one Dante Barnett row is the whole premise. A second one means
    somebody already created the 2025 lineman and this script would mint a
    duplicate rather than repair anything.
  */
  const barnetts = await db('player').where({ formatted_name: 'dante barnett' })
  if (barnetts.length !== 1 || barnetts[0].pid !== BARNETT_PID) {
    failures.push(
      `expected exactly one dante barnett row (${BARNETT_PID}), found ${barnetts.map((row) => row.pid).join(', ') || 'none'}`
    )
  }

  // The gamelog must still be on the safety, and the destination must be clear.
  const gamelog = await db('player_gamelogs')
    .where({ esbid: HASSANEIN_GAMELOG_ESBID, pid: BARNETT_PID })
    .first()
  if (!gamelog) {
    failures.push(
      `gamelog ${HASSANEIN_GAMELOG_ESBID} is no longer on ${BARNETT_PID}`
    )
  }
  const destination_gamelog = await db('player_gamelogs')
    .where({ esbid: HASSANEIN_GAMELOG_ESBID, pid: HASSANEIN_PID })
    .first()
  if (destination_gamelog) {
    failures.push(
      `${HASSANEIN_PID} already holds gamelog ${HASSANEIN_GAMELOG_ESBID}; the repoint would collide`
    )
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
  console.log(
    `  CREATE a row for the 2025 Dante Barnett — ${JSON.stringify(BARNETT_2025_PLAYER)}`
  )
  console.log(
    `  MOVE player_gamelogs esbid ${HASSANEIN_GAMELOG_ESBID} from ${BARNETT_PID} to ${HASSANEIN_PID} — Hassanein's 2025 DET game, reached only through the grafted gsis id`
  )
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
  The 2025 Dante Barnett's own row. Created AFTER the safety's writes, so the
  jersey number, birth date and college it carries are no longer duplicated on a
  row the importers would rather match.

  createPlayer swallows its own insert error and returns null, so a null return
  is reported as a failure rather than read as a no-op.
*/
const create_2025_barnett = async () => {
  const created = await createPlayer({ ...BARNETT_2025_PLAYER })
  if (!created) {
    return {
      pid: null,
      failure:
        'createPlayer returned null for the 2025 Dante Barnett (see the create-player log)'
    }
  }
  console.log(
    `created ${created.pid} for the 2025 Dante Barnett, pfr ${BARNETT_2025_PFR_ID}`
  )
  return { pid: created.pid, failure: null }
}

const move_hassanein_gamelog = async () => {
  const moved = await db('player_gamelogs')
    .where({ esbid: HASSANEIN_GAMELOG_ESBID, pid: BARNETT_PID })
    .update({ pid: HASSANEIN_PID })
  console.log(
    `moved ${moved} gamelog row(s) for esbid ${HASSANEIN_GAMELOG_ESBID} to ${HASSANEIN_PID}`
  )
  return moved === 1
    ? null
    : `expected to move exactly 1 gamelog row, moved ${moved}`
}

/*
  The end state, asserted rather than assumed. Each id must sit on exactly one
  row and it must be the right one -- which is the invariant the conflation broke
  and the only thing worth checking after a repair whose whole content is moving
  ids between rows.
*/
const verify = async (created_2025_pid) => {
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

  const pfr_owner = {
    BarnDa03: BARNETT_PID,
    [BARNETT_2025_PFR_ID]: created_2025_pid,
    HassAh00: HASSANEIN_PID
  }
  for (const [pfr_player_id, pid] of Object.entries(pfr_owner)) {
    const rows = await db('player').where({ pfr_player_id })
    if (rows.length !== 1 || rows[0].pid !== pid) {
      failures.push(
        `pfr ${pfr_player_id} is held by ${rows.map((row) => row.pid).join(', ') || 'none'}, expected ${pid}`
      )
    }
  }

  /*
    The separation itself, asserted on the fields that were fused. Checking the
    ids alone would pass on a row that still carried the other man's birth date.
  */
  const safety = await db('player').where({ pid: BARNETT_PID }).first()
  const safety_expected = {
    date_of_birth: '1993-06-14',
    college: 'Kansas State',
    weight_pounds: 193,
    nfl_draft_year: 2017,
    jersey_number: null,
    draft_round: null,
    draft_overall_pick: null
  }
  for (const [column, value] of Object.entries(safety_expected)) {
    const found = safety[column]
    const matches = value === null ? !found : String(found) === String(value)
    if (!matches) {
      failures.push(
        `${BARNETT_PID}.${column} holds ${JSON.stringify(found)}, expected ${JSON.stringify(value)}`
      )
    }
  }

  const gamelogs = await db('player_gamelogs').where({
    esbid: HASSANEIN_GAMELOG_ESBID
  })
  const gamelog_pids = gamelogs.map((row) => row.pid)
  if (gamelog_pids.includes(BARNETT_PID)) {
    failures.push(
      `gamelog ${HASSANEIN_GAMELOG_ESBID} is still on ${BARNETT_PID}`
    )
  }
  if (!gamelog_pids.includes(HASSANEIN_PID)) {
    failures.push(
      `gamelog ${HASSANEIN_GAMELOG_ESBID} did not land on ${HASSANEIN_PID}`
    )
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

  const { pid: created_2025_pid, failure: create_failure } =
    await create_2025_barnett()
  if (create_failure) unapplied.push(create_failure)

  const move_failure = await move_hassanein_gamelog()
  if (move_failure) unapplied.push(move_failure)

  const failures = await verify(created_2025_pid)

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
    '\nverified: every gsis, esb, gsis_it and pfr id above is held by exactly one row and it is the right one; the safety carries his own birth date, college, weight and draft year; and Hassanein carries his own 2025 gamelog'
  )

  await db.destroy()
  process.exit(0)
}

main().catch(async (err) => {
  console.error(err.message)
  await db.destroy()
  process.exit(1)
})
