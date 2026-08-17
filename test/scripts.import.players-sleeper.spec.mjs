/* global describe before after it beforeEach */

import * as chai from 'chai'

import db from '#db'
import run from '#scripts/import-players-sleeper.mjs'
import { format_player_name } from '#libs-shared'

const expect = chai.expect

/*
  Drives the SHIPPED importer through run() with globalThis.fetch stubbed, rather
  than asserting on a hand-written copy of the createPlayer payload.

  That distinction is the whole point of the file. The outage this covers was a
  payload naming a column that does not exist (`start`, renamed to
  `nfl_draft_year` by 9631a948c and never swept here), which raised Postgres
  42703 on every creation for fourteen months. A spec inspecting the payload
  OBJECT passes at the broken revision -- the object is well-formed JavaScript --
  so only executing the insert distinguishes a well-formed payload naming a real
  column from one naming a phantom. And a hand-written payload copy is red only
  because the author typed the bad column into the spec, then goes green forever
  while the importer drifts again.

  fetch_with_retry({ use_proxy: false }) reaches a bare `fetch` (proxy-manager.mjs
  :585), so a stub on globalThis.fetch exercises the importer's own payload
  construction end to end.
*/

// createPlayer's required set (create-player.mjs). A synthetic item missing any
// of these is REFUSED before the insert, so the run never reaches the defect and
// the spec would be green at broken for the wrong reason.
const sleeper_item = ({
  sleeper_id,
  first_name,
  last_name,
  position = 'WR',
  birth_date,
  rookie_year,
  team = null,
  college = 'Test University',
  injury_status = null,
  sportradar_id = null,
  yahoo_id = null
}) => ({
  player_id: sleeper_id,
  full_name: `${first_name} ${last_name}`,
  first_name,
  last_name,
  position,
  team,
  height: '72',
  weight: '200',
  number: 80,
  college,
  birth_date,
  injury_status,
  status: 'Active',
  active: true,
  sportradar_id,
  yahoo_id,
  metadata: rookie_year === undefined ? {} : { rookie_year }
})

/*
  format_player_name STRIPS DIGITS, so `Person0` and `Person1` both format to
  `person` -- two fixtures distinguished only by a numeral are ONE name to the
  matcher, and the second silently resolves to the first. Every generated name
  here is therefore alphabetic.
*/
const alphabetic_suffix = (index) => {
  let value = index
  let suffix = ''
  do {
    suffix = String.fromCharCode(97 + (value % 26)) + suffix
    value = Math.floor(value / 26)
  } while (value > 0)
  return suffix.charAt(0).toUpperCase() + suffix.slice(1)
}

// Fixtures must be unique across the whole FILE, not just within one test: rows
// created by an earlier test are still present, so a repeated name would resolve
// to `exists` and quietly change the next test's counts.
let fixture_sequence = 0
const next_fixture_name = (stem) =>
  `${stem}${alphabetic_suffix(fixture_sequence++)}`

// player.sleeper_player_id is varchar(11), so a descriptive synthetic id overruns
// the column and createPlayer fails the INSERT rather than the required-field
// check -- which then reads as a writer fault in the disposition counts.
let sleeper_id_sequence = 9000000
const next_sleeper_id = () => String(sleeper_id_sequence++)

const stub_payload = (items) => {
  const payload = {}
  for (const item of items) {
    payload[item.player_id] = item
  }
  globalThis.fetch = async () => ({
    ok: true,
    status: 200,
    json: async () => payload
  })
}

/*
  The in-season monitors (players_with_injury_status >= 5, plus a 48h
  source='sleeper' injury_status changelog write) sit behind `is_offseason`,
  which is a module-level const captured at IMPORT time -- so MockDate cannot
  move it and the branch taken depends on the day the suite runs. Satisfying both
  monitors unconditionally is what keeps this spec from turning red on its own in
  week 1 without any code change.
*/
const FILLER_COUNT = 6
const injury_filler = () =>
  Array.from({ length: FILLER_COUNT }, (_, index) => {
    const last_name = next_fixture_name('Filler')
    return sleeper_item({
      sleeper_id: next_sleeper_id(),
      first_name: 'Injury',
      last_name,
      birth_date: `1990-01-0${index + 1}`,
      rookie_year: '2012',
      injury_status: 'Questionable'
    })
  })

