-- STATUS: APPLIED 2026-08-02 against league_production
--
-- Make a vetoed trade cleanly reversible by bounding the period in which it can
-- be vetoed and freezing the traded assets for that period.
--
-- Veto previously only stamped `trades.vetoed`; it reversed nothing. Vetoing an
-- accepted trade left both rosters, the transaction ledger and pick ownership
-- carrying the trade's effects, plus a trade row marked accepted AND vetoed.
--
-- Reversal is only well defined while the traded assets have not moved again. A
-- player who was traded, then released, then claimed by a third team cannot be
-- put back without unwinding two other teams' decisions. Rather than detect and
-- refuse that case after the fact, the window makes it unrepresentable: while a
-- trade is vetoable, its players, released players and picks are frozen against
-- any further ownership change. Outside the window veto is simply refused.
--
-- Two columns:
--
-- seasons.trade_veto_window_hours -- how long after acceptance a trade may be
-- vetoed, and therefore how long its assets stay frozen. On `seasons` rather
-- than `leagues` because it is a per-league-per-year rule that sits alongside
-- tddate, and it mirrors restricted_free_agency_window_hours exactly (same type,
-- same default, same meaning of "hours this thing stays open"). 0 disables veto
-- and the freeze entirely.
--
-- trades_slots.origin_slot -- the roster slot a traded player occupied on the
-- team that sent them, captured at acceptance. trades_slots already holds this
-- trade's per-player slot bookkeeping (where the player is GOING); this records
-- where they CAME FROM so a reversal restores the exact pre-trade slot rather
-- than dumping everyone on the bench. Bench is not a safe default: a player who
-- was on the practice squad pre-trade would return to the active roster and
-- could push the team past a limit the pre-trade state satisfied.
--
-- Nullable, with no backfill: trades accepted before this migration have no
-- recorded origin and are outside their veto window anyway, so they are not
-- reversible regardless.

ALTER TABLE public.seasons
  ADD COLUMN trade_veto_window_hours smallint NOT NULL DEFAULT 24;

ALTER TABLE public.trades_slots
  ADD COLUMN origin_slot integer;

-- Same reasoning for players a trade released to make roster room: a reversal
-- has to put them back in the slot they were cut from, not on the bench.
ALTER TABLE public.trade_releases
  ADD COLUMN origin_slot integer;
