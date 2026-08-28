/* global describe it */
import * as chai from 'chai'

import {
  player_id_regex,
  team_id_regex,
  pid_pattern
} from '#libs-shared/constants/player-id-constants.mjs'
import generate_player_id from '#libs-server/generate-player-id.mjs'

const expect = chai.expect

// These matchers are FILTERS -- `optimize-lineup.mjs` and
// `optimize-standings-lineup.mjs` keep the solver-result keys that match and
// silently drop the rest -- so a shape that stops matching removes starters
// instead of raising. That is not hypothetical: between 2026-07-20 and
// 2026-08-02 `player_id_regex` matched zero of 28,166 players and every
// optimized lineup came back with correct points and an empty starter list,
// reported as success 1,073 times out of 1,073.
//
// The production backstop is `check_lineup_starter_identity_oracle` in
// scripts/process-projections.mjs, which can only fire AFTER a bad run has
// written rows. This file is the pre-merge half, and its point is the SERIAL
// LENGTH case: `player_pid_serial_seq` is at ~45k and the pid format
// deliberately allows the serial to grow past six digits, so a matcher pinned
// at exactly six goes to zero the day the sequence rolls over -- with no code
// change to blame it on.
describe('LIBS-SHARED player id constants', function () {
  describe('player_id_regex', function () {
    it('matches a minted person pid', function () {
      const pid = generate_player_id({
        first_name: 'Patrick',
        last_name: 'Mahomes',
        serial: 5785
      })
      expect(pid).to.equal('PATR-MAHO-005785')
      expect(player_id_regex.test(pid)).to.equal(true)
    })

    it('matches a serial that has grown PAST six digits', function () {
      // The rollover case. A regex pinned at `[0-9]{6}$` fails here, which is
      // the whole reason this test exists.
      const pid = generate_player_id({
        first_name: 'Patrick',
        last_name: 'Mahomes',
        serial: 1234567
      })
      expect(pid).to.equal('PATR-MAHO-1234567')
      expect(player_id_regex.test(pid)).to.equal(true)
    })

    it('matches a name half shorter than four letters', function () {
      // The minter X-pads to four, but `player_pid_format` allows one to four
      // and the matcher mirrors the CONSTRAINT rather than the minter.
      expect(player_id_regex.test('BO-IX-000123')).to.equal(true)
    })

    it('rejects the solver bookkeeping keys it exists to filter out', function () {
      for (const key of ['result', 'feasible', 'bounded', 'isIntegral']) {
        expect(player_id_regex.test(key), key).to.equal(false)
        expect(team_id_regex.test(key), key).to.equal(false)
      }
    })

    it('rejects the synthetic baseline variables optimize-lineup adds', function () {
      // `optimize-lineup.mjs` adds one `pid_<POS>` variable per fantasy
      // position when filling from baseline. Matching one would report a
      // placeholder as a started player.
      for (const key of ['pid_QB', 'pid_RB', 'pid_WR', 'pid_TE', 'pid_K']) {
        expect(player_id_regex.test(key), key).to.equal(false)
        expect(team_id_regex.test(key), key).to.equal(false)
      }
    })
  })

  describe('team_id_regex', function () {
    it('matches every bare nfl abbreviation length in use', function () {
      for (const pid of ['GB', 'KC', 'NE', 'ARI', 'NYG', 'WAS']) {
        expect(team_id_regex.test(pid), pid).to.equal(true)
      }
    })

    it('matches a unit-suffixed team pid, which the constraint allows', function () {
      for (const pid of ['NE-DST', 'GB-OFF', 'KC-DEF']) {
        expect(team_id_regex.test(pid), pid).to.equal(true)
      }
    })

    it('does not swallow a person pid', function () {
      expect(team_id_regex.test('PATR-MAHO-005785')).to.equal(false)
    })
  })

  describe('pid_pattern', function () {
    // The api spec's `PlayerId` schema publishes this exact string, so a drift
    // between the published contract and the runtime filters is a drift in one
    // constant rather than in two files that look unrelated.
    it('accepts both halves of the identity and nothing else', function () {
      const regex = new RegExp(pid_pattern)
      expect(regex.test('PATR-MAHO-005785')).to.equal(true)
      expect(regex.test('PATR-MAHO-1234567')).to.equal(true)
      expect(regex.test('NE')).to.equal(true)
      expect(regex.test('NE-DST')).to.equal(true)
      expect(regex.test('patr-maho-005785')).to.equal(false)
      expect(regex.test('PATR-MAHO-00578')).to.equal(false)
      expect(regex.test('PATRI-MAHO-005785')).to.equal(false)
    })
  })
})
