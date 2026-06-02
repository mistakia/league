-- PFF archive ingest: new tables
--
-- Adds four tables consumed by the archive-fed ingest scripts under
-- private/scripts/import-pff-archive-*.mjs. The live PFF importer and existing
-- pff_team_seasonlogs / pff_team_gamelogs / pff_player_seasonlogs /
-- pff_player_seasonlogs_changelog tables are untouched.
--
-- See task: user:task/league/plan-pff-archive-ingest.md

-- 1. pff_game_id_map: PFF game_id -> esbid plus home/away metadata.
--    esbid is derived by joining (season, week, seas_type, home_team, away_team)
--    against nfl_games -- not present in the archive payload. Rows where the join
--    fails carry esbid_resolved=false; downstream consumers skip them.
CREATE TABLE public.pff_game_id_map (
    pff_game_id bigint NOT NULL,
    esbid character varying(20),
    esbid_resolved boolean DEFAULT false NOT NULL,
    season smallint,
    week smallint,
    seas_type character varying(4),
    home_nfl_team character varying(3),
    away_nfl_team character varying(3),
    home_franchise_id smallint,
    away_franchise_id smallint,
    has_stats boolean,
    "timestamp" integer DEFAULT EXTRACT(epoch FROM now()) NOT NULL,
    CONSTRAINT pff_game_id_map_pkey PRIMARY KEY (pff_game_id)
);

CREATE INDEX pff_game_id_map_esbid_idx
    ON public.pff_game_id_map (esbid)
    WHERE esbid IS NOT NULL;

CREATE INDEX pff_game_id_map_season_week_idx
    ON public.pff_game_id_map (season, week);

-- 2. pff_player_facet_seasonlogs: per-(player, year, facet) row capturing
--    pass-blocking / pressure / pass-rush / signature detail that does not fit
--    in pff_player_seasonlogs. JSONB payload preserves the raw row;
--    promoted scalars cover the OL / pressure / pass-rush use cases.
CREATE TABLE public.pff_player_facet_seasonlogs (
    pid character varying(25) NOT NULL,
    year smallint NOT NULL,
    facet character varying(64) NOT NULL,
    pff_id integer,
    franchise_id smallint,
    nfl_team character varying(3),
    "position" character varying(5),
    facet_payload jsonb NOT NULL,
    snaps integer,
    grade numeric(5,2),
    pressures_allowed integer,
    hurries_allowed integer,
    hits_allowed integer,
    sacks_allowed integer,
    pbe numeric(6,3),
    pass_block_percent numeric(6,3),
    true_pass_set_snaps integer,
    true_pass_set_grade numeric(5,2),
    true_pass_set_pressures_allowed integer,
    pressure_pct numeric(6,3),
    time_in_pocket numeric(5,3),
    targets integer,
    receptions integer,
    yards integer,
    tds integer,
    routes integer,
    targets_per_route numeric(6,3),
    "timestamp" integer DEFAULT EXTRACT(epoch FROM now()) NOT NULL,
    CONSTRAINT pff_player_facet_seasonlogs_pkey PRIMARY KEY (pid, year, facet)
);

CREATE INDEX pff_player_facet_seasonlogs_year_facet_idx
    ON public.pff_player_facet_seasonlogs (year, facet);

CREATE INDEX pff_player_facet_seasonlogs_pid_year_idx
    ON public.pff_player_facet_seasonlogs (pid, year);

CREATE INDEX pff_player_facet_seasonlogs_franchise_year_facet_idx
    ON public.pff_player_facet_seasonlogs (franchise_id, year, facet);

-- 3. pff_player_facet_gamelogs: per-(player, esbid, facet) row from
--    facet/game/* payloads. Same shape as facet-seasonlogs plus pff_game_id.
CREATE TABLE public.pff_player_facet_gamelogs (
    pid character varying(25) NOT NULL,
    esbid character varying(20) NOT NULL,
    facet character varying(64) NOT NULL,
    pff_game_id bigint,
    pff_id integer,
    franchise_id smallint,
    nfl_team character varying(3),
    "position" character varying(5),
    facet_payload jsonb NOT NULL,
    snaps integer,
    grade numeric(5,2),
    pressures_allowed integer,
    hurries_allowed integer,
    hits_allowed integer,
    sacks_allowed integer,
    pbe numeric(6,3),
    pass_block_percent numeric(6,3),
    true_pass_set_snaps integer,
    true_pass_set_grade numeric(5,2),
    true_pass_set_pressures_allowed integer,
    pressure_pct numeric(6,3),
    time_in_pocket numeric(5,3),
    targets integer,
    receptions integer,
    yards integer,
    tds integer,
    routes integer,
    targets_per_route numeric(6,3),
    "timestamp" integer DEFAULT EXTRACT(epoch FROM now()) NOT NULL,
    CONSTRAINT pff_player_facet_gamelogs_pkey PRIMARY KEY (pid, esbid, facet)
);

CREATE INDEX pff_player_facet_gamelogs_esbid_facet_idx
    ON public.pff_player_facet_gamelogs (esbid, facet);

CREATE INDEX pff_player_facet_gamelogs_pid_esbid_idx
    ON public.pff_player_facet_gamelogs (pid, esbid);

-- 4. pff_unresolved_players: staging table for archive rows whose PFF player_id
--    could not be matched against player.pff_id or by the name/pos/team fallback.
--    Forensic surface; remediation is the reconcile-pff-unresolved-players task.
CREATE TABLE public.pff_unresolved_players (
    pff_player_id integer NOT NULL,
    year smallint NOT NULL,
    facet character varying(64) NOT NULL,
    name character varying(100),
    "position" character varying(5),
    pff_nfl_team character varying(8),
    nfl_team character varying(3),
    source_file character varying(255),
    first_seen integer DEFAULT EXTRACT(epoch FROM now()) NOT NULL,
    last_seen integer DEFAULT EXTRACT(epoch FROM now()) NOT NULL,
    CONSTRAINT pff_unresolved_players_pkey PRIMARY KEY (pff_player_id, year, facet)
);

CREATE INDEX pff_unresolved_players_year_idx
    ON public.pff_unresolved_players (year);
