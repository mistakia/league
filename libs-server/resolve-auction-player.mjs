import { auction_election_outcomes, AUCTION_BID_INCREMENT } from '#constants'

/**
 * The earliest instant a team was on record for at least `amount`.
 *
 * THE TIEBREAK RANKS ON THE EFFECTIVE MAXIMUM, SO ITS TIMESTAMP MUST TOO. The
 * claim builder cannot answer this: the effective maximum is
 * `min(stated, available_cap)` and the caps arrive here, so a timestamp attached
 * upstream necessarily belongs to the STATED amount. Whenever a claim was
 * clamped that is an amount which never took effect, and the team was ranked on
 * a moment it never committed to the number it is competing at.
 *
 * The rule is the earliest commitment that COVERS the ranked amount. A
 * commitment below it is not evidence of anything at this price -- a $5 bid says
 * nothing about $10 -- and the earliest covering one is exactly "when did this
 * team put at least this much on the table", which is what the priority rule
 * claims to measure.
 *
 * It also settles the equal-amount case the old raise-guard got wrong. A team
 * that bid $5 and later elected $5 holds two commitments at $5; the earlier one
 * wins, so the money on the wire keeps its priority instead of losing it to its
 * own confirmation.
 *
 * Returns null when nothing covers the amount. Both routes to it are nominator
 * claims built with no bids in hand: the synthetic claim, which carries no
 * commitments at all, and the raise branch beside it, which lifts an existing
 * claim's `maximum_bid` to the opening bid without recording an instant for it.
 * The second one can therefore return null while holding commitments. Neither is
 * reachable from a shipped caller, since the nomination is always the first row
 * in `bids`.
 */
const earliest_commitment_at = ({ commitments = [], amount }) => {
  let earliest = null
  for (const commitment of commitments) {
    if (commitment.amount < amount) continue
    const at = new Date(commitment.at).getTime()
    if (Number.isNaN(at)) continue
    if (earliest === null || at < earliest) earliest = at
  }
  return earliest
}

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
 *   `{ tid, maximum_bid, commitments, election_id, user_id }`, where a null
 *   `maximum_bid` is a DECLINE and `commitments` is every
 *   `{ amount, at }` the team is on record for -- one per placed bid plus its
 *   election. The tiebreak instant is DERIVED from those rather than supplied,
 *   because it depends on the clamped amount and only this function knows the
 *   caps.
 * @param {Map<number, object>} params.rosters - tid -> a capacity view of the
 *   team at settlement time: `{ available_space, available_cap, is_eligible_for_slot }`.
 *   Supplied by the caller from `Roster`, never derived here.
 * @param {number} params.nominating_team_id - holds the opening claim and wins ties on it
 * @param {number} params.opening_bid - THE PRICE FLOOR: the highest binding
 *   amount already on the wire for this player. That is the nominating team's
 *   opening bid until somebody bids above it, and the highest placed bid
 *   thereafter. It is not merely the opening bid, because a placed bid is
 *   binding: a team that bid $11 and then withdrew its $30 ceiling wins at $11
 *   if nobody outbids, and must not be refunded down to $1 because its rivals
 *   folded. In election mode the nomination is usually the only bid and the two
 *   readings coincide.
 * @returns {{ winner_tid: number|null, price: number, outcomes: Map<number, {outcome: string}>, ranked_contenders: Array<{tid: number, effective_maximum: number}> }}
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

    contenders.push({
      ...claim,
      effective_maximum,
      committed_at: earliest_commitment_at({
        commitments: claim.commitments,
        amount: effective_maximum
      })
    })
  }

  if (!contenders.length) {
    return {
      winner_tid: null,
      price: opening_bid,
      outcomes,
      ranked_contenders: []
    }
  }

  // Rank: highest effective maximum first, then the nominating team, then the
  // team that committed to the RANKED AMOUNT earliest. Ranking on when the
  // amount was committed rather than on when the row was created is the whole
  // point -- otherwise a manager parks a low maximum on day one, raises it,
  // drops it back, and keeps day-one priority.
  //
  // A null `committed_at` reaches the comparator only from a synthetic nominator
  // claim carrying no commitments, and the nominating branch above returns
  // before that can be compared against anything. Treated as the epoch rather
  // than thrown on, which is what a missing timestamp already did.
  const ranked = [...contenders].sort((a, b) => {
    if (b.effective_maximum !== a.effective_maximum) {
      return b.effective_maximum - a.effective_maximum
    }
    if (a.tid === nominating_team_id) return -1
    if (b.tid === nominating_team_id) return 1
    return (a.committed_at ?? 0) - (b.committed_at ?? 0)
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

  // RANKED CONTENDERS COME BACK WITH THE RESULT, because the completeness rule
  // needs the runner-up's ceiling and nothing else here can supply it. A claim's
  // effective maximum is `min(stated, available_cap)` and the caps arrive at this
  // function, so `get_outstanding_election_team_ids` cannot rank anything for
  // itself -- and re-ranking upstream would be a second copy of the clamp, the
  // disqualifications and the ordering.
  //
  // Only `tid` and `effective_maximum` are exposed. The consumer asks one
  // question of this list -- what would a further claim have to beat -- and the
  // rest of a contender is its identity, its commitments and its election, none
  // of which that question needs.
  return {
    winner_tid: winner.tid,
    price,
    outcomes,
    ranked_contenders: ranked.map(({ tid, effective_maximum }) => ({
      tid,
      effective_maximum
    }))
  }
}

export default resolve_auction_player
