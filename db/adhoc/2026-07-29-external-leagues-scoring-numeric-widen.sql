-- STATUS: APPLIED 2026-07-29 against league_production
--
-- external_leagues: drop the precision bound on the three scoring projections
--
-- These three columns are numeric(4,2), which caps at 99.99. They hold values
-- copied verbatim out of a third party's user-authored league settings, so the
-- bound is a guess about what strangers put in a text box, and the guess is
-- wrong: crawling wider immediately found league 1383847073840926720 ("The
-- People's Choice (1)") carrying tight_end_premium = 78943.
--
-- The failure mode is worse than a bad row. The crawl inserts leagues in
-- batches, so ONE overflowing value fails the whole INSERT, which aborts the
-- entire crawl run -- the graph-first posture cannot proceed until this is
-- fixed. It stayed hidden only because the corpus was small and drawn from one
-- neighbourhood of serious dynasty leagues.
--
-- Unbounded `numeric` rather than a wider bound (numeric(12,4) etc.) on
-- purpose. Any bound we pick here is the same guess again, and the lesson of
-- this bug is that we have no basis for the guess: the input is arbitrary and
-- adversarial-by-accident. Postgres numeric is variable-length, so the
-- unbounded form costs nothing for the ordinary 0.50/1.00 values that make up
-- almost all of the corpus, and it can never abort a crawl again.
--
-- Widening is metadata-only in Postgres -- no table rewrite, no exclusive-lock
-- scan of the existing 839 rows -- because every stored value already satisfies
-- the wider type.
--
-- Values like 78943 are stored truthfully rather than clamped or nulled. They
-- are real settings and they are exactly what marks a league as a joke league
-- and therefore non-comparable; clamping to 99.99 would invent a plausible
-- number and destroy that signal. scoring_settings (jsonb) already holds the
-- unabridged source for anything a later reader wants to re-derive.

alter table external_leagues
  alter column points_per_reception type numeric,
  alter column tight_end_premium type numeric,
  alter column passing_touchdown_points type numeric;
