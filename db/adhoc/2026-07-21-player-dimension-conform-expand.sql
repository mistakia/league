-- player person-dimension conform: EXPAND phase (identity-crosswalk cluster)
--
-- Redesign task: user:task/league/redesign-league-database-schema.md
-- Column mapping: scratch/league/schema-redesign/player-column-mapping.md
-- Guideline: user:guideline/league/database-schema-standards.md
--
-- What this does, all metadata-only except two small 28k-row table rewrites
-- (the dob retype and the gsispid tighten):
--   1. clean the single junk gsispid (the literal string 'null')
--   2. rename the base table player -> player_dimension
--   3. rename 62 columns to full-word snake_case / {system}_player_id form
--      (dob -> date_of_birth is a PURE RENAME: the column stays varchar(10)).
--   4. tighten smart_player_id varchar(47) -> varchar(36) (36-char NFL smart_ids)
--   5. drop the dead rtsports_id column (0 rows populated in prod)
--   6. repoint the name-search trigger function to the renamed name columns
--   7. create the updatable dual-name compat view `player` (old + new names)
--
-- NOTE: the date_of_birth varchar(10) -> date RETYPE is DELIBERATELY DEFERRED out
-- of this package. A rename is shielded by the compat view (same value, aliased
-- name); a TYPE change is NOT -- `player.dob` is consumed as text by the player_age
-- data-view SQL (TO_DATE(player.dob,...), player.dob = '0000-00-00') and by
-- update-player/merge-player/find-player-row string comparisons. The retype ships
-- as a separate coordinated change that rewrites those consumers and flips the type
-- together (opus review 2026-07-21).
--      over the renamed base, so the 651 consumers keep working (reads AND
--      writes) while they are repointed to the new names, then the view retires
--      in the CONTRACT phase.
--
-- PRECONDITIONS (runbook, verified live before this runs):
--   - legacy_pid already retired (2026-07-21-player-legacy-pid-retire.sql), so
--     this script does not reference it.
--   - no pid-rekey prep-02 rewrite in flight on any prep-02 target.
--   - backup validated off-VPS.
-- yarn db:exec wraps this whole file in ONE transaction (ON_ERROR_STOP=1), so
-- external sessions see player as the base table until commit, then as the view
-- atomically -- no intermediate window where player is missing.

-- 1. clean the junk gsispid before the tighten (validated: exactly one row,
--    the literal string 'null' on CORE-TAYL-015520)
UPDATE public.player SET gsispid = NULL WHERE gsispid = 'null';

-- 2. rename the base table; the compat view takes over the `player` name below
ALTER TABLE public.player RENAME TO player_dimension;

