-- STATUS: PENDING
--
-- Conform external-id columns to the {system}_{entitytype}_id standard.
--
-- Three families, 17 renames. No index and no constraint names either of these
-- columns, verified against db/schema.postgres.sql, so there is nothing for the
-- "RENAME COLUMN renames neither constraints nor indexes" rule to catch and no
-- identifier approaches the 63-byte cap (longest new name is 39 bytes).
--
-- nfl_plays is partitioned; a rename against the partitioned parent cascades to
-- every child as a catalog-only operation, so the DDL is cheap. The cost of this
-- cluster is the consumer surface, not the apply.
--
-- No BEGIN/COMMIT: db-exec.sh already runs this file under --single-transaction.
--
-- Family 1 -- league-provider ids on `leagues`.
-- Each names the system but not the entity type, and each identifies a LEAGUE in
-- the provider's namespace.
--
-- Family 2 -- role-qualified Sportradar player ids on `nfl_plays`.
-- Per the 2026-08-07 operator ruling the qualifier goes FIRST and the
-- system-entity pair `sportradar_player_id` stays intact as a trailing token,
-- because that is what a future audit rule or grep keys on. The redundant
-- `player` token in the current role (`penalty_player_`, `sack_player_1_`) is
-- dropped, since the trailing entity token now supplies it -- that is the
-- ruling's own worked example (`penalty_player_sportradar_id` ->
-- `penalty_sportradar_player_id`) applied to the numbered forms.
--
-- Ten columns, not the seven the audit flags. `kicker_sportradar_id`,
-- `punter_sportradar_id` and `returner_sportradar_id` escape the audit because
-- `conforms_external` accepts any bare two-token `x_y_id` name: the rule reads
-- token COUNT and never token ORDER, so a role-system-id column is
-- indistinguishable from a system-entity-id one. The audit count will therefore
-- move by 14, not by 17.
--
-- Family 3 -- PFF player ids on the three PFF log tables.
-- `player.pff_id` was already conformed to `pff_player_id` by an earlier
-- cluster, so this rename makes the schema uniform on one spelling rather than
-- widening scope onto `player`.

ALTER TABLE public.leagues RENAME COLUMN espn_id TO espn_league_id;
ALTER TABLE public.leagues RENAME COLUMN sleeper_id TO sleeper_league_id;
ALTER TABLE public.leagues RENAME COLUMN mfl_id TO mfl_league_id;
ALTER TABLE public.leagues RENAME COLUMN fleaflicker_id TO fleaflicker_league_id;

ALTER TABLE public.nfl_plays RENAME COLUMN penalty_player_sportradar_id TO penalty_sportradar_player_id;
ALTER TABLE public.nfl_plays RENAME COLUMN tackle_for_loss_1_sportradar_id TO tackle_for_loss_1_sportradar_player_id;
ALTER TABLE public.nfl_plays RENAME COLUMN tackle_for_loss_2_sportradar_id TO tackle_for_loss_2_sportradar_player_id;
ALTER TABLE public.nfl_plays RENAME COLUMN sack_player_1_sportradar_id TO sack_1_sportradar_player_id;
ALTER TABLE public.nfl_plays RENAME COLUMN sack_player_2_sportradar_id TO sack_2_sportradar_player_id;
ALTER TABLE public.nfl_plays RENAME COLUMN fumble_forced_1_sportradar_id TO fumble_forced_1_sportradar_player_id;
ALTER TABLE public.nfl_plays RENAME COLUMN fumble_recovered_1_sportradar_id TO fumble_recovered_1_sportradar_player_id;
ALTER TABLE public.nfl_plays RENAME COLUMN kicker_sportradar_id TO kicker_sportradar_player_id;
ALTER TABLE public.nfl_plays RENAME COLUMN punter_sportradar_id TO punter_sportradar_player_id;
ALTER TABLE public.nfl_plays RENAME COLUMN returner_sportradar_id TO returner_sportradar_player_id;

ALTER TABLE public.pff_player_facet_gamelogs RENAME COLUMN pff_id TO pff_player_id;
ALTER TABLE public.pff_player_facet_seasonlogs RENAME COLUMN pff_id TO pff_player_id;
ALTER TABLE public.pff_player_seasonlogs RENAME COLUMN pff_id TO pff_player_id;
