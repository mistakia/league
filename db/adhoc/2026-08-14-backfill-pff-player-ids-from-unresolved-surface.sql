-- Backfill player.pff_player_id for PFF ids the archive ingest could not resolve
-- by name+position, adjudicated the Frank Gore way
-- (db/adhoc/2026-05-24-fix-frank-gore-pff-id-mixup.sql).
--
-- STATUS: APPLIED 2026-08-14 against league_production
--
-- Selection rule, applied to the 1,518 ids still unresolved after the resolver
-- fix in this same cluster:
--   * exact formatted-name or player_aliases match against player, AND
--   * exactly ONE candidate whose nfl_draft_year is within 1 year of a
--     draft_season PFF reports for that id, AND
--   * that candidate carries no OTHER pff_player_id (never overwrite a
--     distinct existing value -- the hijack-guard invariant), AND
--   * no second pff id adjudicates to the same player, AND
--   * the position group corroborates, or the pair is one this database is
--     known to cross-code (K/P, long snappers filed under OL/LB/TE).
--
-- 126 of these are the Sr/Jr collision class the hijack guard exists for
-- (Asante Samuel, Patrick Surtain, Jeremiah Trotter, Antoine Winfield, ...);
-- the draft-season corroboration is what picks the father over the son.
--
-- Every UPDATE is guarded on pff_player_id IS NULL, so re-running is a no-op
-- and a concurrent writer cannot be clobbered.

