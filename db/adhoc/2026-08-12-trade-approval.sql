-- STATUS: APPLIED 2026-08-12 against league_production
--
-- Commissioner trade approval closes a trade's veto window early.
--
-- `trades.approved` is the per-trade marker that a commissioner ended the veto
-- window before the clock did. NULL means the window is still governed by
-- `trades.accepted + seasons.trade_veto_window_hours`; a timestamp means the
-- window is closed as of that instant and the trade's players, picks, and
-- released players are unlocked and free to move again.
--
-- The asset freeze is derived from the `trades` row on every call, so setting
-- this column is the whole unlock -- no materialized state, no cleanup step.

ALTER TABLE public.trades ADD COLUMN approved timestamp with time zone;
