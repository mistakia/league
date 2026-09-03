/* global describe it */
import * as chai from 'chai'

import {
  snap_group_key,
  find_gamelog_for_snap_group
} from '#libs-server/snap-gamelog-pairing.mjs'

const expect = chai.expect

/*
  The measured case, kept as the fixture rather than an invented one.

  2024 preseason week 1: gsis_it_player_id 53909 (Caleb Johnson, a Jaguar) has
  snaps in 2024081056, KC at JAX. A namesake on Cleveland's gameday roster put a
  CLE gamelog at 2024081054, GB at CLE, in the same week. The old pairing matched
  on the player alone, so it returned the CLE row and the script wrote its
  opponent (GB) onto a JAX game while omitting the team entirely.

  Each case asserts the pair in both directions -- the right gamelog found, and
  the wrong-week-sibling NOT returned -- because a lookup that has stopped
  matching anything returns null in exactly the same way as one correctly
  declining to guess.
*/

const gsis_it_player_id = 53909
const jax_esbid = 2024081056
const cle_esbid = 2024081054

const gamelogs = [
  // The namesake's row, first in the array precisely because that is what made
  // the old `find` return it.
  {
    gsis_it_player_id,
    esbid: cle_esbid,
    nfl_team: 'CLE',
    opponent_nfl_team: 'GB',
    player_position: 'LB'
  },
  {
    gsis_it_player_id,
    esbid: jax_esbid,
    nfl_team: 'JAX',
    opponent_nfl_team: 'KC',
    player_position: 'LB'
  }
]

describe('libs-server / snap-gamelog-pairing', function () {
  describe('snap_group_key', function () {
    it('separates two games of one week for the same player', () => {
      expect(
        snap_group_key({ gsis_it_player_id, esbid: jax_esbid })
      ).to.not.equal(snap_group_key({ gsis_it_player_id, esbid: cle_esbid }))
    })

    it('groups the same player and game together', () => {
      expect(snap_group_key({ gsis_it_player_id, esbid: jax_esbid })).to.equal(
        snap_group_key({ gsis_it_player_id, esbid: jax_esbid })
      )
    })
  })

  describe('find_gamelog_for_snap_group', function () {
    it("returns the gamelog for the snap group's OWN game", () => {
      const found = find_gamelog_for_snap_group({
        gamelogs,
        gsis_it_player_id,
        esbid: jax_esbid
      })

      expect(found).to.not.equal(null)
      expect(found.esbid).to.equal(jax_esbid)
      expect(found.nfl_team).to.equal('JAX')
      expect(found.opponent_nfl_team).to.equal('KC')
    })

    it('does NOT return another game of the same week', () => {
      // The control for the shipped defect. The old pairing matched on
      // gsis_it_player_id alone and returned the CLE row for these same inputs;
      // this assertion is what fails if anyone restores that.
      const found = find_gamelog_for_snap_group({
        gamelogs,
        gsis_it_player_id,
        esbid: jax_esbid
      })

      expect(found.nfl_team).to.not.equal('CLE')
      expect(found.opponent_nfl_team).to.not.equal('GB')
    })

    it('returns null rather than a different game when the row is absent', () => {
      // A skip, not a fallback. The script writes nothing on null, which is
      // correct: generate_player_gamelogs runs first, so a missing gamelog means
      // the snap group does not belong to a gamelog this run should create.
      const found = find_gamelog_for_snap_group({
        gamelogs,
        gsis_it_player_id,
        esbid: 2024081762
      })

      expect(found).to.equal(null)
    })

    it('does not confuse two players in the same game', () => {
      const found = find_gamelog_for_snap_group({
        gamelogs,
        gsis_it_player_id: 56255,
        esbid: jax_esbid
      })

      expect(found).to.equal(null)
    })
  })
})
