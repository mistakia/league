-- STATUS: APPLIED 2026-07-29 against league_production
--
-- Persist the external-league crawl graph: external_league_users,
-- external_league_memberships, and two crawl-state columns on external_leagues.
--
-- PURPOSE. db/adhoc/2026-07-29-add-external-league-trade-tables.sql persisted
-- the league NODES but nothing persisted the USER LAYER, which is the actual
-- graph. discover_sleeper_leagues held its visited-user set in memory and
-- discarded it at process exit, so every run re-walked the same neighbourhood
-- from the same seed and rediscovered the same leagues forever. The corpus
-- could only be grown by raising --limit on one expensive run, never by
-- accumulating across runs.
--
-- WE WERE DISCARDING THE EXPENSIVE ARTIFACT AND KEEPING THE CHEAP ONE. League
-- ids are free -- they fall out of payloads we already fetch. The
-- manager-to-league EDGES cost one request each to acquire, and they are
-- exactly what lets a later run resume from the frontier rather than re-derive
-- it. These two tables persist the edges and the per-node crawl state, so
-- "unexplored frontier" becomes a query rather than a guess.
--
-- THE FRONTIER IS TWO NULL-VALUED TIMESTAMPS, NOT A QUEUE TABLE. A crawl
-- alternates between two expansions, and each has a persisted "not yet done"
-- marker rather than a separate work-queue table that could drift out of sync
-- with the graph it describes:
--   external_league_users.last_crawled_at IS NULL
--     -- member seen in a league, never expanded via /user/{id}/leagues
--   external_leagues.member_list_crawled_at IS NULL
--     -- league known, its /league/{id}/users member list never fetched
-- Both are partial-indexed on exactly that condition so popping the frontier is
-- an index scan and measuring it is a count.
--
-- external_leagues NOW MEANS "LEAGUE WE KNOW OF", NOT "LEAGUE WE HAVE TRADES
-- FOR". /user/{id}/leagues/nfl/{season} returns FULL league payloads, so
-- discovery yields complete external_leagues rows at zero additional request
-- cost. Persisting all of them -- including redraft leagues the current
-- appetite does not want -- means a discovered league is never rediscovered,
-- and a later run that widens its appetite does not have to re-crawl to find
-- what it already saw. last_synced_at IS NULL is the "known but trades never
-- imported" backlog, and idx_external_leagues_last_synced already indexes it
-- NULLS FIRST.
--
-- NO PROFILE FIELDS ON USERS, DELIBERATELY. Display names, avatars and team
-- names are available on every payload that surfaces a user and none of them
-- inform a value fit. A user row here is a graph node and a crawl cursor; the
-- identifier and the crawl state are the whole of what earns its keep.
--
-- WHY THE MEMBERSHIP EDGE IS WORTH STORING SEPARATELY FROM discovered_via.
-- discovered_via records the MECHANISM that reached a league ('seed',
-- 'user_leagues', 'previous_season') and is retained. It cannot record FROM
-- WHERE, so provenance was not reconstructible. The edge table supplies the
-- graph itself, and external_leagues.discovered_from_external_user_id names the
-- specific manager whose league list surfaced the league -- together they make
-- the crawl tree replayable and the crawl bias measurable rather than merely
-- acknowledged. The edge also lets the consuming valuation detect the same
-- manager appearing across leagues, which its independence assumptions need:
-- two trades made by one person are not two independent observations.
--
-- LAYER BOUNDARY UNCHANGED. Still no contract, salary or cap columns anywhere
-- in this family -- external leagues trade players without contracts, so this
-- data is player-intrinsic evidence only.
--
-- yarn db:exec db/adhoc/2026-07-29-add-external-league-crawl-graph.sql
-- yarn export:schema

CREATE TABLE public.external_league_users (
  platform character varying(20) NOT NULL,
  external_user_id character varying(64) NOT NULL,
  -- NULL means frontier: this manager was seen in a league member list but
  -- their own league list has never been fetched. Set when expanded, so a
  -- later run resumes instead of re-paying for what we already know.
  last_crawled_at timestamp with time zone,
  first_seen_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT external_league_users_pkey
    PRIMARY KEY (platform, external_user_id)
);

COMMENT ON TABLE public.external_league_users IS
  'Managers observed in external leagues, as crawl-graph nodes. last_crawled_at NULL is the unexplored frontier. Deliberately carries no profile fields.';

CREATE INDEX idx_external_league_users_frontier
  ON public.external_league_users (platform, first_seen_at)
  WHERE last_crawled_at IS NULL;

CREATE TABLE public.external_league_memberships (
  platform character varying(20) NOT NULL,
  external_league_id character varying(64) NOT NULL,
  external_user_id character varying(64) NOT NULL,
  first_seen_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT external_league_memberships_pkey
    PRIMARY KEY (platform, external_league_id, external_user_id),
  CONSTRAINT external_league_memberships_league_fkey
    FOREIGN KEY (platform, external_league_id)
    REFERENCES public.external_leagues (platform, external_league_id)
    ON DELETE CASCADE,
  CONSTRAINT external_league_memberships_user_fkey
    FOREIGN KEY (platform, external_user_id)
    REFERENCES public.external_league_users (platform, external_user_id)
    ON DELETE CASCADE
);

COMMENT ON TABLE public.external_league_memberships IS
  'Manager-to-league edges of the external-league crawl graph. The expensive artifact: each edge cost a request to acquire, and together they make the frontier resumable and the same manager detectable across leagues.';

-- The primary key already serves league -> users; this serves user -> leagues,
-- which is how the crawl asks "what has this manager already led us to".
CREATE INDEX idx_external_league_memberships_user
  ON public.external_league_memberships (platform, external_user_id);

-- Crawl state for the other half of the alternation. NULL means the league's
-- member list has never been fetched, so it is a frontier league.
ALTER TABLE public.external_leagues
  ADD COLUMN member_list_crawled_at timestamp with time zone;

-- The manager whose league list surfaced this league. NULL for a seed, for a
-- previous-season chain link, and for the leagues discovered before this table
-- existed. This is the FROM WHERE that discovered_via cannot express.
ALTER TABLE public.external_leagues
  ADD COLUMN discovered_from_external_user_id character varying(64);

COMMENT ON COLUMN public.external_leagues.member_list_crawled_at IS
  'When /league/{id}/users was last fetched for this league. NULL = frontier league whose member list has never been read.';
COMMENT ON COLUMN public.external_leagues.discovered_from_external_user_id IS
  'The manager whose league list surfaced this league. NULL for seed, previous-season chain links, and pre-crawl-graph rows.';

CREATE INDEX idx_external_leagues_member_list_frontier
  ON public.external_leagues (platform, created_at)
  WHERE member_list_crawled_at IS NULL;

GRANT SELECT ON TABLE public.external_league_users TO league_reader;
GRANT SELECT ON TABLE public.external_league_memberships TO league_reader;