/*
  The shipped bounds are calibrated to a 12,219-entry payload (skipped_exists
  50-120, created ceiling 550), which a stub-driven run cannot satisfy. Overriding
  them is what lets these tests exercise the ORACLE'S LOGIC at spec scale rather
  than needing production-sized fixtures -- the same reason payload_floor is
  injectable. Each threshold test then narrows exactly the bound it is about.
*/
const SPEC_BOUNDS = {
  updated_by_sleeper_id_floor: 0,
  skipped_exists_floor: 0,
  skipped_exists_ceiling: 1000,
  skipped_unknown_floor: 0,
  skipped_unknown_ceiling: 1000,
  created_ceiling: 1000,
  // Neutralised for the same reason as the rest: at spec scale one added
  // no-position fixture crosses the shipped 10% ratio, so leaving it live would
  // turn a behaviour test red on an unrelated fixture edit.
  unusable_entry_ceiling_ratio: 1
}

const spec_run = ({ payload_floor = 1, bounds = {} } = {}) =>
  run({ payload_floor, bounds: { ...SPEC_BOUNDS, ...bounds } })

const seed_player = ({
  pid,
  first_name,
  last_name,
  date_of_birth,
  primary_position = 'WR',
  current_nfl_team = 'KC',
  nfl_draft_year = null,
  sleeper_player_id = null,
  sportradar_player_id = null,
  yahoo_player_id = null
}) =>
  db('player').insert({
    pid,
    first_name,
    last_name,
    short_name: `${first_name[0]}.${last_name}`,
    formatted_name: format_player_name(`${first_name} ${last_name}`),
    primary_position,
    secondary_position: primary_position,
    current_nfl_team,
    date_of_birth,
    nfl_draft_year,
    sleeper_player_id,
    sportradar_player_id,
    yahoo_player_id
  })

const created_row = (sleeper_id) =>
  db('player').where({ sleeper_player_id: sleeper_id }).first()

