# Run or Change the Free Agency Auction

**When to read this:** Read before touching anything under `api/sockets/auction.mjs`, `libs-server/auction-*.mjs`, `api/routes/leagues/auction-*.mjs` or the `auction-*` components — and before an auction runs.

The subsystem's design, its evidence, and the incidents behind each rule live in `user:text/league/auction-system.md`. This guide carries what a session changing the code has to know.

---

## The one fact that has caused every defect here

**IN ELECTION MODE THE SOCKET IS NOT THE WRITER.** Managers elect over REST, so **every** settlement in an election-mode auction fires from a REST route. Three consequences, and each has already shipped broken once:

- Any socket cache of `transactions` is stale by default. Reload before reading the rotation, the open player or the current price.
- A settlement must announce itself the same way from every path. `broadcast_auction_settlement` in `libs-server/auction-settlement.mjs` is that one fan-out — Discord, the sale, the advanced nomination turn, the recomputed outstanding set. It is called by the socket and by all three REST paths that can settle a player. Adding a fourth path means calling it, not writing a fourth broadcast.
- **The Discord half of that fan-out takes an injected `announce`, and a spec that does not inject cannot see it.** `announce_auction_settlement` is a separate export for one reason: `send-notifications` refuses outside `NODE_ENV=production` and there is no module-stubbing dependency in this repo, so the call is unobservable otherwise — and it shipped unobserved, guarded by a comment naming the defect and by no assertion. The block announcer carries the same seam for the same reason. Two consequences when you touch either. **Mutating the message builder does not prove the builder is CALLED** — score a settlement or block announcement change by deleting the call site, which is the mutant `test/auction.settlement-announcement.spec.mjs` is built around. And **the guard lives at the call site, not inside the announcer**, so a notification failure cannot take the sale broadcast down with it whether the announcer is the shipped one or an injected one.
- A broadcast with no reducer case is invisible. It does not error; the client simply freezes. Two message types shipped that way and every manager watched a stale outstanding list for the length of an auction.

**And a JOIN is per SOCKET, so a reconnect is a new client the auction has never heard of.** Broadcasts still arrive — those are filtered on the league id the connection query string carries — so the board looks live while the server has no message handlers for that socket and every bid it sends is dropped with no error, the team reads as disconnected, and `pause_on_team_disconnect` holds the whole league. `rejoin_auction` re-sends `AUCTION_JOIN` on `WEBSOCKET_RECONNECTED`, guarded on this client having joined, because `_send_auction_init` broadcasts rather than replies and every client in the league sees one whenever anybody joins.

## Mode is derived, never stored

`libs-server/auction-modes.mjs` is the single answer to "which mode is in force". `live` inside a finalized block and from the final block to the period end; `election` everywhere else.

**Do not consult `is_auction_election_mode_enabled` to answer it.** That column selects which auction SYSTEM a league-season runs — this design, or the pre-2026 timer-driven open outcry it rolls back to. A season boolean answering the mode question is a second source of truth that disagrees the moment a block convenes.

A block boundary is a wall-clock event with no message behind it, so the socket POLLS for it. That poll is also what arms the clocks on a socket that boots inside a block: `_election_mode` starts `false`, which is a real mode rather than "unknown", so the first resolve must transition even when it agrees with the default. Without that the block convenes and then does nothing at all.

## One pricing rule, two callers

`libs-server/resolve-auction-player.mjs` is pure and owns the rule: the price is the second-highest claim plus one increment, capped at the highest, and the highest claim leads. It decides an election-mode settlement AND a live-mode proxy step. Do not write a second pricing model for blocks — the proxy engine calls this one against the live board and writes the single bid that restores the equilibrium.

Two properties that look like details and are not:

- **A proxy step does not reset the bid clock. Only a human bid does.** A fully-proxied player settles one bid clock after nomination however many teams wanted them, which is what makes a large final block tractable. **The SERVER owns the countdown and announces it as `AUCTION_TIMER` whenever the running clock changes** — a bid broadcast is not a clock event. The client used to rebuild the countdown from a duration on every `AUCTION_BID`, so a proxy step put a fresh clock on screen while the sale was seconds away, and a reconnecting client got no countdown at all because `AUCTION_INIT` carried durations and no expiry.
- **Supersession binds a claim DOWNWARD and is socket state**, in `_manual_bids`. From the transaction log an engine bid and a human bid are the same row by design, so only the live socket can tell them apart; `build_auction_claims` stays raise-only for the REST paths that cannot.

## Eligibility must stay monotone

A team that leaves an eligible set never re-enters it, and completeness once reached stays reached. Second-price settlement rests on that. Anything that fills an active roster spot without passing through settlement breaks it, so:

- A trade and a commissioner-override release call `reevaluate_auction_after_roster_change`.
- Free agency waivers, poaching waivers and poaching CLAIMS all hold until the auction completes. Practice-squad waivers deliberately do not — a practice add consumes no active spot and no cap.

Auction completion is DERIVED from an exhausted nomination rotation with the period end as the backstop. Do not add a column for it.

## Two writers, one open player, and they can disagree

Inside a live block the bid clock is NOT the only thing that can close the open
player. A manager completing the eligible set over REST settles it, and so does a
trade or a commissioner-override release through
`reevaluate_auction_after_roster_change`. So `sold()` takes the same per-league
advisory lock every settlement path takes, and re-reads the nomination under it
rather than signing from `_transactions[0]`.

**They resolve to different teams when they disagree, which is why serialising
them is not merely tidy.** Supersession binds a claim downward in `_manual_bids`,
which `build_auction_claims` is deliberately blind to, so the engine can read an
un-superseded ceiling and name a winner the board does not show. Unserialised
that put one player on two rosters and charged both teams.

