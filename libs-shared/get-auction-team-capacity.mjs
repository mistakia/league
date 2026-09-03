import { roster_slot_types } from '#constants'

/**
 * One team's capacity for one player at one price.
 *
 * THE ELIGIBLE-SET PREDICATE, and it lives here because both sides of the app
 * need it and neither may own it. The server asks it to decide who the auction
 * is still waiting on and who a settlement may sign; the bid bar asks it to
 * decide whether to offer a manager a bid, a decline or a maximum at all. A
 * client that answered it separately would be the second implementation this
 * subsystem has already been burned by -- three disagreeing budget comparisons
 * existed in the socket alone before the redesign -- so the rule is written
 * once and both callers hand it a `Roster`.
 *
 * The three terms are the league's existing acquisition predicate with the
 * current price in place of the bid amount. They are also REPORTED separately,
 * because "you cannot have this player" is not an answer a manager can act on:
 * a full roster, a position limit and a short budget are different situations,
 * the resolver already distinguishes roster_full from position_limit in its
 * outcomes, and only the budget term can still move.
 *
 * The budget comparison is `>=`, not `>`. min_bid is $0 and 36% of historical
 * wins went for exactly $0, so a team with an open roster spot participates at
 * $0 regardless of remaining budget; the strict form would silently exclude a
 * $0-cap team from every free player, which matching $0 can win under the
 * nomination tiebreak.
 *
 * `is_eligible_for_slot` on a BENCH slot delegates to
 * `has_bench_space_for_position`, which is `!isFull && has_position_capacity`,
 * so it already subsumes the space and position terms -- they are returned
 * beside it rather than derived from it.
 *
 * @param {object} params
 * @param {object} params.roster - a libs-shared `Roster` for the team
 * @param {string} params.player_position - the player's primary position
 * @param {number} params.current_price - the price on the board right now
 * @returns {object} the terms and their conjunction
 */
export const get_auction_team_capacity = ({
  roster,
  player_position,
  current_price
}) => {
  const available_space = roster.availableSpace
  const available_cap = roster.availableCap

  const has_roster_space = available_space >= 1
  const has_position_capacity = roster.has_position_capacity(player_position)
  const has_cap_space = available_cap >= current_price
  const is_eligible_for_slot = roster.isEligibleForSlot({
    slot: roster_slot_types.BENCH,
    pos: player_position
  })

  return {
    available_space,
    available_cap,
    has_roster_space,
    has_position_capacity,
    has_cap_space,
    is_eligible_for_slot,
    is_eligible: is_eligible_for_slot && has_roster_space && has_cap_space
  }
}

export default get_auction_team_capacity
