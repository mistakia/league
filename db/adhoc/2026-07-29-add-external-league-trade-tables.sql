-- STATUS: APPLIED 2026-07-29 against league_production
--
-- Add external-league trade observation tables (external_leagues,
-- external_league_trades, external_league_trade_legs).
--
-- PURPOSE. The dynasty market-value rebuild needs REALIZED EXCHANGE data rather
-- than opinion polling. Every other candidate signal (KeepTradeCut, rankings,
-- ADP, betting markets) is an opinion ABOUT a player; a completed trade is a
-- revealed indifference constraint -- some manager gave up bundle A to get
-- bundle B, so value(A) ~= value(B). A large set of those constraints can fit a
-- value scale directly, with no anchor and no calibration onto anyone else's
-- index.
--
-- WHY NEW TABLES RATHER THAN external_league_connections. The existing
-- external-fantasy-leagues machinery is a "migrate my external league INTO
-- xo.football" feature: external_league_connections.lid is NOT NULL with an FK
-- to our leagues, and sync/transaction-sync.mjs writes mapped rows into OUR
-- `transactions` table. That is the wrong shape here -- we are OBSERVING
-- leagues we are not members of, and there is no internal lid to hang them on.
-- It is also lossy for this purpose: transaction-mapper.mjs drops the Sleeper
-- `draft_picks` and `waiver_budget` arrays entirely, and fans a trade out into
-- one row per moved player, destroying the bundle grouping that IS the signal.
-- These tables are additive; nothing above is modified.
--
-- LAYER-1 EVIDENCE ONLY -- THIS IS A DELIBERATE SCHEMA BOUNDARY. The consuming
-- valuation has two composable layers: (1) player-intrinsic forward worth,
-- which is league-agnostic, and (2) a contract/control adjustment specific to
-- our league's cap. External leagues trade players WITHOUT contracts, so their
-- data informs layer 1 and only layer 1. There are deliberately no contract,
-- salary, or cap columns here, so contract-aware and contract-blind values
-- cannot be blended by accident.
--
-- FORMAT METADATA IS NOT OPTIONAL. A trade is only comparable to ours if the
-- format is known: superflex vs single-QB changes QB value by multiples, PPR vs
-- standard moves receivers, and dynasty vs redraft price the same player
-- completely differently. Storing a trade without its format produces unusable
-- data, so external_leagues carries the format columns the fitting routine
-- partitions on (league_format, is_superflex, points_per_reception, num_teams),
-- with the raw roster_positions/scoring_settings retained as jsonb so a later
-- refinement can derive a dimension we did not think to promote.
--
-- CONSUMPTION SHAPE. The fitting routine reads
-- (bundle_a, bundle_b, observed_at, league_format) by grouping
-- external_league_trade_legs on to_roster_id within a trade: each side's bundle
-- is the set of legs it RECEIVED, observed_at is external_league_trades
-- .processed_at, and the format joins from external_leagues. Legs are typed --
-- 'player', 'pick', or 'faab' -- so draft picks are first-class trade legs
-- rather than dropped. Picks dominate dynasty trades (in the league sampled
-- while designing this, most completed trades contained at least one), so a
-- schema that could not represent them would bias the fit toward pure
-- player-for-player swaps.
--
-- pid is NULLABLE ON PURPOSE. An unmatched player silently dropped is a
-- data-quality bug, so an unresolvable player is stored with its
-- external_player_id and a NULL pid, making the miss countable rather than
-- invisible. Measured match rate on real traded players via a direct
-- sleeper_player_id join was 176/176 at authoring time, so this is expected to
-- stay near-empty; it exists so that regressions surface.
--
-- yarn db:exec db/adhoc/2026-07-29-add-external-league-trade-tables.sql
-- yarn export:schema

CREATE TABLE public.external_leagues (
  platform character varying(20) NOT NULL,
  external_league_id character varying(64) NOT NULL,
  season_year smallint NOT NULL,
  league_name text,
  num_teams smallint,
  -- dynasty | keeper | redraft. Sleeper settings.type 2/1/0.
  league_format character varying(10) NOT NULL,
  -- A SUPER_FLEX roster slot, or two or more dedicated QB slots.
  is_superflex boolean NOT NULL DEFAULT false,
  is_best_ball boolean NOT NULL DEFAULT false,
  points_per_reception numeric(4, 2),
  tight_end_premium numeric(4, 2),
  passing_touchdown_points numeric(4, 2),
  taxi_slots smallint,
  -- Raw platform payloads, so a later refinement can derive a format dimension
  -- that was not promoted to a column here.
  roster_positions jsonb,
  scoring_settings jsonb,
  -- Sleeper chains league-seasons backward via previous_league_id, which is how
  -- multi-year history is walked without any extra discovery.
  previous_external_league_id character varying(64),
  -- 'seed' | 'user_leagues' | 'previous_season'. Records how the crawler
  -- reached this league, so a biased frontier is diagnosable later.
  discovered_via character varying(20),
  last_synced_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT external_leagues_pkey PRIMARY KEY (platform, external_league_id),
  CONSTRAINT external_leagues_league_format_check
    CHECK (league_format IN ('dynasty', 'keeper', 'redraft'))
);

