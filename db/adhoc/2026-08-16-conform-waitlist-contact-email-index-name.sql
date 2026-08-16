-- STATUS: APPLIED 2026-08-16 against league_production
--
-- Conforms the index added minutes earlier by
-- db/adhoc/2026-08-16-waitlist-edit-link-revocation-and-lookup.sql to this
-- schema's actual naming convention, which was checked only after that file had
-- already been applied.
--
-- docs/database-index-naming.md states `idx_table_column_purpose`, and a count
-- of the live schema agrees: of the indexes anybody NAMED by hand, 297 carry the
-- `idx_` prefix against 5 carrying knex's `<table>_<column>_index` default. (The
-- ~2,000 remaining are Postgres-generated `..._idx` names on the nfl_plays
-- partitions, which nobody chose.) The sibling index on this same table,
-- manager_waitlist_submissions_submitted_at_index, is one of the 5 -- following
-- it would have entrenched the minority form in new work.
--
-- Nothing references an index by name, so this is a rename rather than a drop
-- and rebuild.

ALTER INDEX manager_waitlist_submissions_contact_email_index
  RENAME TO idx_manager_waitlist_submissions_contact_email;
