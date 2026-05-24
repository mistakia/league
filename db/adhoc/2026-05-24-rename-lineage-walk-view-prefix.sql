-- Rename v_roster_asset_lineage_walk -> view_roster_asset_lineage_walk to
-- match the verbose `view_` prefix convention adopted in
-- 2026-05-24-add-current-salary-view.sql. Going forward all views use
-- `view_` rather than `v_` for readability.

ALTER VIEW public.v_roster_asset_lineage_walk RENAME TO view_roster_asset_lineage_walk;
