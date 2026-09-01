import { auction_election_outcomes, AUCTION_BID_INCREMENT } from '#constants'

/**
 * Second-price resolution for one nominated auction player.
 *
 * PURE. No database, no clock, no socket. `auction-settlement.mjs` owns
 * persistence around it and passes the world in. That split is what makes
 * exhaustive coverage of ties, re-resolution and the price rule affordable --
 * the same extraction that lets the scoreboard socket's query builder be tested
 * without standing up a socket.
 *
 * @param {object} params
 * @param {Array<object>} params.claims - one per team holding an election or a
 *   placed bid on this player. Each is
 *   `{ tid, maximum_bid, amount_set_at, election_id, user_id }`, where a null
 *   `maximum_bid` is a DECLINE.
 * @param {Map<number, object>} params.rosters - tid -> a capacity view of the
 *   team at settlement time: `{ available_space, available_cap, is_eligible_for_slot }`.
 *   Supplied by the caller from `Roster`, never derived here.
 * @param {number} params.nominating_team_id - holds the opening claim and wins ties on it
 * @param {number} params.opening_bid - the nominating team's bid; the price floor
 * @returns {{ winner_tid: number|null, price: number, outcomes: Map<number, {outcome: string}> }}
 */
export const resolve_auction_player = ({
  claims = [],
  rosters,
  nominating_team_id,
  opening_bid = 0
}) => {
  const outcomes = new Map()

  // A decline never competes and never wins, including on re-resolution after
  // the leader is disqualified. It satisfies completeness and nothing else.
  const declines = claims.filter(
    (claim) => claim.maximum_bid === null || claim.maximum_bid === undefined
  )
  for (const decline of declines) {
    outcomes.set(decline.tid, { outcome: auction_election_outcomes.DECLINED })
  }

  // A team's EFFECTIVE maximum is min(stated, availableCap). A team can win an
  // early player and leave a later ceiling unfundable; capping rather than
  // invalidating keeps them in contention at a price they can afford and
  // preserves the monotonicity the whole settlement model rests on.
  const contenders = []
  for (const claim of claims) {
    if (claim.maximum_bid === null || claim.maximum_bid === undefined) continue

    const roster = rosters.get(claim.tid)

    // Disqualifications are checked against the OPENING bid, not the resolved
    // price: the price is not known until the field is ranked, and a team that
    // cannot afford the floor cannot afford anything above it.
    if (!roster || roster.available_space < 1) {
      outcomes.set(claim.tid, {
        outcome: auction_election_outcomes.ROSTER_FULL
      })
      continue
    }

    if (!roster.is_eligible_for_slot) {
      outcomes.set(claim.tid, {
        outcome: auction_election_outcomes.POSITION_LIMIT
      })
      continue
    }

    const effective_maximum = Math.min(claim.maximum_bid, roster.available_cap)

    if (effective_maximum < opening_bid) {
      outcomes.set(claim.tid, {
        outcome: auction_election_outcomes.BUDGET_EXCEEDED
      })
      continue
    }

    contenders.push({ ...claim, effective_maximum })
  }

  if (!contenders.length) {
    return { winner_tid: null, price: opening_bid, outcomes }
  }

  // Rank: highest effective maximum first, then the nominating team, then the
  // election whose WINNING AMOUNT was set earliest. `amount_set_at` rather than
  // `submitted_at` is the whole point -- otherwise a manager parks a low maximum
  // on day one, raises it, drops it back, and keeps day-one priority.
  const ranked = [...contenders].sort((a, b) => {
    if (b.effective_maximum !== a.effective_maximum) {
      return b.effective_maximum - a.effective_maximum
    }
    if (a.tid === nominating_team_id) return -1
    if (b.tid === nominating_team_id) return 1
    return new Date(a.amount_set_at) - new Date(b.amount_set_at)
  })

  const winner = ranked[0]
  const runner_up = ranked[1]

  // The price is the second-highest claim plus one increment, floored at the
  // opening bid and capped at the winner's own effective maximum. The cap is
  // what makes a TIE the one case where the winner pays their own maximum: at
  // equal claims the uncapped result of max + 1 caps back down to max, so
  // nobody is charged above what they stated and the tiebreak decides only who
  // pays it.
  const uncapped_price = runner_up
    ? runner_up.effective_maximum + AUCTION_BID_INCREMENT
    : opening_bid
  const price = Math.min(
    winner.effective_maximum,
    Math.max(uncapped_price, opening_bid)
  )

  outcomes.set(winner.tid, { outcome: auction_election_outcomes.WON })

  for (const loser of ranked.slice(1)) {
    outcomes.set(loser.tid, {
      outcome:
        loser.effective_maximum === winner.effective_maximum
          ? auction_election_outcomes.LOST_TIEBREAK
          : auction_election_outcomes.OUTBID
    })
  }

  return { winner_tid: winner.tid, price, outcomes }
}

export default resolve_auction_player
