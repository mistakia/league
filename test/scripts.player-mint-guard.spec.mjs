/* global describe before after beforeEach afterEach it */

import * as chai from 'chai'

import db from '#db'
import { format_player_name } from '#libs-shared'
import import_combine_profiles_for_year from '#scripts/import-players-combine-profiles.mjs'

const expect = chai.expect

/*
  The negative control for the `duplicate-person-rows` class.

  The class is minted by ONE shape, and this file is the fixture pair that
  reproduces it: a canonical `player` row carrying a REAL birth date, and an
  incoming payload carrying the same name with the `0000-00-00` sentinel where
  its birth date should be. The sentinel is not a missing field -- it is truthy,
  and it is exactly as long as a real date -- so a name-and-birth-date matcher
  compares `0000-00-00` against `1999-04-15`, finds no equality, and concludes
  the person is new. A second row for one person is the result.

  It drives import-players-combine-profiles, which is the archetype minter: its
  payload writes the sentinel literally (`date_of_birth: '0000-00-00'`)
  alongside NGS prospect scores and an esb id, the exact twin signature
  `player_changelog` carries for the 26 pairs repaired 2026-08-28 -- a legacy
  row holding real biography beside a twin minted later by an importer with
  vendor ids and no birth date.

  Shown to fire before it was fixed: against the unguarded importer this fixture
  produced two rows for one person, `...:1999-04-15` beside `...:0000-00-00`.

  Nothing here asserts on a hand-written copy of a createPlayer payload. The
  test drives the SHIPPED importer end to end, because a payload object
  inspected in isolation is well-formed JavaScript at every broken revision --
  only executing the insert distinguishes a guard that fires from one that was
  never reached.

  THE SLEEPER SIDE OF THE PAIR IS NOT REPEATED HERE. Sleeper was the one path
  already wired to the resolver, and its refusal on this exact shape is already
  asserted by test/scripts.import.players-sleeper.spec.mjs ("does NOT create
  when the payload carries no birth date and a name matches"), alongside the
  exists / dates-differ / stored-placeholder / alias / external-id variants. A
  second copy here would restate that file rather than cover anything.

  Structural coverage of the OTHER guarded call sites is db/gates/
  check-player-mint-guard.mjs, which holds every automated mint site to a
  resolver call; this file covers the behaviour of the archetype.
*/

// The fixture's canonical row. A real birth date is the whole point: the
// duplicate is only minted because the incoming sentinel cannot equal it.
const CANONICAL_BIRTH_DATE = '1999-04-15'

/*
  The seeded row's draft year is deliberately NOT the year the importers are
  driven for. The combine importer's own name fallback is
  `find_player_row({ name, nfl_draft_year: year, pos })`, so a matching draft
  year would let its hand-rolled matcher find the row and the defect would never
  reach createPlayer -- the test would pass for the wrong reason, proving only
  that a narrow matcher works on the case it was built for. A legacy row whose
  draft year disagrees (or is absent) is the realistic case AND the one that
  reaches the mint.
*/
const CANONICAL_DRAFT_YEAR = 2019
const IMPORT_YEAR = 2024

// format_player_name STRIPS DIGITS, so two fixtures separated only by a numeral
// collapse to one name and the second silently resolves to the first. Every
// generated name here is alphabetic, and unique across the whole FILE rather
// than per-test: rows created by an earlier test are still present.
let fixture_sequence = 0
const alphabetic_suffix = (index) => {
  let value = index
  let suffix = ''
  do {
    suffix = String.fromCharCode(97 + (value % 26)) + suffix
    value = Math.floor(value / 26)
  } while (value > 0)
  return suffix.charAt(0).toUpperCase() + suffix.slice(1)
}
const FIXTURE_SURNAME_STEM = 'Twinable'
const next_last_name = () =>
  `${FIXTURE_SURNAME_STEM}${alphabetic_suffix(fixture_sequence++)}`

let esb_sequence = 700000
const next_esb_id = () => `ESB${esb_sequence++}`

let pid_sequence = 100000

const seed_canonical_player = async ({
  first_name,
  last_name,
  date_of_birth = CANONICAL_BIRTH_DATE,
  primary_position = 'WR',
  nfl_draft_year = CANONICAL_DRAFT_YEAR
}) => {
  // player_pid_format is CHECKed: ^[A-Z]{1,4}-[A-Z]{1,4}-[0-9]{6,}$. A seed pid
  // that misses it fails the INSERT, which reads as the importer minting nothing
  // and would make every assertion below green for the wrong reason.
  const pid = `${last_name.slice(0, 4).toUpperCase()}-${first_name.slice(0, 4).toUpperCase()}-${String(pid_sequence++).padStart(6, '0')}`
  await db('player').insert({
    pid,
    first_name,
    last_name,
    short_name: `${first_name[0]}.${last_name}`,
    formatted_name: format_player_name(`${first_name} ${last_name}`),
    primary_position,
    secondary_position: primary_position,
    position_depth: primary_position,
    current_nfl_team: 'KC',
    date_of_birth,
    nfl_draft_year,
    height_inches: 72,
    weight_pounds: 200,
    jersey_number: 80
  })
  return pid
}

const rows_named = (first_name, last_name) =>
  db('player').where({
    formatted_name: format_player_name(`${first_name} ${last_name}`)
  })

