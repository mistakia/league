/* global describe it */

// The finalization watermark guard was permanently inert in production, and the
// cause was not the change predicate but a DISAGREEMENT between the two callers
// of enrich_plays. Both write the same nfl_plays columns:
//
// - scripts/import-plays-nfl-v1.mjs enriches feed-shaped plays it just built,
//   then writes them through upsert_plays, which stamps `updated`.
// - scripts/process-plays.mjs (inside finalize_game) enriches rows read back
//   from nfl_plays, then writes them through update_play, whose excluded_props
//   deliberately does NOT stamp `updated`.
//
// Wherever the two derive different values from the same underlying facts, the
// pair ping-pongs forever: the importer writes its answer and advances
// `updated` past the watermark, enrichment writes its answer back invisibly,
// and the next pass finalizes again. Measured 2026-08-30: 4,938 of 8,941 plays
// reported changed on every pass, and zero games ever skipped.
//
// These cases pin AGREEMENT, which is the property that actually matters and
// the one no single-caller test can see. Determinism is not enough -- two
// callers can each be perfectly stable and still disagree forever.

import * as chai from 'chai'

import { enrich_plays } from '#libs-server/play-enrichment/index.mjs'
import { group_play_stats_by_play } from '#libs-server/play-enrichment/enrichment-helpers.mjs'

const expect = chai.expect

const esbid = 9900002
const play_id = 1

// statId 10 is a rushing yardage stat; 79/80/82 are the tackle families.
const play_stats = [
  { esbid, play_id, stat_id: 10, player_name: 'A Runner', stat_yards: 7 },
  {
    esbid,
    play_id,
    stat_id: 82,
    player_name: 'B Tackler',
    gsis_player_id: '00-0000002'
  },
  {
    esbid,
    play_id,
    stat_id: 82,
    player_name: 'C Tackler',
    gsis_player_id: '00-0000003'
  }
]

// The NFL feed emits a target stat (statId 115) naming the receiver but
// carrying no gsisId. This is the exact shape the snap-roster recovery exists
// for, and the shape that NULL-clears the role without it.
const target_stat_without_gsis = [
  { esbid, play_id, stat_id: 115, player_name: 'D Receiver' }
]

const snap_roster_by_esbid = new Map([
  [
    esbid,
    new Map([
      ['d receiver', [{ pid: 'DREC-EIVE-000001', gsisid: '00-0000004' }]]
    ])
  ]
])

const player_cache_stub = {
  find_player: ({ gsis_player_id }) =>
    gsis_player_id === '00-0000004' ? { pid: 'DREC-EIVE-000001' } : null
}

