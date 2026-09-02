-- STATUS: APPLIED 2026-09-02 against league_production
--
-- Remove every manager but the commissioner from the auction mirror (league
-- 119), leaving the board intact and the other teams unowned.
--
-- WHY. `users_teams` is league MEMBERSHIP, not decoration: a row there puts the
-- league in that user's league list, lets them open it and write to it, and
-- makes them a notification recipient. `scripts/clone-league.mjs` copied league
-- 1's whole `users_teams` set into the mirror, so all fifteen GENESIS managers
-- were enrolled in a league none of them joined -- one running a test auction,
-- where a click writes real rows. Fourteen of them should never have been able
-- to reach it.
--
-- The clone no longer does this: `clone_league_board` narrows the copy to the
-- target league's own `commissioner_user_id`, so a re-sync will not put these
-- rows back. This file clears the ones the earlier syncs already wrote.
--
-- SCOPED BY tid, NOT BY (tid, season_year). `teams.team_id` comes from a single
-- global sequence and no id is shared across leagues, so the tid set alone
-- names the mirror exactly -- and it also reaches a membership row for a season
-- year that has no `teams` row, which a two-column join would leave behind.
--
-- ANCHORED ON commissioner_user_id, not on a literal 1, so this file says the
-- same thing the code does. Verified against league 119 before writing: 98 rows
-- across 14 users, leaving user 1's 8 rows on team 315.
--
-- LEAGUE 119 IS NAMED EXPLICITLY AND league 1 CANNOT BE REACHED BY THIS FILE.
-- The `is_hosted AND name` predicate is a second, independent assertion that
-- the target is the mirror: if the mirror were ever renamed or archived away,
-- this deletes nothing rather than deleting from whatever now holds id 119.

DELETE FROM public.users_teams
WHERE tid IN (
    SELECT t.team_id
    FROM public.teams t
    JOIN public.leagues l ON l.league_id = t.lid
    WHERE t.lid = 119
      AND l.is_hosted
      AND l.name = 'GENESIS LEAGUE (auction mirror)'
  )
  AND user_id <> (
    SELECT commissioner_user_id FROM public.leagues WHERE league_id = 119
  );
