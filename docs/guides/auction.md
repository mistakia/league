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

Three things make that rejoin actually land, and each was missing once:

- **A repeated `clientId` is a RECONNECT, not a duplicate.** It is a uuid minted once per page load, so every socket a tab opens carries the same one. `join` refuses a repeat from a DIFFERENT user and supersedes one from the same user — new handlers, a fresh `AUCTION_INIT`, the old socket terminated, and no second entry in `_connected`. The close handler checks it still owns the client id before deregistering anything, because the replaced socket's close arrives after the reconnect by definition and used to remove the presence the live socket was standing on. **`!current` counts as not owning it**: the entry is deleted only by that handler, so its absence means the teardown already ran, and falling through runs it twice.
- **`join` claims the client id BEFORE its first `await`.** The socket message handler is `async` and its promise is never awaited, so two `AUCTION_JOIN` frames on one socket interleave — and the client sends exactly that pair, from AuctionControls' mount effect and the reconnect saga. With the claim written after `_resolve_acting_team_id`, both frames read an empty slot, both passed the same-socket check, and both registered a message handler, so the socket bid twice for every bid at two prices against one cap.
- **A deliberate socket swap is still a new socket.** `connect_auth` replaces the connection on sign-in, and `closeWS` detaches `onclose` on purpose, so that swap dispatches no `WEBSOCKET_CLOSE` and the reconnect loop never runs. It puts `WEBSOCKET_RECONNECTED` itself, after `connect`. Without it the join sent by AuctionControls' mount effect could go out on the socket about to be discarded — or on the pre-auth one, which `api/sockets/index.mjs` drops unread — and nothing ever re-sent it.
- **A browser socket carries no heartbeat, so `api/index.mjs` pings.** A phone that changes network sends no FIN; the connection stays ESTABLISHED here until TCP gives up. The client's own `KEEPALIVE` cannot answer this — it is one-directional, and a backgrounded tab whose timers are frozen stops sending it while still connected. A protocol ping is answered by the socket rather than by script, which is what separates a frozen tab from a dead connection.

## A registration may wait for a socket. A COMMAND may not.

`app/core/ws/service.js` cannot write to a socket that has not opened, so it buffers — and the buffer is the reason a bid can arrive as a decision nobody made. `send` queues only when the caller passes `queue_until_open`, which is the caller stating that this message is a per-socket REGISTRATION: idempotent, carrying no board state, correct to replay onto whatever socket opens. Exactly two messages qualify, `AUCTION_JOIN` and `SCOREBOARD_REGISTER`, and `test/websocket.send-queue.spec.mjs` enumerates them from the tree rather than from those two names.

Everything else is a command against a board snapshot. `AUCTION_BID` names a price the manager picked from what was in front of them; delivered a minute later it bids at a price the board has moved past, against a real cap, in a live auction. A nomination and the commissioner's pause carry the same defect in a smaller form. Those are DROPPED when the socket is not open, and `send` returns whether it went out.

**Age is the wrong axis, so do not reach for a TTL.** The board moves per BID, not per second — a two-second-old bid can already name a superseded price, and any expiry either admits stale commands or drops valid registrations. What separates the two is the message.

**And the queue does not cross a socket boundary**: `openWS` and `closeWS` both clear it, so nothing written against a discarded socket reaches the next one. That loses nothing, because the buffer's only job is the window on a FIRST connect where the socket is CONNECTING and no close will ever fire. Once a socket has dropped, `WEBSOCKET_RECONNECTED` re-drives both registrations from current state — `rejoin_auction` off `is_joined`, which is set when the client SENDS a join rather than when the server answers, and `reregister` off `isLoaded`. A replayed buffer would be the same two frames built from staler state.

Neither `send` nor any saga that calls it can be driven from a spec, for the `@core/store` reason below, which is why the buffer itself lives in a store-free `app/core/ws/send-queue.js` and the call-site policy is held by a source gate.

## Pausing is a LIVE-mode verb

`pause()` refuses in election mode, and that refusal is the invariant rather than a convenience. Election mode has no clock to stop, so a pause would only hide the board from whoever is connected while elections kept settling over REST — and `_paused` is force-cleared just once, in `_load_league`, so anything that set it afterwards set it for good. Three paths did: a team disconnecting under auto-pause, the commissioner's `AUCTION_PAUSE`, and `_refresh_league_pause`. Each drove a live election-mode auction into refusing every socket write with `auction is paused` while the whole league rendered that string.