describe('enrich_plays agrees across its two callers', function () {
  it('derives is_successful_play without a caller-supplied yards_gained', async () => {
    // The importer's shape: getPlayData produces down_number and yards_to_go
    // but never yards_gained, which the yardage enricher computes from
    // play_stats. When the success phase ran BEFORE that enricher, this
    // resolved to null here and to true/false in process_plays, whose rows come
    // from the database with yards_gained already stored. Ordering is what
    // makes both callers land on the same answer.
    const [enriched] = await enrich_plays({
      plays: [
        { esbid, play_id, down_number: 1, yards_to_go: 10, play_type: 'RUSH' }
      ],
      play_stats
    })

    expect(enriched.yards_gained).to.equal(7)
    expect(enriched.is_successful_play).to.equal(true)
  })

  it('derives the same is_successful_play from a stored-row shape', async () => {
    // process_plays' shape: the same play read back from nfl_plays, already
    // carrying yards_gained. Both callers must reach the same verdict, or the
    // column ping-pongs on every import pass.
    const [enriched] = await enrich_plays({
      plays: [
        {
          esbid,
          play_id,
          down_number: 1,
          yards_to_go: 10,
          yards_gained: 7,
          play_type: 'RUSH'
        }
      ],
      play_stats
    })

    expect(enriched.is_successful_play).to.equal(true)
  })

  it('omits is_successful_play entirely when it cannot be computed', async () => {
    // "No opinion" has to be an ABSENT key, not a null one. A null is
    // authoritative: upsert_plays carries it into the merge and it overwrites a
    // stored true/false, which is exactly what kept nfl_plays.updated moving
    // past the finalization watermark after the ordering fix landed. The
    // yardage enricher already expresses no-opinion by omission; this is the
    // same contract on the same pass.
    // The production shape: down and distance are known, but no yardage stat
    // exists on the play, so the yardage enricher omits yards_gained and the
    // verdict is unknowable from this caller's inputs alone.
    const [enriched] = await enrich_plays({
      plays: [
        { esbid, play_id, down_number: 1, yards_to_go: 10, play_type: 'RUSH' }
      ],
      play_stats: play_stats.filter((stat) => stat.stat_id !== 10)
    })

    expect(enriched).to.not.have.property('yards_gained')
    expect(enriched).to.not.have.property('is_successful_play')
  })

  it('recovers a role whose stat row carries no gsisId, given the snap roster', async () => {
    const [enriched] = await enrich_plays({
      plays: [{ esbid, play_id, play_type: 'PASS' }],
      play_stats: target_stat_without_gsis,
      player_cache: player_cache_stub,
      snap_roster_by_esbid
    })

    expect(enriched.target_gsis_player_id).to.equal('00-0000004')
    expect(enriched.target_pid).to.equal('DREC-EIVE-000001')
  })

  it('REFUSES to enrich at all when the snap roster is not supplied', async () => {
    // This case used to assert the NULL-clear, pinning the asymmetry as harmful
    // but reachable. It is now unreachable: omitting the roster throws.
    //
    // Why that changed. Omission was a silent opt-out from the
    // source-NULL-gsisId fallback rather than a decision, and it produced the
    // same defect three times -- backfill-role-pids in 2026-08, then the
    // importer and the private ngs writer. Each time the owned writer wrote
    // null over the role on every pass and the finalization wrote it straight
    // back, invisibly, since update_play logs no changelog row when it fills a
    // NULL. Measured 2026-08-31: 205 rows ping-ponged across three consecutive
    // full-season passes, partitioning exactly into the five owned families.
    // Fixing the three callers does not stop a fourth; removing the default
    // does.
    let thrown = null
    try {
      await enrich_plays({
        plays: [{ esbid, play_id, play_type: 'PASS' }],
        play_stats: target_stat_without_gsis,
        player_cache: player_cache_stub
      })
    } catch (error) {
      thrown = error
    }

    expect(thrown, 'omitting snap_roster_by_esbid must throw').to.be.instanceof(
      TypeError
    )
    expect(thrown.message).to.match(/snap_roster_by_esbid/)
  })

  it('still enriches when the snap roster is supplied but empty', async () => {
    // The negative control on the check above. An empty Map is a legitimate
    // input -- a game with no snap data has nothing to recover from -- and must
    // not be conflated with omission, or the check would push callers toward
    // passing something arbitrary to get past it. This is also what proves the
    // throw keys on SUPPLIED rather than POPULATED; without this case, a check
    // requiring a non-empty Map would pass the suite identically.
    const [enriched] = await enrich_plays({
      plays: [{ esbid, play_id, play_type: 'PASS' }],
      play_stats: target_stat_without_gsis,
      player_cache: player_cache_stub,
      snap_roster_by_esbid: new Map()
    })

    expect(enriched.target_gsis_player_id).to.equal(null)
    expect(enriched.target_pid).to.equal(null)
  })

  it('assigns tackle slots independently of play_stats arrival order', async () => {
    // The two callers arrive with different orders: process_plays reads via
    // get_play_stats, which has no ORDER BY and returns heap order that moves
    // as rows are rewritten, while the importer uses the NFL feed's own array.
    // Slot assignment is positional, so an unsorted grouping let the same two
    // players swap tackle_assist_1 and tackle_assist_2 back and forth on every
    // pass -- observed eight times in eight hours on one production play.
    const forward = group_play_stats_by_play(play_stats)
    const reversed = group_play_stats_by_play([...play_stats].reverse())

    const key = `${esbid}-${play_id}`
    const names = (grouped) => grouped.get(key).map((s) => s.player_name)

    expect(names(forward)).to.deep.equal(names(reversed))
  })

  it('orders tackle stats by a key that is total, not merely stable', async () => {
    // Two stats of the same family on one play differ only by player, so the
    // sort has to reach past stat_id to be a total order. A partial key leaves
    // ties resolved by arrival order, which is the defect wearing a sort.
    const grouped = group_play_stats_by_play([...play_stats].reverse())
    const tacklers = grouped
      .get(`${esbid}-${play_id}`)
      .filter((s) => s.stat_id === 82)
      .map((s) => s.player_name)

    expect(tacklers).to.deep.equal(['B Tackler', 'C Tackler'])
  })
})
