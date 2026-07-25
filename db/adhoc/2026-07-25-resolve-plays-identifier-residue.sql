-- Resolve the plays-family identifier naming residue the nfl-plays-snaps conform
-- left unruled, so a later audit cannot reopen it.
--
-- ############################################################################
-- ## NOT APPLIED. Prepared and verified, but it has NO operator apply        ##
-- ## authorization. It contains two DROP COLUMN statements and must not be   ##
-- ## run without the operator's own explicit go for this specific file.      ##
-- ############################################################################
--
-- None of these columns is flagged by db/adhoc/audit-schema-conformance.mjs --
-- the audit is blind to all of them. They were raised as "needs an explicit
-- ruling" and this file is that ruling, with the evidence for each.
--
--
-- 1. nfl_plays_player.smart_id -> smart_player_id   (RENAME)
--
-- The schema's only smart_id. nfl_play_stats, nfl_play_stats_current_week and
-- canonical player all spell the same nflverse value smart_player_id, and the
-- nfl-plays-snaps conform itself renamed gsispid -> smart_player_id on
-- nfl_play_stats the same day -- this is the one instance it missed. Verified
-- same value domain (32004255-5406-... on all three tables).
--
-- Zero code consumers: nothing in the tree writes nfl_plays_player at all, and
-- its one reader (scripts/process-nfl-plays-player.mjs) never selects this
-- column. The apparent smart_id hits in scripts/import-plays-nfl-v1.mjs and
-- import-players-nfl.mjs are local variables that write the already-correct
-- smart_player_id on other tables.
--
-- NOT retyped here: nfl_plays_player.smart_id is uuid while the other three are
-- varchar, so after this rename three columns share a name across two types and
-- still need a cast to join. Cross-table player-identifier typing belongs to the
-- identity-crosswalk cluster, not to this tail; recorded as a finding.
--
--
-- 2. nfl_plays_passer.target_gsis_id     (DROP -- redundant, not misnamed)
--    nfl_plays_passer.target_gsis_it_id  (DROP -- redundant, not misnamed)
--
-- Both are pure duplication of data already held elsewhere, so the clean end
-- state is removal rather than a rename into a conforming spelling:
--
--   target_gsis_id is byte-identical to nfl_plays.trg_gsis on ALL 1058 rows of
--   nfl_plays_passer (nulls included, zero divergence), joined on
--   (esbid, play_id). Same targeted receiver, same GSIS id, stored twice.
--
--   target_gsis_it_id is fully derivable: all 940 non-null rows equal
--   player.gsis_it_player_id looked up via that GSIS id, with no null in the
--   dimension for any of them.
--
-- Zero code consumers for either -- no reference anywhere in libs-server,
-- libs-shared, app, api, jobs, scripts, or the private submodule. Dropping
-- target_gsis_it_id also removes it from the gsis_it_id question in note 4.
--
-- No index, constraint or default depends on either column (verified against
-- pg_index), so both drops are metadata-only on a 392 kB table.
--
--
-- 3. nfl_plays.targeted_defender_gsis_id -> targeted_defender_gsis   (RENAME)
--
-- This one is genuine and non-redundant -- it is the defender covering the
-- target, distinct from trg_gsis (the receiver), verified on sample rows where
-- the two differ. It holds the same 00-00XXXXX GSIS player id format.
--
-- Conformed to the ratified {role}_gsis pattern rather than to the canonical
-- {system}_{entitytype}_id, because nfl_plays already carries 24 operator-
-- ratified keeps in exactly that shape (bc_gsis, psr_gsis, trg_gsis,
-- solo_tackle_1_gsis, ...). Renaming this one to targeted_defender_gsis makes
-- the family 100% internally consistent with zero exceptions and without
-- reopening the 2026-07-23 keep ruling. Choosing the canonical spelling instead
-- would mean renaming all 25.
--
-- One code consumer, repointed in lockstep:
--   private/scripts/import-plays-playerprofiler.mjs:281
--
--
-- 4. gsis_it_id -- KEPT, and explicitly DEFERRED to identity-crosswalk.
--
-- Not fixed here, and deliberately so. player spells the same concept
-- gsis_it_player_id, and scripts/process-nfl-plays-player.mjs:41 joins them in a
-- single predicate that spells it both ways at once
-- (`player.gsis_it_player_id = nfl_plays_player.gsis_it_id`), so the
-- inconsistency is real. But it is not tail work: 18 files and 74 references
-- across the public tree and the private submodule, including two data-views
-- engine files (build-period-cte.mjs, rate-type-per-player-play.mjs) of exactly
-- the kind that produced this redesign's one near-miss 42703, plus an onConflict
-- key on nfl_snaps. It is already on the audit's known_bad_external_ids roster
-- and already has player-dimension adhocs in flight
-- (2026-07-21-player-dimension-conform-expand.sql). It belongs to the
-- identity-crosswalk / player-dimension cluster and should be swept with the
-- player dimension, not bolted onto this one.
--
--
-- Post-apply: yarn export:schema. The audit total is unchanged either way (none
-- of these were flagged); the point is that the ruling is now recorded.

BEGIN;

ALTER TABLE public.nfl_plays_player
  RENAME COLUMN smart_id TO smart_player_id;

ALTER TABLE public.nfl_plays_passer
  DROP COLUMN target_gsis_id,
  DROP COLUMN target_gsis_it_id;

ALTER TABLE public.nfl_plays
  RENAME COLUMN targeted_defender_gsis_id TO targeted_defender_gsis;

COMMIT;