**The league-wide pause is a separate flag and loses nothing.** `_league_paused` is what `bid` and `nominate` consult first, and LeaguePauseNotice states it on every route. Do not collapse the two.

**Entering election mode CLEARS the pause, and there are two doors.** `_load_league` runs once at setup; `_leave_live_mode` is the other, and it is the one a running auction actually uses. A pause taken inside a live block is legitimate — there is a clock to stop — but without the clear on the boundary crossing `_paused` survived into election mode with nothing able to reset it, since `start()` is reachable only by `AUCTION_RESUME` and the commissioner controls do not offer it there.

**Score a change here by calling `pause()` or crossing the boundary, never by assigning `_paused`.** The spec that was supposed to hold this line set the flag by hand and asserted the guard read it back, which is the guard's first line restated — true of any auction whose flag happens to be clear, and blind to every path that sets it. Two more specs named the auto-pause and league-pause triggers while calling `pause()` directly, so neither touched the path in its own title.

**The client mirrors this and needs its own clear.** In election mode nothing broadcasts `AUCTION_START`, and only `AUCTION_BID`/`AUCTION_PROCESSED` otherwise reset `isPaused` — so `AUCTION_MODE` clears it when the mode is `election` and leaves it alone when the mode is `live`, where a pause means something. Without that half a client kept rendering `Auction is paused` through the whole election window on `is_initialized: true`, which the load gate does not cover.

## `isPaused` on the client is not the same question as "is it paused"

The reducer opens `isPaused` true so no control is offered before the auction is known, which is right. What it cannot do is distinguish that from a real pause, and both the bid bar and the status rail named the second one — so every manager read `Auction is paused` for the length of a page load, and a client whose `AUCTION_INIT` never arrived read it until they reloaded. `is_initialized`, set by `AUCTION_INIT` alone, is the answered/unanswered bit. Anything new that reads `isPaused` for display has to check it first.

**A decline is a REST write and must not be drawn on a socket flag.** `AuctionElectionControl` in the bid bar renders on `show_election_control`, which carries no pause term: `/auction-elections` has no pause check and needs none, since a maximum is accepted for the whole free agency period. Binding it to `is_running` is what turned one wrong `isPaused` into two symptoms — a board claiming a pause, and the one control that would still have worked missing from it.

## Mode is derived, never stored

`libs-server/auction-modes.mjs` is the single answer to "which mode is in force". `live` inside a finalized block and from the final block to the period end; `election` everywhere else.

**Do not consult `is_auction_election_mode_enabled` to answer it.** That column selects which auction SYSTEM a league-season runs — this design, or the pre-2026 timer-driven open outcry it rolls back to. A season boolean answering the mode question is a second source of truth that disagrees the moment a block convenes.

A block boundary is a wall-clock event with no message behind it, so the socket POLLS for it. That poll is also what arms the clocks on a socket that boots inside a block: `_election_mode` starts `false`, which is a real mode rather than "unknown", so the first resolve must transition even when it agrees with the default. Without that the block convenes and then does nothing at all.

## One pricing rule, two callers

`libs-server/resolve-auction-player.mjs` is pure and owns the rule: the price is the second-highest claim plus one increment, capped at the highest, and the highest claim leads. It decides an election-mode settlement AND a live-mode proxy step. Do not write a second pricing model for blocks — the proxy engine calls this one against the live board and writes the single bid that restores the equilibrium.

Two properties that look like details and are not:

- **A proxy step does not reset the bid clock. Only a human bid does.** A fully-proxied player settles one bid clock after nomination however many teams wanted them, which is what makes a large final block tractable. **The SERVER owns the countdown and announces it as `AUCTION_TIMER` whenever the running clock changes** — a bid broadcast is not a clock event. The client used to rebuild the countdown from a duration on every `AUCTION_BID`, so a proxy step put a fresh clock on screen while the sale was seconds away, and a reconnecting client got no countdown at all because `AUCTION_INIT` carried durations and no expiry.
- **Supersession binds a claim DOWNWARD and is socket state**, in `_manual_bids`. From the transaction log an engine bid and a human bid are the same row by design, so only the live socket can tell them apart; `build_auction_claims` stays raise-only for the REST paths that cannot.