## The final block is measured from the period start, never from `now`

`calculate_final_block` floors on `period_start + notice` and calls a window
failed when the computation lands before `period_start`. Both were once compared
against `now`, and both then pushed the block another notice-width out on every
read — a receding horizon the clock could never reach, so the auction's only
termination guarantee collapsed to the last hour of the period with the whole
pace reservation discarded.

**Notice is owed from when the block becomes KNOWABLE.** The final block carries
no opt-in, is published from the first read of the calendar, and every term in it
is configuration or rosters. And a block the clock has passed is RUNNING, not
failed; that is the normal state for the last hours of every auction.

**Assert this by walking the clock.** A single-instant assertion cannot tell a
receding floor from a correct one — `now + notice` is what both produce — and
that is exactly how it shipped with a past-case test and a notice test both
green.

## Finalization is the one thing recorded

`auction_blocks` exists because the unanimity denominator freezes at finalization and rosters carry no as-of timestamp. Re-deriving finalization from the opt-in rows would silently un-finalize a block the league has already been told is happening.

**Finalization is evaluated CONCURRENTLY as a matter of course** — on the opt-in write and on every read of the schedule, including the socket mode poll every fifteen seconds — so it runs in one transaction under the league advisory lock, and the convening announcement fires after the commit. The unique index settles insert against insert and nothing else: an EXTEND racing an INSERT put a real duplicate session on a real league, which is a phantom block on the calendar and a second announcement asking managers to attend a session they were already told about.

The final block is the opposite: computed on demand, no row, because every term is configuration or derived from the rosters. A column would be a second source of truth that can disagree with the board.

## Testing it

**Only running it finds these defects.** Every one this subsystem has produced came from executing the behavior; none came from reading the source. Two rules follow:

- **Write the spec that drives the ROUTE, not the library behind it.** Both election write verbs declared a bodyless 200 in their own OpenAPI blocks and returned 500 under the test-env response validator, for exactly as long as no spec called them.
- **The clock is addressable, and count it by NAME.** `api/sockets/auction.mjs` takes an injected timer through the `Auction` constructor; `test/auction.proxy-bidding.spec.mjs` is the worked example. `MockDate` moves `Date.now` without moving `setTimeout`, so it cannot drive any of this alone. Call `auction.stop()` in teardown — the mode poll re-arms itself. Every `set_timeout` carries an `AUCTION_TIMERS` name because the three clocks are NOT distinguishable by duration: the padded bid clock and the mode poll are both 15,000ms in `config-test.json`, so counting durations counted two clocks as one.
- **A saga cannot be driven from a spec here.** `@core/ws` re-exports `service.js`, which imports `@core/store`, which reads `window.__INITIAL_STATE__` and builds browser history at module scope — and there is no jsdom. Cover the reducer, which is where a broadcast actually dies, and say plainly what is left to a source gate.
- **A `dayjs/plugin/*` import needs its `.js`.** Webpack resolves both spellings; Node's ESM loader does not hand back the plugin function without the extension, so `dayjs.extend` throws at module scope and aborts every spec whose import graph reaches that file, reported as a load failure with no test names in it.

`config-test.json` carries `nominationTimer` and `bidTimer`. It did not until 2026-09-02, and without them every timer in the test environment was scheduled at `NaN`.

## Sealed bids are scoped by OWNERSHIP, not by authorization

`verifyUserTeam` passes a league's commissioner for every team in it. That is right for the roster, lineup and trade routes it was written for and wrong for the standing-elections read, because in this league the commissioner is a competing manager and a maximum is a sealed bid — so `GET /auction-elections` additionally requires the caller to own the team, and is deliberately narrower than the helper it calls.

The write verbs deliberately still take the commissioner branch. **Operator ruling, 2026-09-02: a commissioner writing another team's election is allowable, and admin privileges are appropriate there.** The asymmetry is the point and is not an oversight to be tidied up later — reading a sealed maximum reveals it, and writing one does not. Do not narrow the write verbs to match the read.

## Driving the real thing

`scripts/drive-auction-end-to-end.mjs` drives the whole subsystem against a real hosted league — elections, second-price settlement, the four-effect broadcast fan-out on a connected socket, block convening and merging, mode resolution, and proxy bidding inside a block. Run it after any change here:

```
node scripts/drive-auction-end-to-end.mjs --lid 119
```

It boots the working-tree API in-process against the production database, refuses league 1 and any league carrying a Discord webhook, and tears down everything it wrote at both ends of the run — `--teardown-only` recovers a league from a run that was killed. Budget about 20 minutes; the block scenario alone is 30 opt-in round trips.

**Pick teams by their BUDGET, not by their team id.** A cloned board carries real rosters and real caps, and league 119 has a team with $0. An unfundable ceiling caps to $0 and settles for reasons that have nothing to do with the rule under test; an unfundable bid is refused on `AUCTION_ERROR` and broadcasts nothing, which looks exactly like a proxy engine that never fired. Both cost this script a debugging pass.

**Match a broadcast on its CONTENT, not on its arrival order.** Every settlement-status broadcast is sent after its response returns, so "the next one after this request" is routinely the previous one still in flight — which reads as a list that never shrinks.

The auction page needs 15 to 25 seconds before the block calendar renders, because the board and the player set load first. `AUCTION_INIT` alone measures 25 seconds against a ten-team board: `Auction.setup` walks every roster for capacities and `_refresh_mode` walks them twice more, for the block-eligible set and for the final block's spots remaining. Two readings during the increment-two build called the page broken on a four-second wait when it was merely slow. Wait, then assert.
