-- STATUS: APPLIED 2026-08-08 against league_production
--
-- Add total_dave to dvoa_team_unit_seasonlogs_history and _index.
--
-- DAVE (DVOA Adjusted for Variation Early) is a preseason-weighted variant of
-- total DVOA. It is the ONLY footballoutsiders pair with no existing home: every
-- other non-drive column maps onto a column these two tables already carry.
--
-- ONE column per table, not two. footballoutsiders encoded the offense/defense
-- split as separate odave/ddave columns because it packed both units into one
-- wide row; these tables carry team_unit as part of the key, so the split is
-- already expressed by the grain.
--
-- Named total_dave rather than a bare dave: audit-schema-conformance.mjs
-- is_bare_shorthand flags any underscore-free name of five characters or fewer,
-- so `dave` would have turned the ratchet red on landing. The total_ prefix is
-- the family it belongs to -- it is a variant of the total_dvoa sitting beside
-- it -- and `dave` is absent from the shorthand enumeration, so the prefixed
-- form clears the rule on its own terms rather than by evading it.
--
-- No total_dave_rank: no source supplies one, and unlike the drive-table ranks
-- it is not derivable here (a rank over a partial-week snapshot is not the rank
-- the source published).

ALTER TABLE public.dvoa_team_unit_seasonlogs_history
    ADD COLUMN total_dave numeric;

ALTER TABLE public.dvoa_team_unit_seasonlogs_index
    ADD COLUMN total_dave numeric;