## The tiebreak instant is DERIVED, and a claim carries commitments rather than a timestamp

A tie is decided by which team committed to the winning amount first, and the amount teams are ranked on is the EFFECTIVE maximum, `min(stated, available_cap)`. So the timestamp has to belong to that number — and `build_auction_claims` cannot know it, because the caps arrive in `resolve_auction_player`. A single `amount_set_at` attached upstream necessarily described the STATED amount, so every clamped claim was ranked on a moment the team never committed the amount it was competing at.

A claim therefore carries `commitments`, one `{ amount, at }` per placed bid plus its election, and the resolver takes **the earliest commitment that covers what it ranks the team on**. A commitment below the ranked amount is not evidence at that price — a $5 bid says nothing about $10 — and without that exclusion any team that ever bid a dollar would outrank one that committed the full amount on day one.

**The equal-amount case is the one that actually cost a player.** The old raise was guarded on a strict `<`, so a bid that EQUALED an existing claim left no record of itself: X bids $5 at 10:00, Y elects $5 at 10:05, X elects $5 at 10:10 merely confirming its own bid — and X's confirmation overwrote its bid instant, handing the player to a team that committed second while X had real money on the wire first.

**Score this at the level of the function that owns it.** `test/auction.resolver.spec.mjs` hands the resolver commitments directly, so it controls the ranking rule and says nothing about which commitments the builder emits — the equal-bid defect is invisible to it, and a fixture that injects a builder's output cannot control that builder. `test/auction.claim-commitments.spec.mjs` drives `build_auction_claims` into the resolver for exactly that reason.

## An election discharges, and so does a claim no election could improve, and so does a cap the price has passed

Completeness is the only thing that settles a player in election mode. `get_outstanding_election_team_ids` in `libs-server/auction-settlement.mjs` is the whole rule, and it discharges an eligible team on exactly three grounds: a live `auction_elections` row, a placed bid that already reaches that team's `available_cap`, or an `available_cap` the claims on record have already priced past.

**The third is opt-in and the other two are not**, because only the third reads anything sealed. It fires only when the caller passes `ranked_contenders`, and the section below it is the whole reason that parameter exists.

**A bid does not discharge, and neither does a nomination.** This is the distinction the original conflated — it seeded the outstanding set with the nominating team and every team holding a bid, so any bid discharged its bidder permanently, with no argument recorded anywhere for why.

**The second ground is a refinement of the first, not a softening of it.** A team's whole influence on a settlement is its claim: `build_auction_claims` makes that `max(election_maximum, highest_bid)` and `resolve_auction_player` takes `min(claim, available_cap)`. So for a team holding bid B against cap C, not electing gives `min(B, C)` and electing M gives `min(max(M, B), C)` — and when `B >= C` those are the same number for every M, because `max(M, B) >= B >= C` and both clamp. Waiting on such a team is waiting on an input that cannot move the winner or the price. League 1 held a player open for two hours on exactly one: a team leading at $1 against a $1 cap, whose eventual $1 election changed nothing.

**Compare against the CAP, never against the current price.** Discharging a team whose bid merely meets the price is discharging the LEADER, and that reintroduces the defect below: a leader at $5 holding a $50 cap would settle away to a rival's $30 election at $6, never having been asked whether it would go above $5. The eligibility gate does not save you there — `available_cap >= current_price` passes comfortably at 50 against 5 — so the cap comparison is the only thing standing between the two rules.

Two things about its reach. Because bids are non-decreasing (the socket refuses one at or below the current price, and an engine bid is floored at it) and eligibility already requires `available_cap >= current_price`, the surviving reachable case is the one where **bid, cap and price are all equal** — so in practice this discharges a tapped-out leader. The `>` half of the `>=` is unreachable through that gate and is written for the general statement rather than for a case you can construct. And **the guarantee is exactly "cannot improve its own claim"** — it used to be narrower. A later election at or above an equal bid pushed the claim's single `amount_set_at` forward, so a discharge quietly returned the team its earlier bid instant. Claims now carry every commitment and the tiebreak ranks on the earliest one covering the amount, so an election that cannot raise the claim cannot move the tiebreak either.