-- 3. column renames (full-word snake_case; external ids -> {system}_player_id)
-- name
ALTER TABLE public.player_dimension RENAME COLUMN fname TO first_name;
ALTER TABLE public.player_dimension RENAME COLUMN lname TO last_name;
ALTER TABLE public.player_dimension RENAME COLUMN pname TO short_name;
ALTER TABLE public.player_dimension RENAME COLUMN formatted TO formatted_name;
-- position
ALTER TABLE public.player_dimension RENAME COLUMN pos TO primary_position;
ALTER TABLE public.player_dimension RENAME COLUMN pos1 TO secondary_position;
ALTER TABLE public.player_dimension RENAME COLUMN pos2 TO tertiary_position;
ALTER TABLE public.player_dimension RENAME COLUMN posd TO position_depth;
-- combine / physical measurements
ALTER TABLE public.player_dimension RENAME COLUMN height TO height_inches;
ALTER TABLE public.player_dimension RENAME COLUMN weight TO weight_pounds;
ALTER TABLE public.player_dimension RENAME COLUMN forty TO forty_yard_dash_seconds;
ALTER TABLE public.player_dimension RENAME COLUMN bench TO bench_press_reps;
ALTER TABLE public.player_dimension RENAME COLUMN vertical TO vertical_jump_inches;
ALTER TABLE public.player_dimension RENAME COLUMN broad TO broad_jump_inches;
ALTER TABLE public.player_dimension RENAME COLUMN shuttle TO shuttle_run_seconds;
ALTER TABLE public.player_dimension RENAME COLUMN cone TO three_cone_drill_seconds;
ALTER TABLE public.player_dimension RENAME COLUMN arm TO arm_length_inches;
ALTER TABLE public.player_dimension RENAME COLUMN hand TO hand_size_inches;
ALTER TABLE public.player_dimension RENAME COLUMN forty_designation TO forty_yard_dash_designation;
ALTER TABLE public.player_dimension RENAME COLUMN ten_yard_split TO ten_yard_split_seconds;
ALTER TABLE public.player_dimension RENAME COLUMN pro_forty TO pro_day_forty_seconds;
ALTER TABLE public.player_dimension RENAME COLUMN pro_forty_designation TO pro_day_forty_designation;
ALTER TABLE public.player_dimension RENAME COLUMN sixty_yard_shuttle TO sixty_yard_shuttle_seconds;
-- draft / college / bio
ALTER TABLE public.player_dimension RENAME COLUMN dpos TO draft_overall_pick;
ALTER TABLE public.player_dimension RENAME COLUMN round TO draft_round;
ALTER TABLE public.player_dimension RENAME COLUMN dcp TO draft_capital_points;
ALTER TABLE public.player_dimension RENAME COLUMN col TO college;
ALTER TABLE public.player_dimension RENAME COLUMN dv TO college_division;
ALTER TABLE public.player_dimension RENAME COLUMN dob TO date_of_birth;
-- status
ALTER TABLE public.player_dimension RENAME COLUMN jnum TO jersey_number;
-- external ids -> {system}_player_id
ALTER TABLE public.player_dimension RENAME COLUMN nfl_id TO nfl_player_id;
ALTER TABLE public.player_dimension RENAME COLUMN esbid TO esb_player_id;
ALTER TABLE public.player_dimension RENAME COLUMN gsisid TO gsis_player_id;
ALTER TABLE public.player_dimension RENAME COLUMN gsispid TO smart_player_id;
ALTER TABLE public.player_dimension RENAME COLUMN gsis_it_id TO gsis_it_player_id;
ALTER TABLE public.player_dimension RENAME COLUMN sleeper_id TO sleeper_player_id;
ALTER TABLE public.player_dimension RENAME COLUMN rotoworld_id TO rotoworld_player_id;
ALTER TABLE public.player_dimension RENAME COLUMN rotowire_id TO rotowire_player_id;
ALTER TABLE public.player_dimension RENAME COLUMN sportradar_id TO sportradar_player_id;
ALTER TABLE public.player_dimension RENAME COLUMN espn_id TO espn_player_id;
ALTER TABLE public.player_dimension RENAME COLUMN fantasy_data_id TO fantasy_data_player_id;
ALTER TABLE public.player_dimension RENAME COLUMN yahoo_id TO yahoo_player_id;
ALTER TABLE public.player_dimension RENAME COLUMN keeptradecut_id TO keeptradecut_player_id;
ALTER TABLE public.player_dimension RENAME COLUMN pfr_id TO pfr_player_id;
ALTER TABLE public.player_dimension RENAME COLUMN otc_id TO otc_player_id;
ALTER TABLE public.player_dimension RENAME COLUMN pff_id TO pff_player_id;
ALTER TABLE public.player_dimension RENAME COLUMN mfl_id TO mfl_player_id;
ALTER TABLE public.player_dimension RENAME COLUMN fleaflicker_id TO fleaflicker_player_id;
ALTER TABLE public.player_dimension RENAME COLUMN cbs_id TO cbs_player_id;
ALTER TABLE public.player_dimension RENAME COLUMN cfbref_id TO cfbref_player_id;
ALTER TABLE public.player_dimension RENAME COLUMN swish_id TO swish_player_id;
ALTER TABLE public.player_dimension RENAME COLUMN draftkings_id TO draftkings_player_id;
ALTER TABLE public.player_dimension RENAME COLUMN fanduel_id TO fanduel_player_id;
ALTER TABLE public.player_dimension RENAME COLUMN rts_id TO rts_player_id;
ALTER TABLE public.player_dimension RENAME COLUMN sis_id TO sis_player_id;
ALTER TABLE public.player_dimension RENAME COLUMN sis_prospect_pos_rank TO sis_prospect_position_rank;
ALTER TABLE public.player_dimension RENAME COLUMN ffpc_id TO ffpc_player_id;
ALTER TABLE public.player_dimension RENAME COLUMN nffc_id TO nffc_player_id;
ALTER TABLE public.player_dimension RENAME COLUMN fantrax_id TO fantrax_player_id;
ALTER TABLE public.player_dimension RENAME COLUMN sumer_id TO sumer_player_id;
ALTER TABLE public.player_dimension RENAME COLUMN fantasylabs_id TO fantasylabs_player_id;
ALTER TABLE public.player_dimension RENAME COLUMN underdog_id TO underdog_player_id;

