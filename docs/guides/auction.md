# Run or Change the Free Agency Auction

**When to read this:** Read before touching anything under `api/sockets/auction.mjs`, `libs-server/auction-*.mjs`, `api/routes/leagues/auction-*.mjs` or the `auction-*` components — and before an auction runs.

The subsystem's design, its evidence, and the incidents behind each rule live in `user:text/league/auction-system.md`. This guide carries what a session changing the code has to know.

---

## The one fact that has caused every defect here

**IN ELECTION MODE THE SOCKET IS NOT THE WRITER.** Managers elect over REST, so **every** settlement in an election-mode auction fires from a REST route. Three consequences, and each has already shipped broken once:

- Any socket cache of `transactions` is stale by default. Reload before reading the rotation, the open player or the current price.
- A settlement must announce itself the same way from every path. `broadcast_auction_settlement` in `libs-server/auction-settlement.mjs` is that one fan-out — Discord, the sale, the advanced nomination turn, the recomputed outstanding set. It is called by the socket and by all three REST paths that can settle a player. Adding a fourth path means calling it, not writing a fourth broadcast.
- A broadcast with no reducer case is invisible. It does not error; the client simply freezes. Two message types shipped that way and every manager watched a stale outstanding list for the length of an auction.

## Mode is derived, never stored

`libs-server/auction-modes.mjs` is the single answer to "which mode is in force". `live` inside a finalized block and from the final block to the period end; `election` everywhere else.

**Do not consult `is_auction_election_mode_enabled` to answer it.** That column selects which auction SYSTEM a league-season runs — this design, or the pre-2026 timer-driven open outcry it rolls back to. A season boolean answering the mode question is a second source of truth that disagrees the moment a block convenes.

A block boundary is a wall-clock event with no message behind it, so the socket POLLS for it. That poll is also what arms the clocks on a socket that boots inside a block: `_election_mode` starts `false`, which is a real mode rather than "unknown", so the first resolve must transition even when it agrees with the default. Without that the block convenes and then does nothing at all.

## One pricing rule, two callers

`libs-server/resolve-auction-player.mjs` is pure and owns the rule: the price is the second-highest claim plus one increment, capped at the highest, and the highest claim leads. It decides an election-mode settlement AND a live-mode proxy step. Do not write a second pricing model for blocks — the proxy engine calls this one against the live board and writes the single bid that restores the equilibrium.

Two properties that look like details and are not:

- **A proxy step does not reset the bid clock. Only a human bid does.** A fully-proxied player settles one bid clock after nomination however many teams wanted them, which is what makes a large final block tractable.
- **Supersession binds a claim DOWNWARD and is socket state**, in `_manual_bids`. From the transaction log an engine bid and a human bid are the same row by design, so only the live socket can tell them apart; `build_auction_claims` stays raise-only for the REST paths that cannot.

## Eligibility must stay monotone

A team that leaves an eligible set never re-enters it, and completeness once reached stays reached. Second-price settlement rests on that. Anything that fills an active roster spot without passing through settlement breaks it, so:

- A trade and a commissioner-override release call `reevaluate_auction_after_roster_change`.
- Free agency waivers, poaching waivers and poaching CLAIMS all hold until the auction completes. Practice-squad waivers deliberately do not — a practice add consumes no active spot and no cap.

Auction completion is DERIVED from an exhausted nomination rotation with the period end as the backstop. Do not add a column for it.

## Finalization is the one thing recorded

`auction_blocks` exists because the unanimity denominator freezes at finalization and rosters carry no as-of timestamp. Re-deriving finalization from the opt-in rows would silently un-finalize a block the league has already been told is happening.

The final block is the opposite: computed on demand, no row, because every term is configuration or derived from the rosters. A column would be a second source of truth that can disagree with the board.

## Testing it

**Only running it finds these defects.** Every one this subsystem has produced came from executing the behavior; none came from reading the source. Two rules follow:

- **Write the spec that drives the ROUTE, not the library behind it.** Both election write verbs declared a bodyless 200 in their own OpenAPI blocks and returned 500 under the test-env response validator, for exactly as long as no spec called them.
- **The clock is addressable.** `api/sockets/auction.mjs` takes an injected timer through the `Auction` constructor; `test/auction.proxy-bidding.spec.mjs` is the worked example. `MockDate` moves `Date.now` without moving `setTimeout`, so it cannot drive any of this alone. Call `auction.stop()` in teardown — the mode poll re-arms itself.

`config-test.json` carries `nominationTimer` and `bidTimer`. It did not until 2026-09-02, and without them every timer in the test environment was scheduled at `NaN`.

## Sealed bids are scoped by OWNERSHIP, not by authorization

`verifyUserTeam` passes a league's commissioner for every team in it. That is right for the roster, lineup and trade routes it was written for and wrong for the standing-elections read, because in this league the commissioner is a competing manager and a maximum is a sealed bid — so `GET /auction-elections` additionally requires the caller to own the team, and is deliberately narrower than the helper it calls.

The write verbs still take the commissioner branch. A commissioner placing a rival's binding maximum is a live hole, and closing it is a change to commissioner powers the whole platform shares rather than a bug fix. It needs an operator decision.

## Driving the real thing

`scripts/drive-auction-end-to-end.mjs` drives the whole subsystem against a real hosted league — elections, second-price settlement, the four-effect broadcast fan-out on a connected socket, block convening and merging, mode resolution, and proxy bidding inside a block. Run it after any change here:

```
node scripts/drive-auction-end-to-end.mjs --lid 119
```

It boots the working-tree API in-process against the production database, refuses league 1 and any league carrying a Discord webhook, and tears down everything it wrote at both ends of the run — `--teardown-only` recovers a league from a run that was killed. Budget about 20 minutes; the block scenario alone is 30 opt-in round trips.

**Pick teams by their BUDGET, not by their team id.** A cloned board carries real rosters and real caps, and league 119 has a team with $0. An unfundable ceiling caps to $0 and settles for reasons that have nothing to do with the rule under test; an unfundable bid is refused on `AUCTION_ERROR` and broadcasts nothing, which looks exactly like a proxy engine that never fired. Both cost this script a debugging pass.

**Match a broadcast on its CONTENT, not on its arrival order.** Every settlement-status broadcast is sent after its response returns, so "the next one after this request" is routinely the previous one still in flight — which reads as a list that never shrinks.

The auction page needs 15 to 25 seconds before the block calendar renders, because the board and the player set load first. `AUCTION_INIT` alone measures 25 seconds against a ten-team board: `Auction.setup` walks every roster for capacities and `_refresh_mode` walks them twice more, for the block-eligible set and for the final block's spots remaining. Two readings during the increment-two build called the page broken on a four-second wait when it was merely slow. Wait, then assert.