**It reads only placed bids and roster-derived caps.** Both are already public, so the set it produces stays broadcastable exactly as it is. That is what separates the first two grounds from the third.

## The third ground: the set the auction WAITS on is not the set it DISPLAYS

Eligibility is tested at `current_price`, the last PLACED bid, while `resolve_auction_player` prices at `runner_up.effective_maximum + 1`. Those diverge hard, and the divergence is the pace defect. Measured on the live board: Kyler Murray's last placed bid was $2 and he settled at $13; Jared Goff's was $2 and he settled at $25; Jordan Love's was $1 and he settled at $16. Every team with a cap in between was held outstanding while provably unable to win — about 361 minutes across five players, spent open after the clearing price had already been determined, in a mode with no clock. Settlement itself costs about 60ms, so there is no code latency to recover here; the only lever is which teams the set waits on.

**The bound is the runner-up's ceiling, not the price.** A team's best possible claim is its whole `available_cap`, since electing at or above the cap clamps to it. Adding a claim at `C` to a field whose two highest claims are `first` and `second` changes nothing when `C <= second`: the top two values are unchanged, so the winner is unchanged and the price, `min(first, second + 1)`, is unchanged with it.

**`C < first` is the other half and it is not redundant.** At `first === second` the player prices at `first`, so a rule written against the PRICE would discharge a team that can match the lead and take the player on the tiebreak. Fewer than two contenders means no bound at all — the price is the opening bid and any eligible claim raises it — and not discharging is the conservative direction.

**The gating set and the broadcast set are computed separately, and collapsing them is the defect.** `settle_auction_player_if_complete` runs the rule twice: once with `ranked_contenders` to decide whether to settle, once without to produce the set it hands back. Only the second is ever displayed, and the two BROADCAST callers — `get_auction_settlement_status` and the socket's `_get_outstanding_election_tids` — pass no `ranked_contenders` at all.

Gating the DISPLAYED set on the implied price would leak sealed maxima: teams would drop off the list in cap order as the bound rose, caps are roster-derived and effectively public, so watching who disappears bounds the runner-up's ceiling before the sale. In a sealed second-price league whose commissioner competes, that is material. **Decoupling is leak-free for a reason worth stating**: second-price already publishes the runner-up's ceiling in the settled price itself, so settling sooner reveals nothing the sale does not.

The cost is a product judgement rather than a correctness one. The displayed set stops meaning "who must act" and names teams that need not act, which a manager can read as still being live on the player.

**Safety does not rest on monotonicity, and an early draft of this wrongly claimed it did.** The bound is NOT monotone — `withdraw_auction_election` lowers it and puts discharged teams back. What makes it safe instead is that every write able to reverse a discharge is itself a settlement trigger under the same `pg_advisory_xact_lock`: withdraw settles in its own transaction, and a trade or an override release reaches settlement through `reevaluate_auction_after_roster_change`. The set emptying and the player settling are one serialized event, so re-entry is only ever observed while the player is still open, where it is correct rather than hazardous.

**Score this on three mutations, because the obvious two do not cover it.** Disabling the gate reddens the settling case; dropping the `< first` term reddens the tie case; and wiring the sealed rule into the BROADCAST set reddens nothing at all unless a board carries TWO holdouts, one priced out and one not — where the player still does not settle and the returned set must name both. `test/auction.implied-price-gating.spec.mjs` carries that third case for exactly this reason, and the file was green under the leak mutation until it existed.

The two are different kinds of statement, and the difference is the price:

- **An election is price-independent.** A maximum is a standing position at every price, which is exactly what completeness has to claim — that the field is known at whatever price the player settles at. That is also why a standing maximum _below_ the current price still discharges: the team's position at this price is known, and it is "out". Without that a team holds a nomination open forever by never revising a stale maximum.
- **A bid is price-specific.** Bidding $11 says a team was in at $11 and says nothing about $12. When a bid discharged, a team that bid and was then outbid settled away without ever being asked about the higher price — and election mode has no clock, so completeness was the only thing that could have asked.

