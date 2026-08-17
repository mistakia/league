-- STATUS: APPLIED 2026-08-17 against league_production
--
-- Move ownership of team 9 (league 1, "Is This Thing On?") from user 16
-- (greg, `eggboi`) to user 20 (`dw`, David Weinstein) for the current season
-- and the pre-seeded next one.
--
-- Ownership in this app is the `users_teams` join table -- (userid, tid,
-- season_year), primary key on all three. `teams` carries no user column, and
-- nothing else keys off the user: rosters, waivers, draft picks, trades and
-- transactions all key on `tid`, so they follow the team without being touched.
-- The `userid` columns on poaches/trades/waivers/transactions are submitter
-- audit stamps on historical rows and are deliberately left alone.
--
-- Why 2026 AND 2027. Both years already have a binding for every team (12 rows
-- each), so 2027 is pre-seeded rather than absent. Leaving 2027 on user 16
-- would silently hand the team back to greg next season.
--
-- Why greg's 2024 and 2025 rows stay. They are his real history -- he managed
-- team 9 for those seasons -- and `require_league_access` accepts a row in ANY
-- year, so retaining them is also what keeps his league read access intact
-- after he stops holding a current-season team. His user account is untouched;
-- disconnecting him from team 9 is not removing him.
--
-- David is a RECOVERY, not a new account: user 20 has held team 9 before, in
-- 2020-2023 (the teams rows for 2021-2023 still read "Weinstein, Davante").
-- There is exactly one David Weinstein account, so there is no duplicate to
-- create and no identifier to invent.
--
-- Two consequences that reach past the team, both blessed by the operator
-- before this was applied:
--
--   * Team WRITES gate on current_season.year alone
--     (libs-server/verify-user-team.mjs), so from this apply David can act on
--     team 9 -- including its four unmade 2026 rookie picks -- and greg cannot.
--     Team 9 is greg's only 2026/2027 binding.
--   * Seated-Manager status for admission votes and waitlist review is derived
--     from a users_teams row at current_season.year
--     (api/routes/admission-votes.mjs, api/routes/waitlist-submissions.mjs), so
--     greg loses that seat and David gains it.
--
-- calculate-league-careerlogs.mjs derives league_user_careerlogs from this
-- table, so its next run attributes the 2026 team-9 seasonlog to David. The
-- 2026 season has not been played, so that figure is a stub today.
--
-- The pre- and post-conditions below are asserted rather than assumed: this is
-- live league data during an open rookie draft, and a silent no-op here reads
-- exactly like a successful apply.

-- Pre-condition: greg holds exactly the two rows we mean to move, and David
-- holds neither of them (an existing row would collide on the primary key).
DO $$
DECLARE
    greg_rows integer;
    david_rows integer;
BEGIN
    SELECT count(*) INTO greg_rows
      FROM users_teams
     WHERE tid = 9 AND userid = 16 AND season_year IN (2026, 2027);

    SELECT count(*) INTO david_rows
      FROM users_teams
     WHERE tid = 9 AND userid = 20 AND season_year IN (2026, 2027);

    IF greg_rows <> 2 THEN
        RAISE EXCEPTION
            'pre-condition failed: expected 2 rows for userid 16 on tid 9 in 2026/2027, found %',
            greg_rows;
    END IF;

    IF david_rows <> 0 THEN
        RAISE EXCEPTION
            'pre-condition failed: expected 0 rows for userid 20 on tid 9 in 2026/2027, found %',
            david_rows;
    END IF;
END $$;

UPDATE users_teams
   SET userid = 20
 WHERE tid = 9
   AND userid = 16
   AND season_year IN (2026, 2027);

-- Post-condition: the two rows moved, greg retains his 2024/2025 history, and
-- team 9 has exactly one holder per season year.
DO $$
DECLARE
    david_current integer;
    greg_current integer;
    greg_history integer;
    duplicate_years integer;
BEGIN
    SELECT count(*) INTO david_current
      FROM users_teams
     WHERE tid = 9 AND userid = 20 AND season_year IN (2026, 2027);

    SELECT count(*) INTO greg_current
      FROM users_teams
     WHERE tid = 9 AND userid = 16 AND season_year IN (2026, 2027);

    SELECT count(*) INTO greg_history
      FROM users_teams
     WHERE tid = 9 AND userid = 16 AND season_year IN (2024, 2025);

    SELECT count(*) INTO duplicate_years
      FROM (
            SELECT season_year
              FROM users_teams
             WHERE tid = 9
             GROUP BY season_year
            HAVING count(*) > 1
           ) AS d;

    IF david_current <> 2 THEN
        RAISE EXCEPTION
            'post-condition failed: expected 2 rows for userid 20 on tid 9 in 2026/2027, found %',
            david_current;
    END IF;

    IF greg_current <> 0 THEN
        RAISE EXCEPTION
            'post-condition failed: userid 16 still holds % row(s) on tid 9 in 2026/2027',
            greg_current;
    END IF;

    IF greg_history <> 2 THEN
        RAISE EXCEPTION
            'post-condition failed: greg''s 2024/2025 history on tid 9 must survive, found % row(s)',
            greg_history;
    END IF;

    IF duplicate_years <> 0 THEN
        RAISE EXCEPTION
            'post-condition failed: % season year(s) on tid 9 have more than one holder',
            duplicate_years;
    END IF;
END $$;