/*
  A combine profile carrying the sentinel. The importer builds
  `date_of_birth: '0000-00-00'` itself -- the feed has no birth date at all --
  so this fixture does not supply one, and that absence is the defect's input.
*/
const combine_profile = ({
  first_name,
  last_name,
  esb_id,
  position = 'WR'
}) => ({
  person: {
    firstName: first_name,
    lastName: last_name,
    esbId: esb_id,
    collegeNames: ['Test University'],
    hometown: 'Testville, TS'
  },
  position,
  height: 72,
  weight: 200,
  athleticismScore: 88,
  draftGrade: 6.2,
  grade: 6.4,
  productionScore: 79,
  sizeScore: 81,
  combineAttendance: true
})

/*
  get_combine_profiles reads the cache before it reaches the vendor, and
  cache.get goes through fetch_with_retry with `use_proxy: false`, which reaches
  a bare `globalThis.fetch`. Serving the cache key from a stub therefore drives
  the real importer with NO network and no session token -- the vendor branch is
  never entered. The cache endpoint returns `{ value }` and cache.get unwraps it.
*/
const stub_combine_cache = (profiles) => {
  globalThis.fetch = async (url) => {
    if (String(url).includes(`/nfl/combine_profiles/${IMPORT_YEAR}.json`)) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ value: { combineProfiles: profiles } })
      }
    }
    // Any other request is a fixture bug -- fail loudly rather than let the
    // importer silently take a live path.
    throw new Error(`unexpected fetch in combine fixture: ${url}`)
  }
}

describe('SCRIPTS player mint guard', function () {
  this.timeout(30000)

  let original_fetch

  before(function () {
    original_fetch = globalThis.fetch
  })

  after(function () {
    globalThis.fetch = original_fetch
  })

  /*
    Scoped to THIS file's fixtures rather than truncating `player`, and run on
    BOTH sides of every test.

    Two separate hazards, and the fix for each is half of this hook:

    - Scoping. Every spec in this process draws from one shared player pool
      seeded by db/fixtures/test/player.sql, which the api specs reach through
      `selectPlayer`. A blanket `db('player').del()` here empties that pool for
      every spec that runs afterwards, and the only thing that hid it was mocha
      collecting alphabetically so `api.*` ran first. That is luck, not
      isolation.
    - Cleaning up AFTER. A row this file leaves behind is not inert: the combine
      importer writes `ngs_prospect_scores_history` for every player it mints,
      and a later spec re-running the player seed does `delete from player`,
      which then fails on that foreign key and takes 48 unrelated tests with it.
      Leaving the database as we found it is what keeps this file's cost local.

    Every fixture surname starts with FIXTURE_SURNAME_STEM, so one pattern
    reaches the seeded rows and the importer-minted ones alike.
  */
  const clean_fixture_rows = async () => {
    const fixture_pids = await db('player')
      .where(
        'formatted_name',
        'like',
        `%${FIXTURE_SURNAME_STEM.toLowerCase()}%`
      )
      .pluck('pid')
    if (!fixture_pids.length) return

    await db('ngs_prospect_scores_history').whereIn('pid', fixture_pids).del()
    await db('ngs_prospect_scores_index').whereIn('pid', fixture_pids).del()
    await db('player_changelog').whereIn('pid', fixture_pids).del()
    await db('player_aliases').whereIn('pid', fixture_pids).del()
    await db('player').whereIn('pid', fixture_pids).del()
  }

  beforeEach(clean_fixture_rows)
  afterEach(clean_fixture_rows)

  describe('import-players-combine-profiles', function () {
    it('refuses to mint a second row for a name already holding a real birth date', async function () {
      const first_name = 'Sentinel'
      const last_name = next_last_name()

      const canonical_pid = await seed_canonical_player({
        first_name,
        last_name
      })

      stub_combine_cache([
        combine_profile({
          first_name,
          last_name,
          esb_id: next_esb_id()
        })
      ])

      await import_combine_profiles_for_year({
        year: IMPORT_YEAR,
        token: 'stub-token'
      })

      const rows = await rows_named(first_name, last_name)

      /*
        This is the assertion the guard exists to make true. Before
        resolve_canonical_player is wired into this importer, the run lands a
        SECOND row here: the esb lookup misses (the canonical row holds no esb
        id), the name fallback misses (its draft year disagrees), and the mint
        writes `date_of_birth: '0000-00-00'` for a person already in the table.
      */
      expect(rows).to.have.lengthOf(
        1,
        `expected the canonical row alone; got ${rows.length} rows for one person (${rows.map((row) => `${row.pid}:${row.date_of_birth}`).join(', ')})`
      )
      expect(rows[0].pid).to.equal(canonical_pid)
      expect(rows[0].date_of_birth).to.equal(CANONICAL_BIRTH_DATE)
    })

    it('still mints a genuinely new player', async function () {
      // The guard's cost must be a refusal of duplicates only. Without this, a
      // guard that refuses everything passes the test above.
      const first_name = 'Genuine'
      const last_name = next_last_name()

      stub_combine_cache([
        combine_profile({
          first_name,
          last_name,
          esb_id: next_esb_id()
        })
      ])

      await import_combine_profiles_for_year({
        year: IMPORT_YEAR,
        token: 'stub-token'
      })

      const rows = await rows_named(first_name, last_name)
      expect(rows).to.have.lengthOf(1)
      expect(rows[0].nfl_draft_year).to.equal(IMPORT_YEAR)
    })
  })
})
