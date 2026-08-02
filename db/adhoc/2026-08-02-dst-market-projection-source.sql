-- STATUS: PENDING
--
-- Register the DST market model as a projection source.
--
-- No vendor supplies defensive_points_against -- ESPN, PFF and Sleeper are NULL
-- on it across all 32 defenses -- and it is the largest single DST scoring
-- component. The opponent's market-implied team total is a daily-repriced
-- forecast of exactly that quantity, and it is already imported as
-- GAME_TEAM_TOTAL.
--
-- Measured against 2025 (n = 508 team-games, the only season with game lines
-- imported): the vendor weekly DST board fits at r = 0.444 against realized
-- weekly DST points; adding this source's points-against lifts it to r = 0.491.
--
-- uid 30 rather than 29: external_data_sources.CHARTING already reserves 29 in
-- libs-shared/constants/source-constants.mjs even though it has no sources row.

BEGIN;

INSERT INTO public.sources (uid, name, url)
VALUES (30, 'DST Market Model', 'https://xo.football')
ON CONFLICT (uid) DO UPDATE SET name = EXCLUDED.name, url = EXCLUDED.url;

COMMIT;
