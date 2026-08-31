-- Lift the data-view export row ceiling for KoalatyStats.
--
-- STATUS: APPLIED 2026-08-31 against league_production
--
-- Correction to 2026-08-31-add-user-api-keys-and-export-row-limit.sql, whose
-- own UPDATE matched zero rows: it predicated on username = 'koalatystats' and
-- the stored username is 'KoalatyStats'. `users.username` is case-SENSITIVE
-- (character varying, no citext, no lower() unique index), so a lowercase
-- literal silently matches nothing -- an UPDATE that affects no row is not an
-- error, which is why the miss was visible only in the `UPDATE 0` line.
--
-- NULL means no ceiling, per the column's comment in the file above.

UPDATE public.users
   SET data_view_export_max_rows = NULL
 WHERE username = 'KoalatyStats';
