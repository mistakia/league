/* global describe before beforeEach it */
import * as chai from 'chai'
import chai_http, { request as chai_request } from 'chai-http'
import MockDate from 'mockdate'

import server from '#api'
import knex from '#db'
import league from '#db/fixtures/league.mjs'
import {
  current_season,
  bid_change_types,
  bid_change_sources,
  bid_types,
  restricted_free_agency_bid_outcomes
} from '#constants'
import record_bid_change from '#libs-server/record-bid-change.mjs'
import run_restricted_free_agency_settlement from '#scripts/process-restricted-free-agency-bids.mjs'
import { user1, user2 } from './fixtures/token.mjs'
import { selectPlayer, addPlayer } from './utils/index.mjs'

process.env.NODE_ENV = 'test'

chai.should()
chai.use(chai_http)
const expect = chai.expect
const { regular_season_start } = current_season

// The audit trail exists to answer one question the database could not answer
// on 2026-08-05: what was this manager's bid at time T, and who changed it.
// Every assertion below is a form of that question, so the shape they pin is the
// SEQUENCE of rows -- a spec that only checked the latest row would pass over a
// trail that overwrites itself, which is the defect being fixed.
const changelog_for_bid = (bid_id) =>
  knex('bid_changelog')
    .where({ bid_type: bid_types.RESTRICTED_FREE_AGENCY, bid_id })
    .orderBy('changed_at', 'asc')
    .orderBy('change_id', 'asc')

