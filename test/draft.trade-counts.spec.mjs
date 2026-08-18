/* global describe before after it */
import * as chai from 'chai'
import chai_http, { request as chai_request } from 'chai-http'
import MockDate from 'mockdate'

import server from '#api'
import knex from '#db'
import league from '#db/fixtures/league.mjs'
import draft_picks from '#db/fixtures/draft-picks.mjs'
import { current_season } from '#constants'

process.env.NODE_ENV = 'test'
chai.use(chai_http)
const expect = chai.expect
const { regular_season_start } = current_season

// The route counts trades per pick over a `trades_picks` -> `trades` join, and
// both tables carry `trade_id` since the key-column conform. An unqualified
// count is therefore a 42702 that rejects the whole statement -- which the SQL
// is well-formed enough to hide from anything short of executing it, so this
// spec drives the route against a seeded database rather than inspecting the
// query builder.
describe('API /leagues/:leagueId/draft - trade counts', function () {
  before(async function () {
    this.timeout(60 * 1000)
    MockDate.set(regular_season_start.subtract('1', 'month').toISOString())
    await knex.seed.run()
    await league(knex)
    await draft_picks(knex)
  })

  after(() => {
    MockDate.reset()
  })

  it('counts the accepted trades each pick appears in', async () => {
    const picks = await knex('draft')
      .where({ lid: 1, season_year: current_season.year })
      .orderBy('draft_pick_id', 'asc')
      .limit(3)
    const [twice_traded, once_traded, never_traded] = picks

    const offered_at = new Date()
    const insert_trade = async ({ accepted }) => {
      const rows = await knex('trades')
        .insert({
          propose_tid: 1,
          accept_tid: 2,
          lid: 1,
          user_id: 1,
          season_year: current_season.year,
          offered: offered_at,
          accepted
        })
        .returning('trade_id')
      return rows[0].trade_id
    }

    const first_accepted = await insert_trade({ accepted: offered_at })
    const second_accepted = await insert_trade({ accepted: offered_at })
    // A pending trade must NOT be counted -- the join filters on accepted.
    const pending = await insert_trade({ accepted: null })

    await knex('trades_picks').insert([
      {
        trade_id: first_accepted,
        tid: 2,
        draft_pick_id: twice_traded.draft_pick_id
      },
      {
        trade_id: first_accepted,
        tid: 2,
        draft_pick_id: once_traded.draft_pick_id
      },
      {
        trade_id: second_accepted,
        tid: 1,
        draft_pick_id: twice_traded.draft_pick_id
      },
      { trade_id: pending, tid: 2, draft_pick_id: never_traded.draft_pick_id }
    ])

    const res = await chai_request
      .execute(server)
      .get('/api/leagues/1/draft')
      .query({ year: current_season.year })

    expect(res.status).to.equal(200)

    const by_pick_id = new Map(
      res.body.picks.map((pick) => [pick.draft_pick_id, pick.trade_count])
    )
    expect(by_pick_id.get(twice_traded.draft_pick_id)).to.equal(2)
    expect(by_pick_id.get(once_traded.draft_pick_id)).to.equal(1)
    expect(by_pick_id.get(never_traded.draft_pick_id)).to.equal(0)
  })
})