**The settle call HANDS BACK the outstanding set, and callers must not recompute it.** `settle_auction_player_if_complete` returns `{ settlement, outstanding }`, because computing that set is how it decides whether to settle — and what it returns is the BROADCAST set, never the set it gated on. The gating set is a subset, so a call that does not settle always hands back a non-empty list and no client is shown an empty set on a player still open. Every caller used to discard it and make `get_auction_settlement_status` or the socket's own helper sweep every roster again on the same request — the common path, since most elections do not complete a set. Pass it to `broadcast_auction_settlement_status`; omitting it still works and still recomputes, which is exactly why a spec has to count the QUERIES rather than check the broadcast. That measurement has its own trap: the route calls `res.send` and only then awaits the broadcast, so a counter wrapped around the request stops before the second sweep runs and reports success however the route is wired.

**And only compute the capacities something reads.** The two consumers skip most of the board between them — an elected team is discharged before its capacity is checked, and a decline is filtered out before the resolver touches the roster map. Derive that scope from the CLAIM SET, never from the elections carrying a null maximum: a decliner holding a placed bid and the nominating team are both raised back to real claims by `build_auction_claims`, and dropping their capacity makes the resolver disqualify them as `ROSTER_FULL`.

**Binding is the other axis and it still counts bids.** `build_auction_claims` owns it: a placed bid binds its bidder, a nomination binds its nominator to the opening bid, and that is why every nominated player still sells and there is no `unsold` outcome. Do not read "nominating is bidding" as "nominating is electing".

**A nomination may carry an optional ceiling.** `nominate` accepts a `maximum_bid`, and the socket writes the bid and that election in ONE transaction under the league's advisory lock — a nomination whose election was lost would open a player that waits on its own nominator. It is optional: absent means the nominator has not stated a ceiling and stays outstanding, free to elect later — unless its opening bid already reaches its own cap, which discharges it under the second ground above. It is election-mode only, refused below the opening bid, and it is NOT a decline — a nominator cannot decline the player it nominated.

## Eligibility must stay monotone

A team that leaves an eligible set never re-enters it, and completeness once reached stays reached. Second-price settlement rests on that.

This is a statement about ELIGIBILITY, not about the outstanding set as a whole — the third discharge above turns on a bound a withdrawal can lower, and its safety argument is a serialization one rather than a monotonicity one. Do not read the two as the same claim.

Anything that fills an active roster spot without passing through settlement breaks eligibility monotonicity, so:

- A trade and a commissioner-override release call `reevaluate_auction_after_roster_change`.
- Free agency waivers, poaching waivers and poaching CLAIMS all hold until the auction completes. Practice-squad waivers deliberately do not — a practice add consumes no active spot and no cap.

**A SLOT CHANGE IS A THIRD LEVER, AND IT IS REFUSED RATHER THAN HOOKED.** The two above both REMOVE a roster row. `submit-reserve.mjs` and `submit-deactivate.mjs` move an active player to a reserve or practice-squad slot instead, which leaves the row count identical while `availableCap` and `availableSpace` both RISE — `Roster` derives them from the ACTIVE slots alone — so a team that had dropped out of an eligible set re-enters it. Both now refuse an ACTIVE-slot player while `is_auction_in_progress`.

**The refusal is not interchangeable with a `reevaluate_auction_after_roster_change` call, and picking the wrong one here is silent.** That call is right for a change that only ever REMOVES capacity: it settles a nomination whose eligible set is now complete. A slot change ADDS capacity, so re-evaluating would faithfully record a set that should never have grown, and the completeness guarantee would still be gone. Monotonicity is what second-price settlement rests on, and the freeze is also what makes `is_auction_complete` monotone — it derives completion from open active spots, which only stays true while nothing may add one back.

**Check the SOURCE SLOT, not just the auction.** A practice squad activation into reserve moves no active roster row and cannot change either quantity, so gating it on the auction alone would refuse a move that was never a threat. `is_auction_in_progress` says the same thing at its own definition.

The settlement's cap-monotonicity guard remains the last line rather than the control: it sees this class only for the winner, and only inside the settling transaction.

Auction completion is DERIVED from an exhausted nomination rotation with the period end as the backstop. Do not add a column for it.

**The eligible-set predicate has ONE home, and the bid bar reads it too.** `get_auction_team_capacity` in `libs-shared` takes a `Roster`, a position and the current price and returns the three terms plus their conjunction; `get_team_auction_capacity` in `libs-server/auction-settlement.mjs` is that call plus a roster read, and `get_nominated_player_auction_capacity` in `app/core/selectors.js` is that call against the client's own roster. The client needs the same answer the server settles on — a team outside the eligible set is not one the auction waits on, so it has nothing to decline and no maximum that can change the outcome, and offering it a bid, a decline or a `Set maximum` is offering a control that cannot do anything. A second client-side copy would be the three-disagreeing-comparisons defect again, in a tier no server spec can see.

