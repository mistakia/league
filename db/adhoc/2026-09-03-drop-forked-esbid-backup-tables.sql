-- STATUS: APPLIED 2026-09-03 against league_production
--
-- Drop the forked-esbid repair's backup tables. Closes the rollback window
-- opened by db/adhoc/2026-09-03-repair-forked-play-stats-esbids.sql and the
-- schema trap broadcast as bulletin #622.
--
-- WHY THEY MUST GO. yarn export:schema sweeps them into db/schema.postgres.sql
-- as 584 lines, so every session exporting the schema for its own DDL commits
-- rollback scaffolding as though it were part of the model. docs/guides/schema.md
-- carries the general rule: a backup table that outlives the verification it
-- existed for is not caution, it is cruft with a blast radius.
--
-- WHY IT IS SAFE, measured rather than asserted. Verified against production
-- 2026-09-03 immediately before this ran, comparing every backup row against
-- the canonical tables as whole-row jsonb:
--
--   RE-POINT HALF (84,719 / 23,522 / 2,310 rows) is fully self-reversing.
--   Every row exists live at esbid + 50, byte-identical in every column. Zero
--   unrecoverable across all three tables. The zero is falsifiable: mapping to
--   esbid + 49 instead reports all 23,522, and withholding one live row
--   reports exactly 1.
--
--   DELETE HALF is now fully extracted. The charting this delete originally
--   destroyed -- 45 columns on 121 plays that the surviving copy lacked
--   entirely -- was restored to the canonical table first, in
--   db/adhoc/2026-09-03-restore-deleted-singleton-charting.sql. The plays
--   comparison now reads 0 backup-only cells, down from 4,293.
--
-- WHAT IS KNOWINGLY LOST, and it is the whole of it:
--
--   27 junk rows with no counterpart anywhere. 23 play stats, every one
--   is_valid false; and 4 plays, every one a tombstone with is_deleted true
--   and 12 of 418 columns populated. Both characterisations were controlled by
--   inverting the predicate, which reports 23 and 4 rather than 0.
--
--   195 play-stat cells of nfl_team_id and smart_player_id that are
--   UNATTRIBUTABLE, not merely small. All 157 rows carrying them have a null
--   player_name, and the unique index (esbid, play_id, stat_id, player_name)
--   treats nulls as distinct, so one backup row matches two live rows with no
--   way to tell which it belongs to. Restoring them would spray values onto
--   rows they may not belong to. Both surviving games sit at NORMAL density for
--   these columns -- 87 percent against 86 percent league-wide -- so this is
--   ordinary sparse-fill variance and not a systematic gap.
--
-- Nothing else in the backups is absent from the canonical tables.

drop table forked_esbid_backup_20260903_nfl_play_stats;
drop table forked_esbid_backup_20260903_nfl_plays;
drop table forked_esbid_backup_20260903_player_gamelogs;

-- POST-CONDITION. A drop that silently did nothing would leave the schema trap
-- in place while this file recorded it as closed.
do $$
declare
  n_remaining int;
begin
  select count(*) into n_remaining
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relname like 'forked\_esbid\_backup\_%';
  if n_remaining <> 0 then
    raise exception '% forked_esbid_backup table(s) survive the drop', n_remaining;
  end if;
end $$;
