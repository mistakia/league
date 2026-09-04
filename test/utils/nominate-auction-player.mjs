import knex from '#db'
import { current_season, transaction_types } from '#constants'
import { submit_auction_election } from '#libs-server/auction-elections.mjs'

/**
 * Open a nomination the way the socket does, with the nominator's optional
 * ceiling.
 *
 * SHARED BECAUSE THE CEILING IS THE REASON. A nomination binds its nominator to
 * the opening bid but does not DISCHARGE it, so every spec that wants a player
 * to settle now needs the nominator to elect -- and that turned one insert into
 * an insert plus a conditional election in each spec that had hand-rolled its
 * own nomination helper. Copying that second half per file is how the two
 * copies drift, and the half that drifts is the one encoding the rule.
 *
 * `maximum_bid` null means the nominator stated NO ceiling and stays in the
 * outstanding set. It is not a decline: a team cannot decline the player it
 * nominated, so `submit_auction_election` would refuse one here.
 *
 * @param {object} params
 * @param {number} params.lid
 * @param {string} params.pid
 * @param {number} params.tid - the nominating team
 * @param {number} [params.value] - the opening bid
 * @param {number} [params.user_id]
 * @param {number|null} [params.maximum_bid] - null leaves the nominator outstanding
 */
export const nominate_auction_player = async ({
  lid,
  pid,
  tid,
  value = 0,
  user_id = 1,
  maximum_bid = null,
  season_year = current_season.year
}) => {
  await knex('transactions').insert({
    user_id,
    tid,
    pid,
    lid,
    type: transaction_types.AUCTION_BID,
    player_salary: value,
    week: 0,
    season_year,
    occurred_at: new Date()
  })

  if (maximum_bid !== null) {
    await submit_auction_election({ lid, tid, pid, user_id, maximum_bid })
  }

  return pid
}

/**
 * The same nomination, against the first unrostered running back on the board.
 *
 * Two specs picked their own player with an identical rostered-exclusion query
 * before nominating it, so the query lives here rather than in each.
 */
export const nominate_free_agent_running_back = async ({
  lid,
  tid,
  value = 0,
  user_id = 1,
  maximum_bid = null,
  season_year = current_season.year
}) => {
  const rostered = await knex('rosters_players')
    .join('rosters', 'rosters.roster_id', 'rosters_players.roster_id')
    .where('rosters.lid', lid)
    .pluck('rosters_players.pid')

  const [player] = await knex('player')
    .whereNot('current_nfl_team', 'INA')
    .where('primary_position', 'RB')
    .whereNotIn('pid', rostered.length ? rostered : [''])
    .orderBy('pid')
    .limit(1)

  if (!player) throw new Error('no unrostered running back on the board')

  return nominate_auction_player({
    lid,
    pid: player.pid,
    tid,
    value,
    user_id,
    maximum_bid,
    season_year
  })
}

export default { nominate_auction_player, nominate_free_agent_running_back }