-- 4. tighten smart_player_id -> varchar(36) (the NFL smart_id fixed width).
--    Type-narrowing that does not change values: all non-null values are already
--    36 chars after the 'null' cleanup above, so no consumer sees a value change.
ALTER TABLE public.player_dimension
  ALTER COLUMN smart_player_id TYPE character varying(36);

-- 5. drop the dead rtsports_id column (0 rows populated; DROP auto-removes
--    player_rtsports_id_unique + idx_player_rtsports_id). rts_player_id (renamed
--    from rts_id) is the live RTSports id.
ALTER TABLE public.player_dimension DROP COLUMN rtsports_id;

-- 6. repoint the name-search trigger function to the renamed name columns. The
--    trigger stays on player_dimension (moved with the RENAME); only the plpgsql
--    body's column references need updating.
CREATE OR REPLACE FUNCTION public.player_name_search_vector_update() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.name_search_vector :=
    setweight(to_tsvector('english', coalesce(NEW.first_name,'')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.last_name,'')), 'A');
  RETURN NEW;
END
$$;

-- 7. updatable dual-name compat view. Projects every renamed column under BOTH
--    its new name and its old name (alias), and kept columns once. Auto-updatable
--    (verified on PG16): consumers repointed to new names and consumers still on
--    old names both read and write through `player`; defaults and the trigger
--    fire on the base. legacy_pid (retired) and rtsports_id (dropped) are absent.
CREATE VIEW public.player AS
  SELECT
    pid,
    -- name
    first_name,      first_name      AS fname,
    last_name,       last_name       AS lname,
    short_name,      short_name      AS pname,
    formatted_name,  formatted_name  AS formatted,
    -- position
    primary_position,   primary_position   AS pos,
    secondary_position, secondary_position AS pos1,
    tertiary_position,  tertiary_position  AS pos2,
    position_depth,     position_depth     AS posd,
    -- combine / physical
    height_inches,            height_inches            AS height,
    weight_pounds,            weight_pounds            AS weight,
    forty_yard_dash_seconds,  forty_yard_dash_seconds  AS forty,
    bench_press_reps,         bench_press_reps         AS bench,
    vertical_jump_inches,     vertical_jump_inches     AS vertical,
    broad_jump_inches,        broad_jump_inches        AS broad,
    shuttle_run_seconds,      shuttle_run_seconds      AS shuttle,
    three_cone_drill_seconds, three_cone_drill_seconds AS cone,
    arm_length_inches,        arm_length_inches        AS arm,
    hand_size_inches,         hand_size_inches         AS hand,
    forty_yard_dash_designation,    forty_yard_dash_designation    AS forty_designation,
    ten_yard_split_seconds,         ten_yard_split_seconds         AS ten_yard_split,
    ten_yard_split_designation,
    pro_day_forty_seconds,          pro_day_forty_seconds          AS pro_forty,
    pro_day_forty_designation,      pro_day_forty_designation      AS pro_forty_designation,
    sixty_yard_shuttle_seconds,     sixty_yard_shuttle_seconds     AS sixty_yard_shuttle,
    sixty_yard_shuttle_designation,
    combine_attendance,
    -- draft / college / bio
    draft_overall_pick,   draft_overall_pick   AS dpos,
    draft_round,          draft_round          AS round,
    draft_capital_points, draft_capital_points AS dcp,
    draft_team,
    nfl_draft_year,
    college,          college          AS col,
    college_division, college_division AS dv,
    high_school,
    hometown,
    date_of_birth,    date_of_birth    AS dob,
    -- status
    current_nfl_team,
    jersey_number,    jersey_number    AS jnum,
    roster_status,
    game_designation,
    -- external ids
    nfl_player_id,          nfl_player_id          AS nfl_id,
    esb_player_id,          esb_player_id          AS esbid,
    gsis_player_id,         gsis_player_id         AS gsisid,
    smart_player_id,        smart_player_id        AS gsispid,
    gsis_it_player_id,      gsis_it_player_id      AS gsis_it_id,
    sleeper_player_id,      sleeper_player_id      AS sleeper_id,
    rotoworld_player_id,    rotoworld_player_id    AS rotoworld_id,
    rotowire_player_id,     rotowire_player_id     AS rotowire_id,
    sportradar_player_id,   sportradar_player_id   AS sportradar_id,
    espn_player_id,         espn_player_id         AS espn_id,
    fantasy_data_player_id, fantasy_data_player_id AS fantasy_data_id,
    yahoo_player_id,        yahoo_player_id        AS yahoo_id,
    keeptradecut_player_id, keeptradecut_player_id AS keeptradecut_id,
    pfr_player_id,          pfr_player_id          AS pfr_id,
    otc_player_id,          otc_player_id          AS otc_id,
    pff_player_id,          pff_player_id          AS pff_id,
    mfl_player_id,          mfl_player_id          AS mfl_id,
    fleaflicker_player_id,  fleaflicker_player_id  AS fleaflicker_id,
    cbs_player_id,          cbs_player_id          AS cbs_id,
    cfbref_player_id,       cfbref_player_id       AS cfbref_id,
    swish_player_id,        swish_player_id        AS swish_id,
    draftkings_player_id,   draftkings_player_id   AS draftkings_id,
    fanduel_player_id,      fanduel_player_id      AS fanduel_id,
    rts_player_id,          rts_player_id          AS rts_id,
    sis_player_id,          sis_player_id          AS sis_id,
    ffpc_player_id,         ffpc_player_id         AS ffpc_id,
    nffc_player_id,         nffc_player_id         AS nffc_id,
    fantrax_player_id,      fantrax_player_id      AS fantrax_id,
    sumer_player_id,        sumer_player_id        AS sumer_id,
    fantasylabs_player_id,  fantasylabs_player_id  AS fantasylabs_id,
    underdog_player_id,     underdog_player_id     AS underdog_id,
    twitter_username,
    -- kept source-token columns (operator ruling 2026-07-20: NOT obfuscated;
    -- pff_player_id is projected in the external-ids block above)
    ngs_athleticism_score,
    ngs_draft_grade,
    ngs_production_score,
    ngs_size_score,
    nfl_grade,
    sis_prospect_grade,
    sis_prospect_position_rank, sis_prospect_position_rank AS sis_prospect_pos_rank,
    sis_prospect_overall_rank,
    -- contract (already conforming)
    contract_year_signed,
    contract_years,
    contract_value,
    contract_apy,
    contract_guaranteed,
    contract_apy_cap_pct,
    contract_inflated_value,
    contract_inflated_apy,
    contract_inflated_guaranteed,
    -- accolades (already conforming)
    all_pro_first_team_selections,
    pro_bowls_selections,
    pfr_years_as_primary_starter,
    pfr_weighted_career_approximate_value,
    pfr_weighted_career_approximate_value_drafted_team,
    -- search
    name_search_vector
  FROM public.player_dimension;

-- match the base table's grant (SELECT to league_reader; writes go through the
-- owning role that runs the app)
GRANT SELECT ON public.player TO league_reader;