-- bryan cox (LB, draft 1991) <- PFF 11683 ["Bryan Cox"] draft [1991] [contested name]
UPDATE player SET pff_player_id = 11683 WHERE pid = 'BRYA-COXX-017513' AND pff_player_id IS NULL;
-- asante samuel (DB, draft 2003) <- PFF 1432 ["Asante Samuel"] draft [2003] [contested name]
UPDATE player SET pff_player_id = 1432 WHERE pid = 'ASAN-SAMU-009712' AND pff_player_id IS NULL;
-- jeremiah trotter (LB, draft 1998) <- PFF 372 ["Jeremiah Trotter"] draft [1998] [contested name]
UPDATE player SET pff_player_id = 372 WHERE pid = 'JERE-TROT-006537' AND pff_player_id IS NULL;
-- ray lewis (LB, draft 1996) <- PFF 167 ["Ray Lewis"] draft [1996]
UPDATE player SET pff_player_id = 167 WHERE pid = 'RAYX-LEWI-006314' AND pff_player_id IS NULL;
-- patrick surtain (CB, draft 1998) <- PFF 358 ["Patrick Surtain"] draft [1998] [contested name]
UPDATE player SET pff_player_id = 358 WHERE pid = 'PATR-SURT-001026' AND pff_player_id IS NULL;
-- antoine winfield (DB, draft 1999) <- PFF 456 ["Antoine Winfield"] draft [1999] [contested name]
UPDATE player SET pff_player_id = 456 WHERE pid = 'ANTO-WINF-017093' AND pff_player_id IS NULL;
-- aaron smith (DE, draft 1999) <- PFF 500 ["Aaron Smith"] draft [1999] [contested name]
UPDATE player SET pff_player_id = 500 WHERE pid = 'AARO-SMIT-016573' AND pff_player_id IS NULL;
-- justin smith (DL, draft 2001) <- PFF 776 ["Justin Smith"] draft [2001] [contested name]
UPDATE player SET pff_player_id = 776 WHERE pid = 'JUST-SMIT-027524' AND pff_player_id IS NULL;
-- andre carter (DL, draft 2001) <- PFF 779 ["Andre Carter"] draft [2001] [contested name]
UPDATE player SET pff_player_id = 779 WHERE pid = 'ANDR-CART-016859' AND pff_player_id IS NULL;
-- will allen (DB, draft 2001) <- PFF 792 ["Will Allen"] draft [2001] [contested name]
UPDATE player SET pff_player_id = 792 WHERE pid = 'WILL-ALLE-009553' AND pff_player_id IS NULL;
-- adrian wilson (DB, draft 2001) <- PFF 831 ["Adrian Wilson"] draft [2001]
UPDATE player SET pff_player_id = 831 WHERE pid = 'ADRI-WILS-016670' AND pff_player_id IS NULL;
-- jimmy williams (DB, draft 2001) <- PFF 915 ["Jimmy Williams"] draft [2001] [contested name]
UPDATE player SET pff_player_id = 915 WHERE pid = 'JIMM-WILL-010296' AND pff_player_id IS NULL;
-- kevin kaesviharn (DB, draft 2001) <- PFF 966 ["Kevin Kaesviharn"] draft [2001]
UPDATE player SET pff_player_id = 966 WHERE pid = 'KEVI-KAES-012967' AND pff_player_id IS NULL;
-- ed reed (DB, draft 2002) <- PFF 1031 ["Ed Reed"] draft [2002]
UPDATE player SET pff_player_id = 1031 WHERE pid = 'EDWA-REED-025946' AND pff_player_id IS NULL;
-- robert thomas (LB, draft 2002) <- PFF 1038 ["Robert Thomas"] draft [2002] [contested name]
UPDATE player SET pff_player_id = 1038 WHERE pid = 'ROBE-THOM-010680' AND pff_player_id IS NULL;
-- ken amato (LB, draft 2003) <- PFF 1214 ["Ken Amato"] draft [2002]
UPDATE player SET pff_player_id = 1214 WHERE pid = 'KENX-AMAT-022013' AND pff_player_id IS NULL;
-- ryan clark (DB, draft 2002) <- PFF 1229 ["Ryan Clark"] draft [2002]
UPDATE player SET pff_player_id = 1229 WHERE pid = 'RYAN-CLAR-026518' AND pff_player_id IS NULL;
-- troy polamalu (DB, draft 2003) <- PFF 1332 ["Troy Polamalu"] draft [2003]
UPDATE player SET pff_player_id = 1332 WHERE pid = 'TROY-POLA-025872' AND pff_player_id IS NULL;
-- mario haggan (LB, draft 2003) <- PFF 1526 ["Mario Haggan"] draft [2003]
UPDATE player SET pff_player_id = 1526 WHERE pid = 'MARI-HAGG-005576' AND pff_player_id IS NULL;
-- will smith (DL, draft 2004) <- PFF 1739 ["Will Smith"] draft [2004] [contested name]
UPDATE player SET pff_player_id = 1739 WHERE pid = 'WILL-SMIT-007354' AND pff_player_id IS NULL;
-- ahmad carroll (DB, draft 2004) <- PFF 1746 ["Ahmad Carroll"] draft [2004]
UPDATE player SET pff_player_id = 1746 WHERE pid = 'AHMA-CARR-016669' AND pff_player_id IS NULL;
-- will allen (DB, draft 2004) <- PFF 1832 ["Will Allen"] draft [2004] [contested name]
UPDATE player SET pff_player_id = 1832 WHERE pid = 'WILL-ALLE-011455' AND pff_player_id IS NULL;
-- keith lewis (DB, draft 2004) <- PFF 1914 ["Keith Lewis"] draft [2004] [contested name]
UPDATE player SET pff_player_id = 1914 WHERE pid = 'KEIT-LEWI-011819' AND pff_player_id IS NULL;
-- jordan babineaux (DB, draft 2004) <- PFF 1980 ["Jordan Babineaux"] draft [2004]
UPDATE player SET pff_player_id = 1980 WHERE pid = 'JORD-BABI-012857' AND pff_player_id IS NULL;
-- ryan fowler (LB, draft 2004) <- PFF 2047 ["Ryan Fowler"] draft [2004]
UPDATE player SET pff_player_id = 2047 WHERE pid = 'RYAN-FOWL-014181' AND pff_player_id IS NULL;
-- eddie jackson (DB, draft 2004) <- PFF 2079 ["Eddie Jackson"] draft [2004] [contested name]
UPDATE player SET pff_player_id = 2079 WHERE pid = 'EDDI-JACK-008363' AND pff_player_id IS NULL;
-- antrel rolle (DB, draft 2005) <- PFF 2225 ["Antrel Rolle"] draft [2005]
UPDATE player SET pff_player_id = 2225 WHERE pid = 'ANTR-ROLL-025844' AND pff_player_id IS NULL;
-- kevin burnett (LB, draft 2005) <- PFF 2259 ["Kevin Burnett"] draft [2005]
UPDATE player SET pff_player_id = 2259 WHERE pid = 'KEVI-BURN-004406' AND pff_player_id IS NULL;
-- chris harris (DB, draft 2005) <- PFF 2398 ["Chris Harris"] draft [2005] [contested name]
UPDATE player SET pff_player_id = 2398 WHERE pid = 'CHRI-HARR-002189' AND pff_player_id IS NULL;
-- mike smith (LB, draft 2005) <- PFF 2451 ["Mike Smith"] draft [2005] [contested name]
UPDATE player SET pff_player_id = 2451 WHERE pid = 'MIKE-SMIT-010200' AND pff_player_id IS NULL;
-- thomas johnson (DL, draft 2005) <- PFF 2659 ["Thomas Johnson"] draft [2005] [contested name]
UPDATE player SET pff_player_id = 2659 WHERE pid = 'THOM-JOHN-014543' AND pff_player_id IS NULL;
-- donte whitner (DB, draft 2006) <- PFF 2953 ["Donte Whitner"] draft [2006]
UPDATE player SET pff_player_id = 2953 WHERE pid = 'DONT-WHIT-025796' AND pff_player_id IS NULL;
-- jimmy williams (DB, draft 2006) <- PFF 2982 ["Jimmy Williams"] draft [2006] [contested name]
UPDATE player SET pff_player_id = 2982 WHERE pid = 'JAME-WILL-015338' AND pff_player_id IS NULL;
-- roman harper (DB, draft 2006) <- PFF 2988 ["Roman Harper"] draft [2006]
UPDATE player SET pff_player_id = 2988 WHERE pid = 'ROMA-HARP-026052' AND pff_player_id IS NULL;
-- rodney bailey (DL, draft 2001) <- PFF 906 ["Rodney Bailey"] draft [2001] [contested name]
UPDATE player SET pff_player_id = 906 WHERE pid = 'RODN-BAIL-019272' AND pff_player_id IS NULL;
-- chris johnson (DB, draft 2003) <- PFF 1539 ["Chris Johnson"] draft [2003] [contested name]
UPDATE player SET pff_player_id = 1539 WHERE pid = 'CHRI-JOHN-002930' AND pff_player_id IS NULL;
-- shaun smith (DL, draft 2004) <- PFF 1702 ["Shaun Smith"] draft [2003]
UPDATE player SET pff_player_id = 1702 WHERE pid = 'SHAU-SMIT-023722' AND pff_player_id IS NULL;
-- jr reed (DB, draft 2004) <- PFF 1850 ["J.R. Reed"] draft [2004] [contested name]
UPDATE player SET pff_player_id = 1850 WHERE pid = 'JRXX-REED-009784' AND pff_player_id IS NULL;
-- george wilson (DB, draft 2005) <- PFF 2210 ["George Wilson"] draft [2004] [contested name]
UPDATE player SET pff_player_id = 2210 WHERE pid = 'GEOR-WILS-012494' AND pff_player_id IS NULL;
-- travis johnson (DL, draft 2005) <- PFF 2233 ["Travis Johnson"] draft [2005] [contested name]
UPDATE player SET pff_player_id = 2233 WHERE pid = 'TRAV-JOHN-011316' AND pff_player_id IS NULL;
-- cj mosley (DL, draft 2005) <- PFF 2408 ["C.J. Mosley"] draft [2005] [contested name]
UPDATE player SET pff_player_id = 2408 WHERE pid = 'CJXX-MOSL-005565' AND pff_player_id IS NULL;
-- gabe watson (DL, draft 2006) <- PFF 3052 ["Gabe Watson"] draft [2006]
UPDATE player SET pff_player_id = 3052 WHERE pid = 'GABR-WATS-004628' AND pff_player_id IS NULL;
-- eric wright (DB, draft 2007) <- PFF 3669 ["Eric Wright"] draft [2007] [contested name]
UPDATE player SET pff_player_id = 3669 WHERE pid = 'ERIC-WRIG-011824' AND pff_player_id IS NULL;
-- charles johnson (DL, draft 2007) <- PFF 3699 ["Charles Johnson"] draft [2007] [contested name]
UPDATE player SET pff_player_id = 3699 WHERE pid = 'CHAR-JOHN-025793' AND pff_player_id IS NULL;
-- paul soliai (DL, draft 2007) <- PFF 3724 ["Paul Soliai"] draft [2007]
UPDATE player SET pff_player_id = 3724 WHERE pid = 'PAUL-SOLI-004296' AND pff_player_id IS NULL;
-- cj wilson (DB, draft 2007) <- PFF 3842 ["C.J. Wilson"] draft [2007] [contested name]
UPDATE player SET pff_player_id = 3842 WHERE pid = 'CJXX-WILS-002974' AND pff_player_id IS NULL;
-- michael adams (DB, draft 2007) <- PFF 4192 ["Michael Adams"] draft [2007] [contested name]
UPDATE player SET pff_player_id = 4192 WHERE pid = 'MICH-ADAM-005005' AND pff_player_id IS NULL;
-- vince wilfork (DL, draft 2004) <- PFF 1742 ["Vince Wilfork"] draft [2004]
UPDATE player SET pff_player_id = 1742 WHERE pid = 'VINC-WILF-027575' AND pff_player_id IS NULL;
-- david jones (DB, draft 2007) <- PFF 3761 ["David Jones"] draft [2007] [contested name]
UPDATE player SET pff_player_id = 3761 WHERE pid = 'DAVI-JONE-018415' AND pff_player_id IS NULL;
-- sione pouha (DL, draft 2005) <- PFF 2305 ["Sione Pouha"] draft [2005]
UPDATE player SET pff_player_id = 2305 WHERE pid = 'SION-POUH-027520' AND pff_player_id IS NULL;
-- byron westbrook (CB, draft 2007) <- PFF 4100 ["Byron Westbrook"] draft [2007] [contested name]
UPDATE player SET pff_player_id = 4100 WHERE pid = 'BYRO-WEST-002053' AND pff_player_id IS NULL;
-- tom nelson (DB, draft 2009) <- PFF 5345 ["Tom Nelson"] draft [2009]
UPDATE player SET pff_player_id = 5345 WHERE pid = 'TOMX-NELS-014770' AND pff_player_id IS NULL;
-- reggie walker (LB, draft 2009) <- PFF 5351 ["Reggie Walker"] draft [2009] [contested name]
UPDATE player SET pff_player_id = 5351 WHERE pid = 'REGG-WALK-016693' AND pff_player_id IS NULL;
-- brandon williams (DL, draft 2009) <- PFF 5044 ["Brandon Williams"] draft [2009] [contested name]
UPDATE player SET pff_player_id = 5044 WHERE pid = 'BRAN-WILL-004573' AND pff_player_id IS NULL;
-- ryan baker (DL, draft 2009) <- PFF 5316 ["Ryan Baker"] draft [2009] [contested name]
UPDATE player SET pff_player_id = 5316 WHERE pid = 'RYAN-BAKE-024804' AND pff_player_id IS NULL;
-- dan williams (DT, draft 2010) <- PFF 5551 ["Dan Williams"] draft [2010] [contested name]
UPDATE player SET pff_player_id = 5551 WHERE pid = 'DANX-WILL-027510' AND pff_player_id IS NULL;
-- major wright (DB, draft 2010) <- PFF 5600 ["Major Wright"] draft [2010]
UPDATE player SET pff_player_id = 5600 WHERE pid = 'MAJO-WRIG-024942' AND pff_player_id IS NULL;
-- kurt coleman (DB, draft 2010) <- PFF 5767 ["Kurt Coleman"] draft [2010]
UPDATE player SET pff_player_id = 5767 WHERE pid = 'KURT-COLE-026882' AND pff_player_id IS NULL;
-- kevin thomas (DB, draft 2010) <- PFF 5618 ["Kevin Thomas"] draft [2010] [contested name]
UPDATE player SET pff_player_id = 5618 WHERE pid = 'KEVI-THOM-020012' AND pff_player_id IS NULL;
-- brandon king (DB, draft 2010) <- PFF 5963 ["Brandon King"] draft [2010] [contested name]
UPDATE player SET pff_player_id = 5963 WHERE pid = 'BRAN-KING-019137' AND pff_player_id IS NULL;
-- josh thomas (DB, draft 2011) <- PFF 6295 ["Josh Thomas"] draft [2011] [contested name]
UPDATE player SET pff_player_id = 6295 WHERE pid = 'JOSH-THOM-003408' AND pff_player_id IS NULL;
-- chris harris (DB, draft 2011) <- PFF 6457 ["Chris Harris Jr."] draft [2011] [contested name]
UPDATE player SET pff_player_id = 6457 WHERE pid = 'CHRI-HARR-002727' AND pff_player_id IS NULL;
-- chris white (LB, draft 2011) <- PFF 6321 ["Chris White"] draft [2011] [contested name]
UPDATE player SET pff_player_id = 6321 WHERE pid = 'CHRI-WHIT-027767' AND pff_player_id IS NULL;
-- charles mitchell (DB, draft 2012) <- PFF 7180 ["Charles Mitchell"] draft [2012] [contested name]
UPDATE player SET pff_player_id = 7180 WHERE pid = 'CHAR-MITC-026775' AND pff_player_id IS NULL;
-- steven johnson (LB, draft 2012) <- PFF 7298 ["Steven Johnson"] draft [2012] [contested name]
UPDATE player SET pff_player_id = 7298 WHERE pid = 'STEV-JOHN-027872' AND pff_player_id IS NULL;
-- omar brown (DB, draft 2012) <- PFF 7503 ["Omar Brown"] draft [2012] [contested name]
UPDATE player SET pff_player_id = 7503 WHERE pid = 'OMAR-BROW-013604' AND pff_player_id IS NULL;
-- alameda taamu (DL, draft 2012) <- PFF 7109 ["Alameda Ta'amu"] draft [2012]
UPDATE player SET pff_player_id = 7109 WHERE pid = 'ALAM-TAAM-006175' AND pff_player_id IS NULL;
-- michael thomas (DB, draft 2012) <- PFF 7279 ["Michael Thomas"] draft [2012] [contested name]
UPDATE player SET pff_player_id = 7279 WHERE pid = 'MICH-THOM-008276' AND pff_player_id IS NULL;
-- cj wilson (DB, draft 2013) <- PFF 8327 ["C.J. Wilson"] draft [2013] [contested name]
UPDATE player SET pff_player_id = 8327 WHERE pid = 'CJXX-WILS-016008' AND pff_player_id IS NULL;
-- marcus williams (DB, draft 2014) <- PFF 9115 ["Marcus Williams"] draft [2014] [contested name]
UPDATE player SET pff_player_id = 9115 WHERE pid = 'MARC-WILL-000076' AND pff_player_id IS NULL;
-- nikita whitlock (RB, draft 2014) <- PFF 8994 ["Nikita Whitlock"] draft [2014]
UPDATE player SET pff_player_id = 8994 WHERE pid = 'NIKI-WHIT-001418' AND pff_player_id IS NULL;
-- anthony harris (DB, draft 2015) <- PFF 9895 ["Anthony Harris"] draft [2015] [contested name]
UPDATE player SET pff_player_id = 9895 WHERE pid = 'ANTH-HARR-027364' AND pff_player_id IS NULL;
-- william jackson (DB, draft 2016) <- PFF 10658 ["William Jackson III"] draft [2016] [contested name]
UPDATE player SET pff_player_id = 10658 WHERE pid = 'WILL-JACK-005662' AND pff_player_id IS NULL;
-- ryan smith (DB, draft 2016) <- PFF 10742 ["Ryan Smith"] draft [2016] [contested name]
UPDATE player SET pff_player_id = 10742 WHERE pid = 'RYAN-SMIT-003206' AND pff_player_id IS NULL;
-- eddie jackson (DB, draft 2017) <- PFF 11867 ["Eddie Jackson"] draft [2017] [contested name]
UPDATE player SET pff_player_id = 11867 WHERE pid = 'EDDI-JACK-026332' AND pff_player_id IS NULL;
-- leighton vander esch (LB, draft 2018) <- PFF 50950 ["Leighton Vander Esch"] draft [2018]
UPDATE player SET pff_player_id = 50950 WHERE pid = 'LEIG-VAND-027515' AND pff_player_id IS NULL;
-- antoine winfield (DB, draft 2020) <- PFF 42475 ["Antoine Winfield Jr."] draft [2020] [contested name]
UPDATE player SET pff_player_id = 42475 WHERE pid = 'ANTO-WINF-025711' AND pff_player_id IS NULL;
-- jr reed (DB, draft 2020) <- PFF 38339 ["J.R. Reed"] draft [2020] [contested name]
UPDATE player SET pff_player_id = 38339 WHERE pid = 'JRXX-REED-027458' AND pff_player_id IS NULL;
-- jaylon carlies (S, draft 2024) <- PFF 124196 ["Jaylon Carlies"] draft [2024]
UPDATE player SET pff_player_id = 124196 WHERE pid = 'JAYL-CARL-004544' AND pff_player_id IS NULL;
-- james williams (S, draft 2024) <- PFF 143955 ["James Williams"] draft [2024] [contested name]
UPDATE player SET pff_player_id = 143955 WHERE pid = 'JAME-WILL-003586' AND pff_player_id IS NULL;
-- travis johnson (DE, draft 2013) <- PFF 8404 ["Travis Johnson"] draft [2013] [contested name]
UPDATE player SET pff_player_id = 8404 WHERE pid = 'TRAV-JOHN-024810' AND pff_player_id IS NULL;
-- jonathan brown (LB, draft 2014) <- PFF 9085 ["Jonathan Brown"] draft [2014] [contested name]
UPDATE player SET pff_player_id = 9085 WHERE pid = 'JONA-BROW-012859' AND pff_player_id IS NULL;
-- joe williams (RB, draft 2017) <- PFF 11876 ["Joe Williams"] draft [2017] [contested name]
UPDATE player SET pff_player_id = 11876 WHERE pid = 'JOEX-WILL-016058' AND pff_player_id IS NULL;
-- josh watson (DL, draft 2015) <- PFF 9790 ["Josh Watson"] draft [2015] [contested name]
UPDATE player SET pff_player_id = 9790 WHERE pid = 'JOSH-WATS-003069' AND pff_player_id IS NULL;
-- mike rose (DL, draft 2016) <- PFF 11252 ["Mike Rose"] draft [2016] [contested name]
UPDATE player SET pff_player_id = 11252 WHERE pid = 'MIKE-ROSE-003617' AND pff_player_id IS NULL;
-- anthony sarao (LB, draft 2016) <- PFF 10919 ["Anthony Sarao"] draft [2016]
UPDATE player SET pff_player_id = 10919 WHERE pid = 'ANTH-SARA-000750' AND pff_player_id IS NULL;
-- gerald dixon (DL, draft 2016) <- PFF 11038 ["Gerald Dixon Jr."] draft [2016] [contested name]
UPDATE player SET pff_player_id = 11038 WHERE pid = 'GERA-DIXO-015626' AND pff_player_id IS NULL;
-- will ratelle (LB, draft 2016) <- PFF 11053 ["Will Ratelle"] draft [2016]
UPDATE player SET pff_player_id = 11053 WHERE pid = 'WILL-RATE-003850' AND pff_player_id IS NULL;
-- jabriel washington (DB, draft 2016) <- PFF 11365 ["Jabriel Washington"] draft [2016]
UPDATE player SET pff_player_id = 11365 WHERE pid = 'JABR-WASH-012384' AND pff_player_id IS NULL;
-- jarron jones (DL, draft 2017) <- PFF 12235 ["Jarron Jones"] draft [2017]
UPDATE player SET pff_player_id = 12235 WHERE pid = 'JARR-JONE-017236' AND pff_player_id IS NULL;
-- darrius sims (RB, draft 2017) <- PFF 25021 ["Darrius Sims"] draft [2017]
UPDATE player SET pff_player_id = 25021 WHERE pid = 'DARR-SIMS-020089' AND pff_player_id IS NULL;
-- mason gentry (DL, draft 2018) <- PFF 48864 ["Mason Gentry"] draft [2018]
UPDATE player SET pff_player_id = 48864 WHERE pid = 'MASO-GENT-017205' AND pff_player_id IS NULL;
-- kyle queiro (DB, draft 2018) <- PFF 49064 ["Kyle Queiro"] draft [2018]
UPDATE player SET pff_player_id = 49064 WHERE pid = 'KYLE-QUEI-011210' AND pff_player_id IS NULL;
-- david jones (DB, draft 2017) <- PFF 49298 ["David Jones"] draft [2017] [contested name]
UPDATE player SET pff_player_id = 49298 WHERE pid = 'DAVI-JONE-006003' AND pff_player_id IS NULL;
-- asantay brown (DB, draft 2018) <- PFF 49729 ["Asantay Brown"] draft [2018]
UPDATE player SET pff_player_id = 49729 WHERE pid = 'ASAN-BROW-016064' AND pff_player_id IS NULL;
-- william ossai (LB, draft 2018) <- PFF 50773 ["William Ossai"] draft [2018]
UPDATE player SET pff_player_id = 50773 WHERE pid = 'WILL-OSSA-005325' AND pff_player_id IS NULL;
-- derrick moncrief (LB, draft 2020) <- PFF 51296 ["Derrick Moncrief"] draft [2020]
UPDATE player SET pff_player_id = 51296 WHERE pid = 'DERR-MONC-002296' AND pff_player_id IS NULL;
-- chris miller (DB, draft 2020) <- PFF 25686 ["Chris Miller"] draft [2020]
UPDATE player SET pff_player_id = 25686 WHERE pid = 'CHRI-MILL-016300' AND pff_player_id IS NULL;
-- james folston (LB, draft 2019) <- PFF 48532 ["James Folston Jr."] draft [2019] [contested name]
UPDATE player SET pff_player_id = 48532 WHERE pid = 'JAME-FOLS-026823' AND pff_player_id IS NULL;
-- kyle wilson (LB, draft 2018) <- PFF 50923 ["Kyle Wilson"] draft [2018] [contested name]
UPDATE player SET pff_player_id = 50923 WHERE pid = 'KYLE-WILS-005355' AND pff_player_id IS NULL;
-- skyler thomas (DB, draft 2022) <- PFF 43418 ["Skyler Thomas"] draft [2022]
UPDATE player SET pff_player_id = 43418 WHERE pid = 'SKYL-THOM-023774' AND pff_player_id IS NULL;
-- elijah ponder (DL, draft 2021) <- PFF 43743 ["Elijah Ponder"] draft [2021] [contested name]
UPDATE player SET pff_player_id = 43743 WHERE pid = 'ELIJ-POND-016285' AND pff_player_id IS NULL;
-- jordan williams (DT, draft 2022) <- PFF 56968 ["Jordan Williams"] draft [2022] [contested name]
UPDATE player SET pff_player_id = 56968 WHERE pid = 'JORD-WILL-021831' AND pff_player_id IS NULL;
-- isaiah pryor (DB, draft 2022) <- PFF 60724 ["Isaiah Pryor"] draft [2022]
UPDATE player SET pff_player_id = 60724 WHERE pid = 'ISAI-PRYO-009246' AND pff_player_id IS NULL;
-- jaiden woodbey (S, draft 2023) <- PFF 76624 ["Jaiden Woodbey"] draft [2023]
UPDATE player SET pff_player_id = 76624 WHERE pid = 'JAID-WOOD-007653' AND pff_player_id IS NULL;
-- mike rose (LB, draft 2022) <- PFF 77218 ["Mike Rose"] draft [2022] [contested name]
UPDATE player SET pff_player_id = 77218 WHERE pid = 'MIKE-ROSE-025633' AND pff_player_id IS NULL;
-- lawrence johnson (S, draft 2024) <- PFF 79055 ["Lawrence Johnson"] draft [2024] [contested name]
UPDATE player SET pff_player_id = 79055 WHERE pid = 'LAWR-JOHN-022134' AND pff_player_id IS NULL;
-- paul moala (DB, draft 2024) <- PFF 83346 ["Paul Moala"] draft [2024]
UPDATE player SET pff_player_id = 83346 WHERE pid = 'PAUL-MOAL-001543' AND pff_player_id IS NULL;
-- christian young (S, draft 2023) <- PFF 83827 ["Christian Young"] draft [2023]
UPDATE player SET pff_player_id = 83827 WHERE pid = 'CHRI-YOUN-004298' AND pff_player_id IS NULL;
-- dj daniel (DB, draft 2021) <- PFF 98878 ["DJ Daniel"] draft [2021]
UPDATE player SET pff_player_id = 98878 WHERE pid = 'DJXX-DANI-020416' AND pff_player_id IS NULL;
-- caleb johnson (LB, draft 2023) <- PFF 98635 ["Caleb Johnson"] draft [2023] [contested name]
UPDATE player SET pff_player_id = 98635 WHERE pid = 'CALE-JOHN-000167' AND pff_player_id IS NULL;
-- robert kennedy (DB, draft 2024) <- PFF 145371 ["Robert Kennedy III"] draft [2024] [contested name]
UPDATE player SET pff_player_id = 145371 WHERE pid = 'ROBE-KENN-001356' AND pff_player_id IS NULL;
-- chris johnson (DB, draft 2019) <- PFF 91420 ["Chris Johnson"] draft [2019] [contested name]
UPDATE player SET pff_player_id = 91420 WHERE pid = 'CHRI-JOHN-027419' AND pff_player_id IS NULL;
-- robert pollard (DL, draft 2004) <- PFF 2153 ["Robert Pollard"] draft [2004] [contested name]
UPDATE player SET pff_player_id = 2153 WHERE pid = 'ROBE-POLL-014080' AND pff_player_id IS NULL;
-- charles bennett (DL, draft 2006) <- PFF 3186 ["Charles Bennett"] draft [2006] [contested name]
UPDATE player SET pff_player_id = 3186 WHERE pid = 'CHAR-BENN-011716' AND pff_player_id IS NULL;
-- jordan miller (DL, draft 2011) <- PFF 6568 ["Jordan Miller"] draft [2011] [contested name]
UPDATE player SET pff_player_id = 6568 WHERE pid = 'JORD-MILL-004592' AND pff_player_id IS NULL;
-- michael brooks (DL, draft 2013) <- PFF 8145 ["Michael Brooks"] draft [2013] [contested name]
UPDATE player SET pff_player_id = 8145 WHERE pid = 'MICH-BROO-013421' AND pff_player_id IS NULL;
-- keith browner (DL, draft 2012) <- PFF 7614 ["Keith Browner"] draft [2012] [contested name]
UPDATE player SET pff_player_id = 7614 WHERE pid = 'KEIT-BROW-002348' AND pff_player_id IS NULL;
-- will johnson (FB, draft 2012) <- PFF 7639 ["Will Johnson"] draft [2012] [contested name]
UPDATE player SET pff_player_id = 7639 WHERE pid = 'WILL-JOHN-016794' AND pff_player_id IS NULL;
-- daniel munyer (OL, draft 2015) <- PFF 10174 ["Daniel Munyer"] draft [2015]
UPDATE player SET pff_player_id = 10174 WHERE pid = 'DANI-MUNY-003697' AND pff_player_id IS NULL;
-- chris smith (DL, draft 2023) <- PFF 106524 ["Chris Smith"] draft [2023] [contested name]
UPDATE player SET pff_player_id = 106524 WHERE pid = 'CHRI-SMIT-000226' AND pff_player_id IS NULL;
-- jordan phillips (DT, draft 2025) <- PFF 157619 ["Jordan Phillips"] draft [2025] [contested name]
UPDATE player SET pff_player_id = 157619 WHERE pid = 'JORD-PHIL-004603' AND pff_player_id IS NULL;
-- andrew williams (DL, draft 2019) <- PFF 48620 ["Andrew Williams"] draft [2019] [contested name]
UPDATE player SET pff_player_id = 48620 WHERE pid = 'ANDR-WILL-005173' AND pff_player_id IS NULL;
-- bill murray (DL, draft 2020) <- PFF 48692 ["Bill Murray"] draft [2020]
UPDATE player SET pff_player_id = 48692 WHERE pid = 'BILL-MURR-002699' AND pff_player_id IS NULL;
-- mike panasiuk (DL, draft 2020) <- PFF 48824 ["Mike Panasiuk"] draft [2020]
UPDATE player SET pff_player_id = 48824 WHERE pid = 'MIKE-PANA-017882' AND pff_player_id IS NULL;
-- jordan miller (DT, draft 2024) <- PFF 76890 ["Jordan Miller"] draft [2024] [contested name]
UPDATE player SET pff_player_id = 76890 WHERE pid = 'JORD-MILL-016629' AND pff_player_id IS NULL;
-- justin rogers (DT, draft 2024) <- PFF 124076 ["Justin Rogers"] draft [2024] [contested name]
UPDATE player SET pff_player_id = 124076 WHERE pid = 'JUST-ROGE-016481' AND pff_player_id IS NULL;
-- aaron smith (LB, draft 2025) <- PFF 142779 ["Aaron Smith"] draft [2025] [contested name]
UPDATE player SET pff_player_id = 142779 WHERE pid = 'AARO-SMIT-027947' AND pff_player_id IS NULL;
-- tyrell sutton (RB, draft 2009) <- PFF 5395 ["Tyrell Sutton"] draft [2009]
UPDATE player SET pff_player_id = 5395 WHERE pid = 'TYRE-SUTT-014585' AND pff_player_id IS NULL;
-- chris harper (WR, draft 2013) <- PFF 7905 ["Chris Harper"] draft [2013] [contested name]
UPDATE player SET pff_player_id = 7905 WHERE pid = 'CHRI-HARP-002592' AND pff_player_id IS NULL;
-- ryan groy (OL, draft 2014) <- PFF 9221 ["Ryan Groy"] draft [2014]
UPDATE player SET pff_player_id = 9221 WHERE pid = 'RYAN-GROY-025706' AND pff_player_id IS NULL;
-- henry pearson (TE, draft 2023) <- PFF 83930 ["Henry Pearson"] draft [2023]
UPDATE player SET pff_player_id = 83930 WHERE pid = 'HENR-PEAR-015776' AND pff_player_id IS NULL;
-- dee williams (WR, draft 2024) <- PFF 157609 ["Dee Williams"] draft [2024]
UPDATE player SET pff_player_id = 157609 WHERE pid = 'DEEX-WILL-026101' AND pff_player_id IS NULL;
-- kabion ento (WR, draft 2019) <- PFF 26015 ["Kabion Ento"] draft [2019]
UPDATE player SET pff_player_id = 26015 WHERE pid = 'KABI-ENTO-027347' AND pff_player_id IS NULL;
-- johnny robinson (DL, draft 2019) <- PFF 36434 ["Johnny Robinson"] draft [2019] [contested name]
UPDATE player SET pff_player_id = 36434 WHERE pid = 'JOHN-ROBI-014372' AND pff_player_id IS NULL;
-- derrick dillon (WR, draft 2020) <- PFF 34886 ["Derrick Dillon"] draft [2020]
UPDATE player SET pff_player_id = 34886 WHERE pid = 'DERR-DILL-026303' AND pff_player_id IS NULL;
-- michael wiley (RB, draft 2024) <- PFF 98617 ["Michael Wiley"] draft [2024] [contested name]
UPDATE player SET pff_player_id = 98617 WHERE pid = 'MICH-WILE-006804' AND pff_player_id IS NULL;
-- alex henery (K, draft 2011) <- PFF 6272 ["Alex Henery"] draft [2011]
UPDATE player SET pff_player_id = 6272 WHERE pid = 'ALEX-HENE-027560' AND pff_player_id IS NULL;
-- kaare vedvik (K, draft 2018) <- PFF 28782 ["Kaare Vedvik"] draft [2018]
UPDATE player SET pff_player_id = 28782 WHERE pid = 'KAAR-VEDV-027989' AND pff_player_id IS NULL;
-- brandon wright (P, draft 2020) <- PFF 13421 ["Brandon Wright"] draft [2020]
UPDATE player SET pff_player_id = 13421 WHERE pid = 'BRAN-WRIG-027986' AND pff_player_id IS NULL;
-- ryan santoso (K, draft 2018) <- PFF 26245 ["Ryan Santoso"] draft [2018]
UPDATE player SET pff_player_id = 26245 WHERE pid = 'RYAN-SANT-005641' AND pff_player_id IS NULL;
-- kenny allen (K, draft 2017) <- PFF 12089 ["Kenny Allen"] draft [2017]
UPDATE player SET pff_player_id = 12089 WHERE pid = 'KENN-ALLE-007471' AND pff_player_id IS NULL;
-- david marvin (P, draft 2018) <- PFF 27939 ["David Marvin"] draft [2018]
UPDATE player SET pff_player_id = 27939 WHERE pid = 'DAVI-MARV-025176' AND pff_player_id IS NULL;
-- erick wren (OL, draft 2018) <- PFF 32654 ["Erick Wren"] draft [2018]
UPDATE player SET pff_player_id = 32654 WHERE pid = 'ERIC-WREN-003084' AND pff_player_id IS NULL;
-- levi jones (T, draft 2002) <- PFF 1018 ["Levi Jones"] draft [2002] [contested name]
UPDATE player SET pff_player_id = 1018 WHERE pid = 'LEVI-JONE-001432' AND pff_player_id IS NULL;
-- mark clayton (WR, draft 2005) <- PFF 2239 ["Mark Clayton"] draft [2005] [contested name]
UPDATE player SET pff_player_id = 2239 WHERE pid = 'MARK-CLAY-016422' AND pff_player_id IS NULL;
-- andre davis (WR, draft 2002) <- PFF 1054 ["Andre' Davis"] draft [2002] [contested name]
UPDATE player SET pff_player_id = 1054 WHERE pid = 'ANDR-DAVI-016867' AND pff_player_id IS NULL;
-- jon runyan (OL, draft 1996) <- PFF 193 ["Jon Runyan Sr."] draft [1996] [contested name]
UPDATE player SET pff_player_id = 193 WHERE pid = 'JONX-RUNY-008866' AND pff_player_id IS NULL;
-- marion barber (RB, draft 2005) <- PFF 2326 ["Marion Barber III"] draft [2005] [contested name]
UPDATE player SET pff_player_id = 2326 WHERE pid = 'MARI-BARB-009997' AND pff_player_id IS NULL;
-- marvin harrison (WR, draft 1996) <- PFF 162 ["Marvin Harrison"] draft [1996] [contested name]
UPDATE player SET pff_player_id = 162 WHERE pid = 'MARV-HARR-016908' AND pff_player_id IS NULL;
-- adrian peterson (RB, draft 2002) <- PFF 1177 ["Adrian Peterson"] draft [2002] [contested name]
UPDATE player SET pff_player_id = 1177 WHERE pid = 'ADRI-PETE-016659' AND pff_player_id IS NULL;
-- darrell williams (T, draft 2015) <- PFF 9917 ["Darrell Williams"] draft [2015] [contested name]
UPDATE player SET pff_player_id = 9917 WHERE pid = 'DARR-WILL-020095' AND pff_player_id IS NULL;
-- kyle murphy (OL, draft 2016) <- PFF 10834 ["Kyle Murphy"] draft [2016] [contested name]
UPDATE player SET pff_player_id = 10834 WHERE pid = 'KYLE-MURP-005515' AND pff_player_id IS NULL;
-- blake mack (TE, draft 2018) <- PFF 47171 ["Blake Mack"] draft [2018]
UPDATE player SET pff_player_id = 47171 WHERE pid = 'BLAK-MACK-010263' AND pff_player_id IS NULL;
-- darrell williams (OL, draft 2017) <- PFF 12285 ["Darrell Williams"] draft [2017] [contested name]
UPDATE player SET pff_player_id = 12285 WHERE pid = 'DARR-WILL-027297' AND pff_player_id IS NULL;
-- connor mcgovern (OL, draft 2016) <- PFF 10778 ["Connor McGovern"] draft [2016] [contested name]
UPDATE player SET pff_player_id = 10778 WHERE pid = 'CONN-MCGO-025581' AND pff_player_id IS NULL;
-- cedrick lang (TE, draft 2016) <- PFF 11244 ["Cedrick Lang"] draft [2016]
UPDATE player SET pff_player_id = 11244 WHERE pid = 'CEDR-LANG-005044' AND pff_player_id IS NULL;
-- chris bazile (TE, draft 2018) <- PFF 19754 ["Chris Bazile"] draft [2017]
UPDATE player SET pff_player_id = 19754 WHERE pid = 'CHRI-BAZI-002569' AND pff_player_id IS NULL;
-- bryce bobo (WR, draft 2018) <- PFF 48271 ["Bryce Bobo"] draft [2018]
UPDATE player SET pff_player_id = 48271 WHERE pid = 'BRYC-BOBO-019791' AND pff_player_id IS NULL;
-- nate wozniak (TE, draft 2018) <- PFF 44891 ["Nate Wozniak"] draft [2018]
UPDATE player SET pff_player_id = 44891 WHERE pid = 'NATE-WOZN-015726' AND pff_player_id IS NULL;
-- zach miller (TE, draft 2009) <- PFF 5104 ["Zach Miller"] draft [2009] [contested name]
UPDATE player SET pff_player_id = 5104 WHERE pid = 'ZACH-MILL-025071' AND pff_player_id IS NULL;
-- zach conque (QB, draft 2017) <- PFF 39739 ["Zach Conque"] draft [2017]
UPDATE player SET pff_player_id = 39739 WHERE pid = 'ZACH-CONQ-007143' AND pff_player_id IS NULL;
-- josh harris (OL, draft 2012) <- PFF 7748 ["Josh Harris"] draft [2012] [contested name]
UPDATE player SET pff_player_id = 7748 WHERE pid = 'JOSH-HARR-000132' AND pff_player_id IS NULL;
-- jerry rice (WR, draft 1985) <- PFF 1 ["Jerry Rice"] draft [1985] [contested name]
UPDATE player SET pff_player_id = 1 WHERE pid = 'JERR-RICE-026768' AND pff_player_id IS NULL;
-- mike williams (WR, draft 2005) <- PFF 2227 ["Mike Williams"] draft [2005] [contested name]
UPDATE player SET pff_player_id = 2227 WHERE pid = 'MIKE-WILL-009339' AND pff_player_id IS NULL;
-- anthony davis (OL, draft 2010) <- PFF 5536 ["Anthony Davis"] draft [2010] [contested name]
UPDATE player SET pff_player_id = 5536 WHERE pid = 'ANTH-DAVI-026536' AND pff_player_id IS NULL;
-- mickey shuler (TE, draft 2010) <- PFF 5737 ["Mickey Shuler"] draft [2010] [contested name]
UPDATE player SET pff_player_id = 5737 WHERE pid = 'MICK-SHUL-020016' AND pff_player_id IS NULL;
-- tyrone wheatley (RB, draft 1995) <- PFF 136206 ["Tyrone Wheatley"] draft [1995] [contested name]
UPDATE player SET pff_player_id = 136206 WHERE pid = 'TYRO-WHEA-001076' AND pff_player_id IS NULL;
-- donovan raiola (OL, draft 2006) <- PFF 3474 ["Donovan Raiola"] draft [2006]
UPDATE player SET pff_player_id = 3474 WHERE pid = 'DONO-RAIO-020349' AND pff_player_id IS NULL;
-- robert jones (OL, draft 2021) <- PFF 100786 ["Robert Jones"] draft [2021] [contested name]
UPDATE player SET pff_player_id = 100786 WHERE pid = 'ROBE-JONE-026073' AND pff_player_id IS NULL;
-- kyle murphy (OL, draft 2020) <- PFF 40285 ["Kyle Murphy"] draft [2020] [contested name]
UPDATE player SET pff_player_id = 40285 WHERE pid = 'KYLE-MURP-026509' AND pff_player_id IS NULL;
-- daniel crawford (TE, draft 2021) <- PFF 27822 ["Daniel Crawford"] draft [2021]
UPDATE player SET pff_player_id = 27822 WHERE pid = 'DANI-CRAW-020033' AND pff_player_id IS NULL;
-- josh baker (TE, draft 2011) <- PFF 6514 ["Josh Baker"] draft [2011]
UPDATE player SET pff_player_id = 6514 WHERE pid = 'JOSH-BAKE-000717' AND pff_player_id IS NULL;
-- willie smith (OL, draft 2011) <- PFF 6439 ["Willie Smith"] draft [2011] [contested name]
UPDATE player SET pff_player_id = 6439 WHERE pid = 'WILL-SMIT-027357' AND pff_player_id IS NULL;
-- quinn porter (RB, draft 2011) <- PFF 5941 ["Quinn Porter"] draft [2010]
UPDATE player SET pff_player_id = 5941 WHERE pid = 'QUIN-PORT-023048' AND pff_player_id IS NULL;
-- jeremiah hall (TE, draft 2022) <- PFF 57083 ["Jeremiah Hall"] draft [2022]
UPDATE player SET pff_player_id = 57083 WHERE pid = 'JERE-HALL-024848' AND pff_player_id IS NULL;
-- jerrion ealy (RB, draft 2022) <- PFF 97163 ["Jerrion Ealy"] draft [2022]
UPDATE player SET pff_player_id = 97163 WHERE pid = 'JERR-EALY-025512' AND pff_player_id IS NULL;
-- rodney williams (WR, draft 2022) <- PFF 63718 ["Rodney Williams"] draft [2022] [contested name]
UPDATE player SET pff_player_id = 63718 WHERE pid = 'RODN-WILL-006731' AND pff_player_id IS NULL;
-- izaiah gathings (WR, draft 2023) <- PFF 89497 ["Izaiah Gathings"] draft [2023]
UPDATE player SET pff_player_id = 89497 WHERE pid = 'IZAI-GATH-000289' AND pff_player_id IS NULL;
-- griffin hebert (WR, draft 2023) <- PFF 61382 ["Griffin Hebert"] draft [2023]
UPDATE player SET pff_player_id = 61382 WHERE pid = 'GRIF-HEBE-000948' AND pff_player_id IS NULL;
-- james brown (G, draft 2012) <- PFF 7717 ["James Brown"] draft [2012] [contested name]
UPDATE player SET pff_player_id = 7717 WHERE pid = 'JAME-BROW-021331' AND pff_player_id IS NULL;
-- qadir ismail (WR, draft 2024) <- PFF 78521 ["Qadir Ismail"] draft [2024]
UPDATE player SET pff_player_id = 78521 WHERE pid = 'QADI-ISMA-000971' AND pff_player_id IS NULL;
-- tyler smith (OL, draft 2024) <- PFF 89384 ["Tyler Smith"] draft [2024] [contested name]
UPDATE player SET pff_player_id = 89384 WHERE pid = 'TYLE-SMIT-001378' AND pff_player_id IS NULL;
-- dennis johnson (RB, draft 2013) <- PFF 8070 ["Dennis Johnson"] draft [2013] [contested name]
UPDATE player SET pff_player_id = 8070 WHERE pid = 'DENN-JOHN-012080' AND pff_player_id IS NULL;
-- jon dorenbos (OL, draft 2003) <- PFF 1600 ["Jon Dorenbos"] draft [2003]
UPDATE player SET pff_player_id = 1600 WHERE pid = 'JONX-DORE-008543' AND pff_player_id IS NULL;
-- christian yount (OL, draft 2011) <- PFF 6527 ["Christian Yount"] draft [2011]
UPDATE player SET pff_player_id = 6527 WHERE pid = 'CHRI-YOUN-017866' AND pff_player_id IS NULL;
-- james wilder (RB, draft 2014) <- PFF 9328 ["James Wilder Jr."] draft [2014] [contested name]
UPDATE player SET pff_player_id = 9328 WHERE pid = 'JAME-WILD-000831' AND pff_player_id IS NULL;
-- jordan lynch (QB, draft 2014) <- PFF 9199 ["Jordan Lynch"] draft [2014]
UPDATE player SET pff_player_id = 9199 WHERE pid = 'JORD-LYNC-021705' AND pff_player_id IS NULL;
-- ray hamilton (TE, draft 2015) <- PFF 9845 ["Ray Hamilton"] draft [2015] [contested name]
UPDATE player SET pff_player_id = 9845 WHERE pid = 'RAYX-HAMI-017059' AND pff_player_id IS NULL;
-- joe horn (WR, draft 1996) <- PFF 199 ["Joe Horn"] draft [1996] [contested name]
UPDATE player SET pff_player_id = 199 WHERE pid = 'JOEX-HORN-009713' AND pff_player_id IS NULL;
-- larry allen (OL, draft 1994) <- PFF 84 ["Larry Allen"] draft [1994] [contested name]
UPDATE player SET pff_player_id = 84 WHERE pid = 'LARR-ALLE-006629' AND pff_player_id IS NULL;
-- cedrick wilson (WR, draft 2001) <- PFF 901 ["Cedrick Wilson"] draft [2001] [contested name]
UPDATE player SET pff_player_id = 901 WHERE pid = 'CEDR-WILS-017719' AND pff_player_id IS NULL;
-- andrew bonnet (RB, draft 2016) <- PFF 11006 ["Andrew Bonnet"] draft [2016]
UPDATE player SET pff_player_id = 11006 WHERE pid = 'ANDR-BONN-010526' AND pff_player_id IS NULL;
-- aaron taylor (G, draft 1994) <- PFF 11558 ["Aaron Taylor"] draft [1994] [contested name]
UPDATE player SET pff_player_id = 11558 WHERE pid = 'AARO-TAYL-016561' AND pff_player_id IS NULL;
-- keith byars (FB, draft 1986) <- PFF 11559 ["Keith Byars"] draft [1986]
UPDATE player SET pff_player_id = 11559 WHERE pid = 'KEIT-BYAR-011881' AND pff_player_id IS NULL;
-- charles johnson (WR, draft 1994) <- PFF 11734 ["Charles Johnson"] draft [1994] [contested name]
UPDATE player SET pff_player_id = 11734 WHERE pid = 'CHAR-JOHN-017753' AND pff_player_id IS NULL;
-- jacob huesman (QB, draft 2016) <- PFF 11514 ["Jacob Huesman"] draft [2016]
UPDATE player SET pff_player_id = 11514 WHERE pid = 'JACO-HUES-001209' AND pff_player_id IS NULL;
-- jeremy cain (LB, draft 2004) <- PFF 2001 ["Jeremy Cain"] draft [2004]
UPDATE player SET pff_player_id = 2001 WHERE pid = 'JERE-CAIN-006431' AND pff_player_id IS NULL;
-- sam paulescu (K, draft 2007) <- PFF 4300 ["Sam Paulescu"] draft [2007]
UPDATE player SET pff_player_id = 4300 WHERE pid = 'SAMX-PAUL-023617' AND pff_player_id IS NULL;
-- james smith (K, draft 2021) <- PFF 55085 ["James Smith"] draft [2021] [contested name]
UPDATE player SET pff_player_id = 55085 WHERE pid = 'JAME-SMIT-006230' AND pff_player_id IS NULL;
-- chas henry (K, draft 2011) <- PFF 6610 ["Chas Henry"] draft [2011]
UPDATE player SET pff_player_id = 6610 WHERE pid = 'CHAS-HENR-015253' AND pff_player_id IS NULL;
-- kip smith (K, draft 2015) <- PFF 9785 ["Kip Smith"] draft [2015]
UPDATE player SET pff_player_id = 9785 WHERE pid = 'KIPX-SMIT-007498' AND pff_player_id IS NULL;
-- justin manton (K, draft 2015) <- PFF 9865 ["Justin Manton"] draft [2015]
UPDATE player SET pff_player_id = 9865 WHERE pid = 'JUST-MANT-024905' AND pff_player_id IS NULL;
-- sam irwin-hill (K, draft 2017) <- PFF 12072 ["Sam Irwin-Hill"] draft [2017]
UPDATE player SET pff_player_id = 12072 WHERE pid = 'SAMX-IRWI-023616' AND pff_player_id IS NULL;