describe('bid changelog', function () {
  before(async function () {
    this.timeout(60 * 1000)
    MockDate.set(regular_season_start.subtract('1', 'month').toISOString())
    await knex.seed.run()
  })

  beforeEach(async function () {
    MockDate.set(regular_season_start.subtract('2', 'month').toISOString())
    await league(knex)
  })

  it('records a created row carrying the bid and its conditional releases', async () => {
    const player = await selectPlayer()
    const release_player = await selectPlayer({ exclude_pids: [player.pid] })
    const league_id = 1
    const team_id = 1

    await addPlayer({ leagueId: league_id, player, teamId: team_id, userId: 1 })
    await addPlayer({
      leagueId: league_id,
      player: release_player,
      teamId: team_id,
      userId: 1
    })

    const res = await chai_request
      .execute(server)
      .post('/api/teams/1/tag/restricted-free-agency')
      .set('Authorization', `Bearer ${user1}`)
      .send({
        leagueId: league_id,
        bid: 5,
        playerTid: team_id,
        release: [release_player.pid],
        pid: player.pid
      })

    res.should.have.status(200)

    const rows = await changelog_for_bid(res.body.uid)
    rows.length.should.equal(1)

    const [created] = rows
    created.change_type.should.equal(bid_change_types.CREATED)
    created.change_source.should.equal(bid_change_sources.API_BID_CREATE)
    created.changed_by_user_id.should.equal(1)
    created.bid_amount.should.equal(5)
    created.bid_user_id.should.equal(1)
    created.league_id.should.equal(league_id)
    created.team_id.should.equal(team_id)
    created.player_id.should.equal(player.pid)
    created.season_year.should.equal(current_season.year)
    expect(created.cancelled_at).to.equal(null)
    expect(created.processed_at).to.equal(null)
    expect(created.is_successful).to.equal(null)
    expect(created.outcome).to.equal(null)

    // The releases are part of the offer, so they are snapshotted on the bid's
    // own row rather than in a trail of their own.
    created.conditional_release_player_ids.should.deep.equal([
      release_player.pid
    ])
  })

  it('preserves the previous amount when a bid is updated', async () => {
    const player = await selectPlayer()
    const league_id = 1
    const team_id = 1

    await addPlayer({ leagueId: league_id, player, teamId: team_id, userId: 1 })

    const post_res = await chai_request
      .execute(server)
      .post('/api/teams/1/tag/restricted-free-agency')
      .set('Authorization', `Bearer ${user1}`)
      .send({
        leagueId: league_id,
        bid: 5,
        playerTid: team_id,
        release: [],
        pid: player.pid
      })

    post_res.should.have.status(200)
    const bid_id = post_res.body.uid

    const put_res = await chai_request
      .execute(server)
      .put('/api/teams/1/tag/restricted-free-agency')
      .set('Authorization', `Bearer ${user1}`)
      .send({ leagueId: league_id, bid: 22, release: [], pid: player.pid })

    put_res.should.have.status(200)

    const rows = await changelog_for_bid(bid_id)
    rows.length.should.equal(2)

    // This is the whole point: the update overwrote `bid_amount` on the bid row,
    // and the earlier value survives here. Before this table the $5 was gone.
    rows[0].change_type.should.equal(bid_change_types.CREATED)
    rows[0].bid_amount.should.equal(5)

    rows[1].change_type.should.equal(bid_change_types.UPDATED)
    rows[1].change_source.should.equal(bid_change_sources.API_BID_UPDATE)
    rows[1].bid_amount.should.equal(22)
    rows[1].changed_by_user_id.should.equal(1)

    const bid_row = await knex('restricted_free_agency_bids')
      .where('uid', bid_id)
      .first()
    bid_row.bid_amount.should.equal(22)
  })

  it('records a conditional release change with no amount change', async () => {
    const player = await selectPlayer()
    const first_release = await selectPlayer({ exclude_pids: [player.pid] })
    const second_release = await selectPlayer({
      exclude_pids: [player.pid, first_release.pid]
    })
    const league_id = 1
    const team_id = 1

    for (const roster_player of [player, first_release, second_release]) {
      await addPlayer({
        leagueId: league_id,
        player: roster_player,
        teamId: team_id,
        userId: 1
      })
    }

    const post_res = await chai_request
      .execute(server)
      .post('/api/teams/1/tag/restricted-free-agency')
      .set('Authorization', `Bearer ${user1}`)
      .send({
        leagueId: league_id,
        bid: 7,
        playerTid: team_id,
        release: [first_release.pid],
        pid: player.pid
      })

    post_res.should.have.status(200)
    const bid_id = post_res.body.uid

    const put_res = await chai_request
      .execute(server)
      .put('/api/teams/1/tag/restricted-free-agency')
      .set('Authorization', `Bearer ${user1}`)
      .send({
        leagueId: league_id,
        bid: 7,
        release: [second_release.pid],
        pid: player.pid
      })

    put_res.should.have.status(200)

    const rows = await changelog_for_bid(bid_id)
    rows.length.should.equal(2)

    // The update path rewrites releases by delete-and-insert, so without the
    // trail the first release is unrecoverable even though the amount never
    // moved.
    rows[0].conditional_release_player_ids.should.deep.equal([
      first_release.pid
    ])
    rows[1].change_type.should.equal(bid_change_types.UPDATED)
    rows[1].bid_amount.should.equal(7)
    rows[1].conditional_release_player_ids.should.deep.equal([
      second_release.pid
    ])
  })

  it('distinguishes a withdrawal from a bid dropped by a replacement tag', async () => {
    const first_player = await selectPlayer()
    const second_player = await selectPlayer({
      exclude_pids: [first_player.pid]
    })
    const third_player = await selectPlayer({
      exclude_pids: [first_player.pid, second_player.pid]
    })
    const league_id = 1
    const team_id = 1

    for (const roster_player of [first_player, second_player, third_player]) {
      await addPlayer({
        leagueId: league_id,
        player: roster_player,
        teamId: team_id,
        userId: 1
      })
    }

    // A bid the manager withdraws deliberately.
    const withdrawn_res = await chai_request
      .execute(server)
      .post('/api/teams/1/tag/restricted-free-agency')
      .set('Authorization', `Bearer ${user1}`)
      .send({
        leagueId: league_id,
        bid: 3,
        playerTid: team_id,
        release: [],
        pid: first_player.pid
      })

    withdrawn_res.should.have.status(200)

    const delete_res = await chai_request
      .execute(server)
      .delete('/api/teams/1/tag/restricted-free-agency')
      .set('Authorization', `Bearer ${user1}`)
      .send({ leagueId: league_id, pid: first_player.pid })

    delete_res.should.have.status(200)

    const withdrawn_rows = await changelog_for_bid(withdrawn_res.body.uid)
    withdrawn_rows.length.should.equal(2)
    withdrawn_rows[1].change_type.should.equal(bid_change_types.CANCELLED)
    withdrawn_rows[1].change_source.should.equal(
      bid_change_sources.API_BID_CANCEL
    )
    expect(withdrawn_rows[1].cancelled_at).to.not.equal(null)

    // A bid the manager did not touch, dropped as a side effect of tagging
    // someone else. This is the case a manager reads as "my bid was reset", and
    // the two are indistinguishable on the bid row itself -- both just carry a
    // `cancelled` stamp.
    const replaced_res = await chai_request
      .execute(server)
      .post('/api/teams/1/tag/restricted-free-agency')
      .set('Authorization', `Bearer ${user1}`)
      .send({
        leagueId: league_id,
        bid: 4,
        playerTid: team_id,
        release: [],
        pid: second_player.pid
      })

    replaced_res.should.have.status(200)

    const replacement_res = await chai_request
      .execute(server)
      .post('/api/teams/1/tag/restricted-free-agency')
      .set('Authorization', `Bearer ${user1}`)
      .send({
        leagueId: league_id,
        bid: 6,
        playerTid: team_id,
        release: [],
        remove: second_player.pid,
        pid: third_player.pid
      })

    replacement_res.should.have.status(200)

    const replaced_rows = await changelog_for_bid(replaced_res.body.uid)
    replaced_rows.length.should.equal(2)
    replaced_rows[1].change_type.should.equal(bid_change_types.CANCELLED)
    replaced_rows[1].change_source.should.equal(
      bid_change_sources.API_BID_CREATE
    )
    replaced_rows[1].bid_amount.should.equal(4)
    expect(replaced_rows[1].cancelled_at).to.not.equal(null)
  })

  it('records the settlement of a winning and a losing bid', async () => {
    const league_id = 1
    const original_team_id = 1

    // 24-hour nomination windows, bids processed 3 hours before the next one --
    // the same configuration test/scripts.restricted-free-agency.spec.mjs uses,
    // because the settlement path only reaches a bid whose window is due.
    const period_start = regular_season_start.subtract('3', 'month').unix()
    await knex('seasons')
      .update({
        season_year: current_season.year,
        restricted_free_agency_period_start: period_start,
        restricted_free_agency_period_end: regular_season_start
          .subtract('1', 'month')
          .unix(),
        restricted_free_agency_first_window_at: new Date(period_start * 1000),
        restricted_free_agency_window_hours: 24,
        restricted_free_agency_processing_lead_hours: 3
      })
      .where({ lid: league_id })

    MockDate.set(
      regular_season_start
        .subtract('2', 'month')
        .hour(12)
        .minute(0)
        .second(0)
        .toDate()
    )

    const player = await selectPlayer()

    await addPlayer({
      leagueId: league_id,
      player,
      teamId: original_team_id,
      userId: 1
    })

    const original_res = await chai_request
      .execute(server)
      .post('/api/teams/1/tag/restricted-free-agency')
      .set('Authorization', `Bearer ${user1}`)
      .send({
        // Above the competing bid so the original team is unambiguously in the
        // top-bid set the settlement loop reads. The original team's right of
        // first refusal is exercised elsewhere; this test is about the trail.
        leagueId: league_id,
        bid: 25,
        playerTid: original_team_id,
        release: [],
        pid: player.pid
      })

    original_res.should.have.status(200)

    const competing_res = await chai_request
      .execute(server)
      .post('/api/teams/2/tag/restricted-free-agency')
      .set('Authorization', `Bearer ${user2}`)
      .send({
        leagueId: league_id,
        bid: 20,
        playerTid: original_team_id,
        release: [],
        pid: player.pid
      })

    competing_res.should.have.status(200)

    // Put the announcement 30 hours in the past so the window is past its
    // processing time; the window mechanics themselves are covered by
    // test/scripts.restricted-free-agency.spec.mjs.
    const announcement_time = Math.round(Date.now() / 1000) - 60 * 60 * 30
    await knex('restricted_free_agency_nominations')
      .where({
        league_id,
        player_id: player.pid,
        season_year: current_season.year
      })
      .update({
        nominated_at: knex.raw('to_timestamp(?)', [announcement_time - 3600]),
        announced_at: knex.raw('to_timestamp(?)', [announcement_time])
      })

    await run_restricted_free_agency_settlement({ dry_run: false })

    const original_rows = await changelog_for_bid(original_res.body.uid)
    const settled_original = original_rows[original_rows.length - 1]
    settled_original.change_type.should.equal(bid_change_types.SETTLED)
    settled_original.change_source.should.equal(
      bid_change_sources.SETTLEMENT_SCRIPT
    )
    // Settlement is automatic, so there is no actor. The manager who submitted
    // the bid is still on the row as bid_user_id.
    expect(settled_original.changed_by_user_id).to.equal(null)
    settled_original.bid_user_id.should.equal(1)
    settled_original.is_successful.should.equal(true)
    settled_original.outcome.should.equal(
      restricted_free_agency_bid_outcomes.WON
    )
    expect(settled_original.processed_at).to.not.equal(null)

    const competing_rows = await changelog_for_bid(competing_res.body.uid)
    const settled_competing = competing_rows[competing_rows.length - 1]
    settled_competing.change_type.should.equal(bid_change_types.SETTLED)
    settled_competing.is_successful.should.equal(false)
    settled_competing.outcome.should.equal(
      restricted_free_agency_bid_outcomes.MATCHED
    )
    // The losing bid's amount is preserved even though it never signed anyone.
    settled_competing.bid_amount.should.equal(20)
  })

  it('refuses to record a change it cannot describe truthfully', async () => {
    let error_message = null
    try {
      await record_bid_change({
        bid_type: bid_types.RESTRICTED_FREE_AGENCY,
        bid_id: 999999,
        change_type: bid_change_types.UPDATED,
        change_source: bid_change_sources.API_BID_UPDATE
      })
    } catch (err) {
      error_message = err.message
    }

    // A trail row for a bid that does not exist would be a gap that reads as a
    // real record, so the helper throws rather than writing one.
    expect(error_message).to.match(/no restricted_free_agency_bids row/)

    for (const invalid_call of [
      { bid_type: 'not_a_bid_type' },
      { change_type: 'not_a_change_type' },
      { change_source: 'not_a_change_source' }
    ]) {
      let vocabulary_error = null
      try {
        await record_bid_change({
          bid_type: bid_types.RESTRICTED_FREE_AGENCY,
          bid_id: 1,
          change_type: bid_change_types.UPDATED,
          change_source: bid_change_sources.API_BID_UPDATE,
          ...invalid_call
        })
      } catch (err) {
        vocabulary_error = err.message
      }
      expect(vocabulary_error).to.match(/invalid/)
    }
  })
})