describe('SCRIPTS import-players-sleeper', function () {
  this.timeout(30000)

  let original_fetch

  before(function () {
    original_fetch = globalThis.fetch
  })

  after(function () {
    globalThis.fetch = original_fetch
  })

  beforeEach(async function () {
    /*
      observed_at is derived from a MODULE-LEVEL timestamp, so it is identical for
      every run inside one mocha process and players_status has a unique
      (pid, observed_at). Clearing it is what lets several runs share a process.
    */
    await db('players_status').del()

    // The blackout monitor's 48h window, satisfied so the spec is clock-independent.
    await db('player_changelog').insert({
      pid: 'SEED-CHNG-000001',
      column_name: 'injury_status',
      previous_value: 'Healthy',
      new_value: 'Questionable',
      source: 'sleeper',
      changed_at: new Date()
    })
  })

  describe('the create path executes the insert', function () {
    it('creates a row and sources nfl_draft_year from rookie_year', async function () {
      stub_payload([
        ...injury_filler(),
        sleeper_item({
          sleeper_id: 'new-rookie',
          first_name: 'Brandnew',
          last_name: 'Rookie',
          birth_date: '2003-05-05',
          rookie_year: '2026'
        })
      ])

      const { shortfall, counts } = await spec_run()

      const row = await created_row('new-rookie')
      expect(row).to.exist
      // The assertion that catches a rename-only fix: the column resolves AND is
      // populated from the key the data actually carries.
      expect(row.nfl_draft_year).to.equal(2026)
      expect(counts.created).to.equal(FILLER_COUNT + 1)
      expect(counts.failed).to.equal(0)
      expect(counts.threw).to.equal(0)
      expect(shortfall).to.equal(null)
    })

    it("coerces a rookie_year of '0' to NULL rather than 0", async function () {
      stub_payload([
        ...injury_filler(),
        sleeper_item({
          sleeper_id: 'zeroyr',
          first_name: 'Zeroyear',
          last_name: 'Player',
          birth_date: '1995-03-03',
          rookie_year: '0'
        })
      ])

      await spec_run()

      const row = await created_row('zeroyr')
      expect(row).to.exist
      // '0' is a truthy string and 91 payload entries carry it, so an unguarded
      // source inserts integer 0 and the row fails every draft-year screen.
      expect(row.nfl_draft_year).to.equal(null)
    })

    it('coerces an absent rookie_year to NULL', async function () {
      stub_payload([
        ...injury_filler(),
        sleeper_item({
          sleeper_id: 'noyr',
          first_name: 'Noyear',
          last_name: 'Player',
          birth_date: '1996-04-04'
        })
      ])

      await spec_run()

      const row = await created_row('noyr')
      expect(row).to.exist
      expect(row.nfl_draft_year).to.equal(null)
    })
  })

  describe('the canonical-existence check refuses a create', function () {
    it('does NOT create a second row for a name + birth-date match, and leaves the existing row alone', async function () {
      await seed_player({
        pid: 'EXIS-PLAY-000001',
        first_name: 'Existing',
        last_name: 'Player',
        date_of_birth: '1998-07-07',
        current_nfl_team: 'KC'
      })

      stub_payload([
        ...injury_filler(),
        // Sleeper reports him as a free agent while our row carries his last real
        // team, so the importer's narrow find_player_row fallback (teams: [team,
        // 'INA']) misses him -- which is the exact mechanism that would have
        // written 109 rows for people already in the table.
        sleeper_item({
          sleeper_id: 'dupcand',
          first_name: 'Existing',
          last_name: 'Player',
          birth_date: '1998-07-07',
          rookie_year: '2021',
          team: null
        })
      ])

      const { counts } = await spec_run()

      const rows = await db('player').where({
        formatted_name: format_player_name('Existing Player')
      })
      expect(rows.length).to.equal(1)
      // Skip-only: the resolver refuses the create and writes nothing at all, so
      // the existing row does not acquire the Sleeper id either.
      expect(rows[0].sleeper_player_id).to.equal(null)
      expect(counts.skipped_exists).to.equal(1)
      expect(counts.created).to.equal(FILLER_COUNT)
    })

    it('does NOT create when both birth dates are real and DIFFER', async function () {
      await seed_player({
        pid: 'SAME-NAME-000001',
        first_name: 'Sharedname',
        last_name: 'Person',
        date_of_birth: '1999-01-01'
      })

      stub_payload([
        ...injury_filler(),
        sleeper_item({
          sleeper_id: 'diffdob',
          first_name: 'Sharedname',
          last_name: 'Person',
          birth_date: '2002-09-09',
          rookie_year: '2025'
        })
      ])

      const { counts } = await spec_run()

      /*
        The previous design created here, calling these "different people who
        share a name". Adjudicated against nflverse and Pro Football Reference on
        2026-08-17: of the 16 live candidates in this state, 10 were ONE person
        with a noisy birth date and only 6 were genuinely different. So the whole
        bucket resolves to skip, and this assertion is the one that would have
        prevented ~9 duplicate rows.
      */
      const rows = await db('player').where({
        formatted_name: format_player_name('Sharedname Person')
      })
      expect(rows.length).to.equal(1)
      expect(counts.skipped_unknown).to.equal(1)
    })

    it('does NOT create when the payload carries no birth date and a name matches', async function () {
      await seed_player({
        pid: 'NODO-BPAY-000001',
        first_name: 'Nodob',
        last_name: 'Payload',
        date_of_birth: '1997-02-02'
      })

      stub_payload([
        ...injury_filler(),
        sleeper_item({
          sleeper_id: 'nodobpay',
          first_name: 'Nodob',
          last_name: 'Payload',
          rookie_year: '2024'
        })
      ])

      const { counts } = await spec_run()

      const rows = await db('player').where({
        formatted_name: format_player_name('Nodob Payload')
      })
      expect(rows.length).to.equal(1)
      expect(counts.skipped_unknown).to.equal(1)
    })

    it("does NOT create when our row's birth date is the '0000-00-00' placeholder", async function () {
      await seed_player({
        pid: 'PLAC-EHOL-000001',
        first_name: 'Placeheld',
        last_name: 'Person',
        date_of_birth: '0000-00-00'
      })

      stub_payload([
        ...injury_filler(),
        sleeper_item({
          sleeper_id: 'oursunk',
          first_name: 'Placeheld',
          last_name: 'Person',
          birth_date: '2001-06-06',
          rookie_year: '2023'
        })
      ])

      const { counts } = await spec_run()

      // The placeholder is the established "never learned" value, and it can
      // neither confirm nor deny identity. Resolving it to a match would write a
      // Sleeper id onto a different person.
      const rows = await db('player').where({
        formatted_name: format_player_name('Placeheld Person')
      })
      expect(rows.length).to.equal(1)
      expect(counts.skipped_unknown).to.equal(1)
    })

    it('DOES create when no row carries the name', async function () {
      await seed_player({
        pid: 'UNRE-LATE-000001',
        first_name: 'Unrelated',
        last_name: 'Person',
        date_of_birth: '1994-04-04'
      })

      stub_payload([
        ...injury_filler(),
        sleeper_item({
          sleeper_id: 'newperson',
          first_name: 'Genuinely',
          last_name: 'Newperson',
          birth_date: '2004-08-08',
          rookie_year: '2026'
        })
      ])

      const { counts } = await spec_run()

      const row = await created_row('newperson')
      expect(row).to.exist
      expect(counts.skipped_exists).to.equal(0)
      expect(counts.skipped_unknown).to.equal(0)
    })

    it('matches through player_aliases, not just formatted_name', async function () {
      await seed_player({
        pid: 'ALIA-SEDP-000001',
        first_name: 'Robert',
        last_name: 'Aliasperson',
        date_of_birth: '1993-03-13'
      })
      await db('player_aliases').insert({
        pid: 'ALIA-SEDP-000001',
        formatted_alias: format_player_name('Bobby Aliasperson')
      })

      stub_payload([
        ...injury_filler(),
        sleeper_item({
          sleeper_id: 'aliascand',
          first_name: 'Bobby',
          last_name: 'Aliasperson',
          birth_date: '1993-03-13',
          rookie_year: '2016'
        })
      ])

      const { counts } = await spec_run()

      expect(await created_row('aliascand')).to.not.exist
      expect(counts.skipped_exists).to.equal(1)
    })

    it('does NOT throw MatchedMultiplePlayers when one pid holds two aliases', async function () {
      await seed_player({
        pid: 'TWOA-LIAS-000001',
        first_name: 'Tre',
        last_name: 'Twoalias',
        date_of_birth: '2000-10-10'
      })
      await db('player_aliases').insert([
        {
          pid: 'TWOA-LIAS-000001',
          formatted_alias: format_player_name('Trey Twoalias')
        },
        {
          pid: 'TWOA-LIAS-000001',
          formatted_alias: format_player_name('Trevor Twoalias')
        }
      ])

      stub_payload([
        ...injury_filler(),
        sleeper_item({
          sleeper_id: 'twoalias',
          first_name: 'Trey',
          last_name: 'Twoalias',
          birth_date: '2000-10-10',
          rookie_year: '2022'
        })
      ])

      // find_player_row's leftJoin on player_aliases is not deduplicated by pid,
      // so a pid holding two alias rows comes back twice there. The resolver uses
      // a subquery instead; this pins that it does not inherit the defect.
      const { counts, shortfall } = await spec_run()

      expect(counts.skipped_exists).to.equal(1)
      expect(shortfall).to.equal(null)
    })

    /*
      The name rungs cannot reach an abbreviated first name: format_player_name
      maps "E.J. Jenkins" to `ej jenkins` and the stored row to `emanuel
      jenkins`, which share no token. Production ran into exactly this on
      2026-08-17 -- the resolver returned `new`, the insert went out, and
      Postgres refused it on the sportradar UNIQUE index, which the importer
      counted as `failed` and reported as a shortfall on EVERY run thereafter.
    */
    it('refuses a create when another row already holds an incoming unique external id', async function () {
      await seed_player({
        pid: 'EMAN-JENK-000001',
        first_name: 'Emanuel',
        last_name: 'Jenkins',
        date_of_birth: '0000-00-00',
        sportradar_player_id: 'sr-emanuel-jenkins'
      })

      const sleeper_id = next_sleeper_id()
      stub_payload([
        ...injury_filler(),
        sleeper_item({
          sleeper_id,
          first_name: 'E.J.',
          last_name: 'Jenkins',
          birth_date: '1998-11-03',
          rookie_year: '2023',
          sportradar_id: 'sr-emanuel-jenkins'
        })
      ])

      const { counts, shortfall } = await spec_run()

      // The disposition that matters: a REFUSAL the resolver owns, not a
      // writer FAILURE the database owns.
      expect(counts.skipped_exists).to.equal(1)
      expect(counts.created).to.equal(FILLER_COUNT)
      expect(counts.failed).to.equal(0)
      expect(shortfall).to.equal(null)
      expect(await created_row(sleeper_id)).to.equal(undefined)
    })

    it('checks every unique external id, not just sportradar', async function () {
      await seed_player({
        pid: 'MARC-HARR-000001',
        first_name: 'Marcus',
        last_name: 'Harris',
        date_of_birth: '1989-03-01',
        yahoo_player_id: 987654
      })

      const sleeper_id = next_sleeper_id()
      stub_payload([
        ...injury_filler(),
        sleeper_item({
          sleeper_id,
          first_name: 'M',
          last_name: 'Harris',
          birth_date: '1989-03-01',
          rookie_year: '2012',
          yahoo_id: 987654
        })
      ])

      const { counts, shortfall } = await spec_run()

      expect(counts.skipped_exists).to.equal(1)
      expect(counts.failed).to.equal(0)
      expect(shortfall).to.equal(null)
      expect(await created_row(sleeper_id)).to.equal(undefined)
    })

    // The rung must not swallow a genuine create: a candidate whose ids no row
    // holds is still new, which is what keeps this from being a blunt refusal.
    it('still creates when no row holds any of the incoming external ids', async function () {
      const sleeper_id = next_sleeper_id()
      stub_payload([
        ...injury_filler(),
        sleeper_item({
          sleeper_id,
          first_name: 'Unheld',
          last_name: next_fixture_name('Identifier'),
          birth_date: '2001-05-05',
          rookie_year: '2024',
          sportradar_id: 'sr-nobody-holds-this'
        })
      ])

      const { counts, shortfall } = await spec_run()

      expect(counts.skipped_exists).to.equal(0)
      expect(counts.created).to.equal(FILLER_COUNT + 1)
      expect(shortfall).to.equal(null)
      expect(await created_row(sleeper_id)).to.exist
    })
  })

  describe('the oracle', function () {
    it('closes the conservation identity over every disposition', async function () {
      await seed_player({
        pid: 'ORAC-LEEX-000001',
        first_name: 'Oracle',
        last_name: 'Existing',
        date_of_birth: '1992-12-12'
      })

      stub_payload([
        ...injury_filler(),
        // create
        sleeper_item({
          sleeper_id: 'oracle-new',
          first_name: 'Oracle',
          last_name: 'Newperson',
          birth_date: '2005-01-01',
          rookie_year: '2026'
        }),
        // skipped_exists
        sleeper_item({
          sleeper_id: 'orexists',
          first_name: 'Oracle',
          last_name: 'Existing',
          birth_date: '1992-12-12',
          rookie_year: '2015'
        }),
        // skipped_non_fantasy
        sleeper_item({
          sleeper_id: 'ornonfant',
          first_name: 'Oracle',
          last_name: 'Linebacker',
          position: 'LB',
          birth_date: '1991-11-11',
          rookie_year: '2014'
        }),
        // skipped_duplicate_placeholder
        sleeper_item({
          sleeper_id: 'oracle-dup',
          first_name: 'Duplicate',
          last_name: 'Player',
          birth_date: '1990-10-10',
          rookie_year: '2013'
        }),
        // skipped_no_name_or_pos -- no position at all
        {
          player_id: 'ornopos',
          full_name: 'Oracle Nopos',
          first_name: 'Oracle',
          last_name: 'Nopos',
          position: null,
          metadata: {}
        },
        // refused -- passes the fantasy filter and fails createPlayer's required set
        {
          ...sleeper_item({
            sleeper_id: 'orrefused',
            first_name: 'Oracle',
            last_name: 'Noheight',
            birth_date: '2004-02-02',
            rookie_year: '2026'
          }),
          height: null
        }
      ])

      const { counts, shortfall } = await spec_run()

      const accounted =
        counts.skipped_no_name_or_pos +
        counts.skipped_lookup_error +
        counts.updated_by_sleeper_id +
        counts.updated_by_name +
        counts.skipped_guard_hijack +
        counts.skipped_guard_collision +
        counts.skipped_non_fantasy +
        counts.skipped_duplicate_placeholder +
        counts.refused +
        counts.skipped_exists +
        counts.skipped_unknown +
        counts.created +
        counts.failed +
        counts.threw

      // The identity an earlier revision broke by ~11,600 on every healthy run,
      // by enumerating only the create-branch buckets.
      expect(accounted).to.equal(counts.considered)
      expect(counts.skipped_no_name_or_pos).to.equal(1)
      expect(counts.skipped_non_fantasy).to.equal(1)
      expect(counts.skipped_duplicate_placeholder).to.equal(1)
      expect(counts.refused).to.equal(1)
      expect(counts.skipped_exists).to.equal(1)
      expect(shortfall).to.equal(null)
    })

    it('raises a shortfall when the payload is below the floor, BEFORE the loop', async function () {
      stub_payload([
        sleeper_item({
          sleeper_id: 'below-floor',
          first_name: 'Below',
          last_name: 'Floor',
          birth_date: '2000-01-01',
          rookie_year: '2026'
        })
      ])

      const { shortfall, counts } = await spec_run({ payload_floor: 10_000 })

      expect(shortfall).to.be.a('string')
      expect(shortfall).to.include('below the floor')
      // Checked before the loop, so nothing was considered and nothing was written.
      expect(counts).to.equal(undefined)
      expect(await created_row('below-floor')).to.not.exist
    })

    it('raises a shortfall when the resolver matches too MUCH (over-matching)', async function () {
      const last_name = next_fixture_name('Overmatch')
      await seed_player({
        pid: 'OVER-MATC-000001',
        first_name: 'Over',
        last_name,
        date_of_birth: '1995-05-05'
      })

      stub_payload([
        ...injury_filler(),
        sleeper_item({
          sleeper_id: next_sleeper_id(),
          first_name: 'Over',
          last_name,
          birth_date: '1995-05-05',
          rookie_year: '2018'
        })
      ])

      const { shortfall, counts } = await spec_run({
        bounds: { skipped_exists_ceiling: 0 }
      })

      expect(counts.skipped_exists).to.equal(1)
      expect(shortfall).to.be.a('string')
      expect(shortfall).to.include('existence check resolved')
      expect(shortfall).to.include('outside the expected')
    })

    it('raises a shortfall when the resolver matches too LITTLE and mints the backlog', async function () {
      /*
        The direction a ceiling alone cannot see, and the dangerous one. If the
        name predicate regresses, the resolver answers `new` for everyone,
        skipped_exists collapses toward zero, created jumps back to the full
        candidate set, and the run mints every duplicate the check exists to
        prevent -- with every ceiling green. Two bounds catch it: the
        skipped_exists FLOOR and the created ceiling.
      */
      stub_payload([
        ...injury_filler(),
        sleeper_item({
          sleeper_id: next_sleeper_id(),
          first_name: 'Under',
          last_name: next_fixture_name('Match'),
          birth_date: '2001-01-01',
          rookie_year: '2026'
        })
      ])

      const { shortfall, counts } = await spec_run({
        bounds: { skipped_exists_floor: 1, created_ceiling: 2 }
      })

      expect(counts.skipped_exists).to.equal(0)
      expect(counts.created).to.equal(FILLER_COUNT + 1)
      expect(shortfall).to.be.a('string')
      expect(shortfall).to.include('outside the expected')
      expect(shortfall).to.include('above the ceiling')
    })

    it('accumulates several shortfalls rather than returning on the first', async function () {
      stub_payload([
        ...injury_filler(),
        sleeper_item({
          sleeper_id: next_sleeper_id(),
          first_name: 'Multi',
          last_name: next_fixture_name('Short'),
          birth_date: '2002-02-02',
          rookie_year: '2026'
        })
      ])

      // run() used to return on the FIRST reason, so one reached the jobs row and
      // every other one was masked.
      const { shortfall } = await spec_run({
        bounds: {
          skipped_exists_floor: 1,
          created_ceiling: 2,
          updated_by_sleeper_id_floor: 1
        }
      })

      expect(shortfall.split(' | ').length).to.be.greaterThan(2)
    })

    it('raises a shortfall when skipped_unknown falls BELOW its floor', async function () {
      /*
        The unknown buckets are where the resolver refuses instead of creating,
        so a regression collapsing any unknown rung toward `new` mints duplicate
        people. A ceiling alone cannot see that -- turning rung 6 back into a
        create sends skipped_unknown DOWN while skipped_exists holds and created
        stays well under its ceiling, so every other bound reads green.
      */
      stub_payload([
        ...injury_filler(),
        sleeper_item({
          sleeper_id: next_sleeper_id(),
          first_name: 'Nounknown',
          last_name: next_fixture_name('Bucket'),
          birth_date: '2003-03-03',
          rookie_year: '2026'
        })
      ])

      const { shortfall, counts } = await spec_run({
        bounds: { skipped_unknown_floor: 1 }
      })

      expect(counts.skipped_unknown).to.equal(0)
      expect(shortfall).to.be.a('string')
      expect(shortfall).to.include('could not adjudicate')
      expect(shortfall).to.include('outside the expected')
    })

    it('MERGES a partial bounds override onto the defaults rather than replacing them', async function () {
      /*
        `bounds = DEFAULT_BOUNDS` as a default parameter only fires when the whole
        object is absent, so overriding ONE knob used to leave every other bound
        `undefined` -- and both `x < undefined` and `x > undefined` are false, so
        each unnamed check became unfireable while reading green. Driven through
        run() directly, NOT spec_run, because spec_run spreads a full object and
        so cannot see this.
      */
      stub_payload([
        sleeper_item({
          sleeper_id: next_sleeper_id(),
          first_name: 'Partial',
          last_name: next_fixture_name('Bounds'),
          birth_date: '2004-04-04',
          rookie_year: '2026'
        })
      ])

      const { shortfall } = await run({
        payload_floor: 1,
        bounds: { created_ceiling: 1000 }
      })

      // skipped_exists is 0 and unnamed by the override, so it must still be
      // judged against the shipped floor of 50.
      expect(shortfall).to.be.a('string')
      expect(shortfall).to.include('existence check resolved')
    })
  })
})
