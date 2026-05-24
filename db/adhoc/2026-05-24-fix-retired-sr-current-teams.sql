-- Reset current_nfl_team on retired Sr pids that picked up their Jr's team
-- via name-fallback writes in the import pipeline.
--
-- Anthony Johnson Sr (1989, b. 1967) retired by ~1998; CHI is Anthony Johnson Jr's team.
-- Kris Jenkins Sr (2001, b. 1979) retired by 2010; CIN is Kris Jenkins Jr's team
--   (Sr did play CIN 2010 so this one was ambiguous; resetting to INA since he is
--   definitely not currently active).

UPDATE player SET current_nfl_team='INA'
WHERE pid IN (
  'ANTH-JOHN-1989-1967-06-22',
  'KRIS-JENK-2001-1979-08-03'
);
