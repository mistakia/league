-- STATUS: APPLIED 2026-07-29 against league_production
--
-- external league crawl graph: capture the useful fields the payloads already return
--
-- Operator instruction 2026-07-29: while trade imports are paused, collect league
-- ids, member ids, and as much useful data as the crawl requests already return,
-- to inform later decisions about which leagues to import from.
--
-- Every field below arrives in a payload the crawl ALREADY FETCHES and currently
-- discards. Adding them costs zero extra requests. Not adding them costs a
-- re-crawl of the whole corpus later, which is exactly the position the
-- manager-overlap question is stuck in today -- we hold 4,581 membership edges
-- and still cannot measure roster overlap, because the one field that would have
-- answered it was never stored.
--
-- Chosen against measured prevalence on a 116-league / 118-member sample rather
-- than by reading the API docs:
--   league_status      100%, varies (in_season 100, pre_draft 15, drafting 1)
--   last_message_at    100% present -- the only liveness signal available free
--   external_draft_id  100% -- the handle for fetching draft data later
--   league_settings     100%, up to 52 keys
--   league_metadata     99% non-empty
--   display_name       present on every member
--   is_bot             0% of 118 members, kept anyway (see below)
--
-- DELIBERATELY OMITTED, all measured rather than assumed: company_id and
-- group_id are null on 116/116, and season_type is the constant "regular" on
-- 116/116. A column that is always null or always the same value is pure read-tax.
--
-- is_bot is stored despite measuring 0%. It is one free boolean, and its value is
-- that it makes a future nonzero rate VISIBLE: a bot expanded as a frontier
-- manager spends a request to learn nothing. No frontier-exclusion logic is being
-- added for it -- at 0% that would be speculative complexity guarding a
-- non-problem, and the column is what would justify adding it later.
--
-- last_message_at is timestamptz, converted from Sleeper's epoch-MILLISECONDS
-- integer at the parser boundary rather than stored raw. Follows the
-- nfl_games.kickoff_at precedent: epoch integers in the database invite
-- unit-confusion bugs at every read site. NOTE it is a weak liveness proxy --
-- Sleeper's system account posts league messages (waiver runs and the like), so
-- it partly measures automation rather than human engagement. Stored because it
-- is free and directional, not because it is clean.
--
-- display_name reverses a documented decision. parse_sleeper_league_member_users
-- previously declined it as "permanent read-tax on a table whose only jobs are
-- identity and cursor" -- correct when the table's only job was to be a crawl
-- cursor, and superseded now that the graph is the deliverable and a human has to
-- be able to read it. The parser comment is updated in the same change.
--
-- All additive. No rename, no drop, so nothing committed can fail to resolve
-- against it and no consumer sweep is required.

alter table external_leagues
  add column league_status character varying(20),
  add column last_message_at timestamp with time zone,
  add column external_draft_id character varying(32),
  add column league_settings jsonb,
  add column league_metadata jsonb;

alter table external_league_users
  add column display_name text,
  add column is_bot boolean;

alter table external_league_memberships
  add column is_owner boolean;

-- The crawl finds most leagues through /user/{id}/leagues, which yields the
-- member edge but never says who owns the team, so is_owner is only ever
-- populated by the member-list path. Left nullable on purpose: null means "not
-- learned yet", which is a different fact from false, and collapsing the two
-- would make an uncrawled league look like a league with no commissioner.
comment on column external_league_memberships.is_owner is
  'null = member list not yet crawled for this league; only /league/{id}/users populates it';

comment on column external_leagues.last_message_at is
  'Weak liveness proxy: Sleeper system messages (waiver runs) bump this, so it partly measures automation rather than human engagement';