Two things about that shared function. **The terms are reported separately on purpose** — the bar picks its wording from which one failed, and `Exceeded CAP` on a manager whose roster is full sends them looking for budget to free up. And **`has_cap_space` is not the bar's `isAboveCap`**: the first asks whether a team can still win at the price on the board (`>=`, which a team holding exactly the price can, under the tiebreak), the second whether it can RAISE (`bid + 1`). Collapsing them takes the election control away from a team whose election still decides the player.

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

**Finalization is evaluated CONCURRENTLY as a matter of course** — on the opt-in write and on every read of the schedule, including the socket mode poll — so it runs in one transaction under the league advisory lock, and the convening announcement fires after the commit. The unique index settles insert against insert and nothing else: an EXTEND racing an INSERT put a real duplicate session on a real league, which is a phantom block on the calendar and a second announcement asking managers to attend a session they were already told about.

The final block is the opposite: computed on demand, no row, because every term is configuration or derived from the rosters. A column would be a second source of truth that can disagree with the board.

## An opt-in write is a SET of slots, and it lands whole or not at all

`POST /auction-blocks` takes `block_ats`, always a list, because a manager opts into an hour far more often than into one quarter of one. Two properties follow and neither is optional. **Every slot is validated before any is written** — `assert_auction_block_slot_open` runs over the whole set first, so a request whose last quarter falls outside the period leaves nothing behind rather than three quarters the manager never chose. And **the per-write finalization evaluation is suppressed** (`evaluate_finalization: false`), because the route's own `build_schedule` evaluates once for the league afterwards; leaving it on takes the league advisory lock once per slot and can announce a merged session from the middle of the run.

The client draws the opt-in before the reply, since the route rebuilds the whole schedule before it answers and the dead interval reads as a click that did not land. **Rollback on refusal is a REFETCH, not an inverse** — a request routinely covers slots it does not change, so inverting it withdraws opt-ins the manager made earlier and still holds.

## Testing it

**Only running it finds these defects.** Every one this subsystem has produced came from executing the behavior; none came from reading the source. Two rules follow:

- **Write the spec that drives the ROUTE, not the library behind it.** Both election write verbs declared a bodyless 200 in their own OpenAPI blocks and returned 500 under the test-env response validator, for exactly as long as no spec called them.
- **The clock is addressable, and count it by NAME.** `api/sockets/auction.mjs` takes an injected timer through the `Auction` constructor; `test/auction.proxy-bidding.spec.mjs` is the worked example. `MockDate` moves `Date.now` without moving `setTimeout`, so it cannot drive any of this alone. Call `auction.stop()` in teardown — the mode poll re-arms itself. Every `set_timeout` carries an `AUCTION_TIMERS` name because the three clocks are NOT distinguishable by duration: the padded bid clock and the mode poll are both 15,000ms in `config-test.json`, so counting durations counted two clocks as one.
- **A saga cannot be driven from a spec here.** `@core/ws` re-exports `service.js`, which imports `@core/store`, which reads `window.__INITIAL_STATE__` and builds browser history at module scope — and there is no jsdom. Cover the reducer, which is where a broadcast actually dies, and say plainly what is left to a source gate.
- **The scarce resource in a settlement is the POOL, not the JS thread.** The settlement holds the league advisory lock and then reads a roster per team; on the module pool the lock holder acquires connections the teams queued on its lock are holding, and knex's `acquireConnectionTimeout` is the only thing that breaks it — sixty seconds later, with the player left open and no clock in election mode to retry. Everything inside the locked region takes the caller's `trx`, and `getLeague` is resolved BEFORE the transaction opens. This was long believed unreproducible from mocha on the grounds that it needs ten simultaneous lock waiters; that is wrong, and the error is worth knowing because it is easy to repeat. Connections are held by the DRIVER, and waiters are only one way to empty a pool. `test/auction.settlement-connection-discipline.spec.mjs` simply holds the pool at zero free and requires the settlement to finish anyway, which discriminates by an order of magnitude in both directions.
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
