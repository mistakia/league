/* global describe before beforeEach afterEach it */
import * as chai from 'chai'
import MockDate from 'mockdate'

import knex from '#db'
import league from '#db/fixtures/league.mjs'
import getLeague from '#libs-server/get-league.mjs'
import { current_season, transaction_types } from '#constants'
import Auction from '#api/sockets/auction.mjs'
import { submit_auction_election } from '#libs-server/auction-elections.mjs'
import { settle_auction_player_if_complete } from '#libs-server/auction-settlement.mjs'
import { selectPlayer } from './utils/index.mjs'

process.env.NODE_ENV = 'test'
const expect = chai.expect

const league_id = 1
const season_year = current_season.year

// THE BID CLOCK AND A REST SETTLEMENT ARE TWO WRITERS ON ONE OPEN PLAYER.
//
// In election mode the socket never settles anything, so there is one writer and
// the advisory lock in `settle_auction_player_if_complete` is the whole story.
// Inside a live block that stops being true: the bid clock fires `sold()` on the
// socket while a manager can still complete the eligible set over REST, and a
// trade or a commissioner-override release reaches the same settlement through
// `reevaluate_auction_after_roster_change`. Nothing had ever run the two against
// each other.
//
// They can resolve to DIFFERENT TEAMS, which is what makes this worse than a
// duplicate write. Supersession -- a team bidding below its own ceiling -- is
// socket state in `_manual_bids` and `build_auction_claims` is deliberately
// raise-only, so the socket and the settlement engine read the same board and
// name different winners. Two roster rows for one player, two teams charged.
describe('auction settlement against a firing bid clock', function () {
  let now
  let auction
  let timers
  let league_record

  const build_timers = () => {
    const scheduled = []
    return {
      scheduled,
      set_timeout: (fn, ms) => {
        const handle = { fn, ms, cleared: false }
        scheduled.push(handle)
        return handle
      },
      clear_timeout: (handle) => {
        if (handle) handle.cleared = true
      },
      latest: (ms) => [...scheduled].reverse().find((h) => h.ms === ms)
    }
  }

  before(async function () {
    this.timeout(60 * 1000)
    await knex.seed.run()
  })

  afterEach(function () {
    if (auction) auction.stop()
    auction = null
    MockDate.reset()
  })

  beforeEach(async function () {
    this.timeout(60 * 1000)
    now = current_season.regular_season_start.subtract(1, 'month')
    MockDate.set(now.toISOString())
    await league(knex)

    await knex('seasons')
      .where({ lid: league_id, season_year })
      .update({
        free_agency_period_start: now.subtract(1, 'hour').toDate(),
        free_agency_period_end: now.add(5, 'day').toDate(),
        auction_block_notice_minutes: 60,
        is_auction_election_mode_enabled: true
      })

    // Full cap for every team. The draft fixture leaves league teams OVER the
    // cap, and an effective maximum is `min(stated, availableCap)`, so on the
    // stock fixture every ceiling here would cap to nothing and the spec would
    // be measuring the budget term rather than the race.
    await knex('transactions').where({ lid: league_id }).update({
      player_salary: 0
    })

    // Inserted finalized: HOW a block convenes is auction.blocks.spec.mjs. What
    // this spec needs is an auction in live mode, with a bid clock that fires.
    await knex('auction_blocks').insert({
      lid: league_id,
      season_year,
      block_at: now.subtract(5, 'minute').toDate(),
      end_at: now.add(2, 'hour').toDate(),
      finalized_at: now.subtract(1, 'hour').toDate(),
      eligible_team_count: 10
    })

    league_record = await getLeague({ lid: league_id })

    timers = build_timers()
    auction = new Auction({ wss: { clients: [] }, lid: league_id, timers })
    auction.broadcast = () => {}
    await auction.setup()
  })

  const team_ids = async () => {
    const teams = await knex('teams')
      .where({ lid: league_id, season_year })
      .orderBy('draft_order')
    return teams.map((team) => team.team_id)
  }

  // Declines written STRAIGHT TO THE TABLE rather than through
  // `submit_auction_election`, which would settle the player the moment the set
  // completed and leave nothing to race. This constructs the one state the race
  // needs: an eligible set that is complete and a settlement that has not run.
  const decline_directly = async ({ tids, pid }) => {
    const submitted_at = new Date()
    for (const tid of tids) {
      await knex('auction_elections').insert({
        lid: league_id,
        season_year,
        pid,
        tid,
        user_id: 1,
        maximum_bid: null,
        submitted_at,
        amount_set_at: submitted_at
      })
    }
  }

  const rows_for = async (pid) => ({
    roster: await knex('rosters_players').where({
      lid: league_id,
      season_year,
      pid
    }),
    processed: await knex('transactions').where({
      lid: league_id,
      pid,
      type: transaction_types.AUCTION_PROCESSED
    })
  })

  it('signs the open player exactly once when the clock fires mid-settlement', async function () {
    this.timeout(60 * 1000)
    const tids = await team_ids()
    const [nominator, ceiling_team, rival, ...rest] = tids
    const player = await selectPlayer({
      exclude_rostered_players: true,
      random: false
    })
    const pid = player.pid

    // A ceiling nobody can see, and two humans bidding under it.
    await submit_auction_election({
      lid: league_id,
      tid: ceiling_team,
      pid,
      user_id: 1,
      maximum_bid: 30
    })

    await auction.nominate(
      { pid, value: 0, user_id: 1 },
      { user_id: 1, tid: nominator }
    )

    // SUPERSESSION. Bidding below your own ceiling means you meant that amount,
    // so the socket binds this team to $5 and stops proxying for them. The
    // elections table still says $30 and no REST caller can tell.
    await auction.bid({ user_id: 1, tid: ceiling_team, pid, value: 5 })
    await auction.bid({ user_id: 1, tid: rival, pid, value: 8 })

    const leading = auction._transactions[0]
    expect(leading.tid, 'the socket has the rival leading').to.equal(rival)
    expect(leading.player_salary).to.equal(8)

    // Complete the eligible set without settling it.
    await decline_directly({ tids: rest, pid })

    // A settlement transaction is OPEN -- the shape of a manager completing the
    // set over REST, or of a trade reaching the same call, while the block runs.
    const trx = await knex.transaction()
    const settlement = await settle_auction_player_if_complete({
      lid: league_id,
      league: league_record,
      trx
    })
    expect(
      settlement,
      'the set is complete and the engine resolved it'
    ).to.not.equal(null)
    expect(
      settlement.winner_tid,
      'the engine reads the un-superseded ceiling and names a DIFFERENT winner'
    ).to.equal(ceiling_team)

    // The bid clock fires here, against a settlement that has not committed.
    // `_start_bid_timer` schedules exactly `() => this.sold()`, so calling it is
    // the clock firing; not awaited yet, because the point is that both writers
    // are in flight at once.
    const sold = auction.sold()

    await trx.commit()
    await sold

    const { roster, processed } = await rows_for(pid)

    // THE ASSERTIONS THIS SPEC EXISTS FOR. One player, one roster, one sale.
    expect(roster, 'the player is on exactly one roster').to.have.length(1)
    expect(processed, 'the player sold exactly once').to.have.length(1)
    expect(roster[0].tid).to.equal(processed[0].tid)
  })

  it('leaves the auction able to advance after refusing the stale sale', async function () {
    this.timeout(60 * 1000)
    const tids = await team_ids()
    const [nominator, ...others] = tids
    const player = await selectPlayer({
      exclude_rostered_players: true,
      random: false
    })
    const pid = player.pid

    await auction.nominate(
      { pid, value: 0, user_id: 1 },
      { user_id: 1, tid: nominator }
    )

    await decline_directly({ tids: others, pid })

    const trx = await knex.transaction()
    const settlement = await settle_auction_player_if_complete({
      lid: league_id,
      league: league_record,
      trx
    })
    expect(settlement.winner_tid, 'uncontested, to its nominator').to.equal(
      nominator
    )

    const sold = auction.sold()
    await trx.commit()
    await sold

    const { roster, processed } = await rows_for(pid)
    expect(roster).to.have.length(1)
    expect(processed).to.have.length(1)

    // A CONTROL ON THE REFUSAL. Refusing to double-sign is worthless if it also
    // leaves the socket stuck on a player that is gone: the next nomination has
    // to work. Without the reload inside `sold`, `_transactions[0]` still holds
    // the settled player's bid and the rotation never advances.
    const next = await selectPlayer({
      exclude_rostered_players: true,
      exclude_pids: [pid],
      random: false
    })
    await auction.nominate(
      { pid: next.pid, value: 0, user_id: 1 },
      { user_id: 1, tid: auction.nominating_team_id }
    )

    const opened = await knex('transactions').where({
      lid: league_id,
      pid: next.pid,
      type: transaction_types.AUCTION_BID
    })
    expect(opened, 'the next player opened').to.have.length(1)
  })
})