COMMENT ON TABLE public.external_leagues IS
  'Fantasy leagues on external platforms observed for realized trade data. We are not members of these leagues; they are read from public read-only APIs.';

CREATE INDEX idx_external_leagues_format
  ON public.external_leagues (league_format, is_superflex, season_year);
CREATE INDEX idx_external_leagues_last_synced
  ON public.external_leagues (last_synced_at NULLS FIRST);

CREATE TABLE public.external_league_trades (
  platform character varying(20) NOT NULL,
  external_transaction_id character varying(64) NOT NULL,
  external_league_id character varying(64) NOT NULL,
  season_year smallint NOT NULL,
  -- Deliberately NOT named `week`: this is the platform's transaction bucket, a
  -- fetch coordinate, not an NFL week. Sleeper files every offseason trade
  -- under bucket 1, so reading it as "the NFL week this trade happened in"
  -- would be wrong -- use processed_at for timing.
  platform_transaction_bucket smallint NOT NULL,
  -- When the trade was completed on the platform. This is the observed_at the
  -- fitting routine uses to place the constraint in time.
  processed_at timestamp with time zone NOT NULL,
  -- 2 for a standard trade; 3+ leagues do occur and must not be assumed away.
  num_sides smallint NOT NULL,
  imported_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT external_league_trades_pkey
    PRIMARY KEY (platform, external_transaction_id),
  CONSTRAINT external_league_trades_league_fkey
    FOREIGN KEY (platform, external_league_id)
    REFERENCES public.external_leagues (platform, external_league_id)
    ON DELETE CASCADE,
  CONSTRAINT external_league_trades_num_sides_check CHECK (num_sides >= 2)
);

COMMENT ON TABLE public.external_league_trades IS
  'Completed trades observed in external leagues. One row per trade; the exchanged bundles live in external_league_trade_legs.';

CREATE INDEX idx_external_league_trades_league
  ON public.external_league_trades (platform, external_league_id);
CREATE INDEX idx_external_league_trades_processed_at
  ON public.external_league_trades (processed_at);

CREATE TABLE public.external_league_trade_legs (
  platform character varying(20) NOT NULL,
  external_transaction_id character varying(64) NOT NULL,
  leg_index smallint NOT NULL,
  -- player | pick | faab
  leg_type character varying(10) NOT NULL,
  -- Platform roster ids, unique only within their league. The side that gave
  -- the asset up and the side that received it; grouping legs by to_roster_id
  -- reconstructs each side's received bundle.
  from_roster_id smallint,
  to_roster_id smallint NOT NULL,
  -- Resolved internal player id. NULL means unresolved, which is a countable
  -- data-quality signal rather than a dropped row -- see header.
  pid character varying(25),
  external_player_id character varying(32),
  -- Future draft pick legs. pick_original_roster_id is the roster whose pick it
  -- originally was, which is what makes an unowned future pick identifiable.
  pick_season_year smallint,
  pick_round smallint,
  pick_original_roster_id smallint,
  faab_amount integer,
  CONSTRAINT external_league_trade_legs_pkey
    PRIMARY KEY (platform, external_transaction_id, leg_index),
  CONSTRAINT external_league_trade_legs_trade_fkey
    FOREIGN KEY (platform, external_transaction_id)
    REFERENCES public.external_league_trades (platform, external_transaction_id)
    ON DELETE CASCADE,
  CONSTRAINT external_league_trade_legs_pid_fkey
    FOREIGN KEY (pid) REFERENCES public.player (pid),
  CONSTRAINT external_league_trade_legs_leg_type_check
    CHECK (leg_type IN ('player', 'pick', 'faab')),
  -- Each leg type must carry its own payload and nothing else, so a malformed
  -- parse fails loudly at insert rather than producing a leg that the fitting
  -- routine reads as an empty bundle entry.
  CONSTRAINT external_league_trade_legs_payload_check CHECK (
    (leg_type = 'player'
      AND external_player_id IS NOT NULL
      AND pick_round IS NULL AND faab_amount IS NULL)
    OR (leg_type = 'pick'
      AND pick_season_year IS NOT NULL AND pick_round IS NOT NULL
      AND external_player_id IS NULL AND pid IS NULL AND faab_amount IS NULL)
    OR (leg_type = 'faab'
      AND faab_amount IS NOT NULL
      AND external_player_id IS NULL AND pid IS NULL AND pick_round IS NULL)
  )
);

COMMENT ON TABLE public.external_league_trade_legs IS
  'Individual assets moved by an external trade: players, future draft picks, and FAAB. Grouping by to_roster_id yields the bundle each side received.';

CREATE INDEX idx_external_league_trade_legs_pid
  ON public.external_league_trade_legs (pid) WHERE pid IS NOT NULL;
CREATE INDEX idx_external_league_trade_legs_unresolved
  ON public.external_league_trade_legs (external_player_id)
  WHERE leg_type = 'player' AND pid IS NULL;

GRANT SELECT ON TABLE public.external_leagues TO league_reader;
GRANT SELECT ON TABLE public.external_league_trades TO league_reader;
GRANT SELECT ON TABLE public.external_league_trade_legs TO league_reader;
