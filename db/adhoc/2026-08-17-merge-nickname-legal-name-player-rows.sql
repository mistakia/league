-- STATUS: APPLIED 2026-08-18 against league_production
--
-- Nickname/legal-name duplicate-player cleanup. 77 merges out of 77 findings.
--
-- Surfaced by the registered check `nickname-legal-name-duplicate-rows`
-- (signal 125616), which on the 2026-08-17 re-pull returned 82 pairs: five
-- already parked as adjudicated two-person pairs in db/checks/parked.json
-- (RICH/RONA Saul, RALE/REGI McKenzie, HARO/HERB Shoener, Colton/Dylan
-- Taylor, Josh/Tyler Johnson), and the 77 pairs merged here, every one the
-- same person holding two `player` rows that spell the first name
-- differently (nickname vs legal name). The check's repair command is
-- followed: a shared draft_overall_pick within the anchor group is the
-- strongest same-person evidence; a shared birth date is NOT evidence by
-- itself; the 77 pairs were each adjudicated before being merged.
--
-- THIS CLASS IS HARDER TO MERGE THAN THE SIBLING `duplicate-person-rows`
-- ONE. There the donor is always a shell holding no identifier and no
-- gamelog, so a wrong merge costs little. Here BOTH rows routinely carry
-- identifiers and gamelogs, so the round-5 file's zero-identifier donor
-- assertion is REMOVED and the round-2 gamelog rescue (step 4) is added.
-- Every identifier the donor holds is preserved in player_changelog (step 2)
-- and filled onto the survivor only where the survivor lacks one (step 9,
-- additive coalesce). The check's own identifier veto guarantees no pair
-- holds two DIFFERENT values of one identifier; step 0 re-asserts that.
--
-- Survivor rule (unchanged from rounds 2-5): most dependent rows, then most
-- external identifiers, then lower serial. TWO NAME-CORRECTNESS OVERRIDES
-- keep a factually-wrong donor name off the surviving row:
--   KEVI-WALK-016093 "kevin walker" -> KENY-WALK-005337 "kenyatta walker"
--     The gsis id 00-0020493 on the "kevin" row is Kenyatta Walker's (Florida
--     OT, drafted 14th overall 2001); "Kevin Walker" is a corruption. The
--     shared draft_overall_pick 14 and shared birth date 1979-02-01 settle the
--     identity; the survivor is the correctly-named row despite fewer
--     dependents.
--   DARR-OVER-007542 "darrell overton" -> MONT-OVER-022719 "montese overton"
--     The only Darrell Overton at East Carolina was Montese's father, an ECU
--     BASKETBALL player (1988-91), so the "darrell overton" OLB row cannot be
--     him; it is a mis-named duplicate of Montese (ECU LB, drafted 2016). The
--     survivor is the correctly-named row despite fewer dependents.
--
-- Four pairs carry the SAME draft_overall_pick on both rows (the strongest
-- same-person evidence): Matt/Matthew Waletzko 155, Nicholas/Nick Zakelj 187,
-- Kenyatta/Kevin Walker 14, Malaefou/Matthew Mark Mackenzie 218.
--
-- NOTE ON A CALIBRATION ERROR: the parked.json evidence for the Colton/Dylan
-- Taylor entry asserts "Daijun/Sevarian Edwards is ... the pair known to be
-- two people". That is WRONG: Sevarian Daijun Edwards (Georgia RB, 2024) is
-- one person, born 2001-04-11, and "Daijun" is the name he goes by. The two
-- rows are the same human and are MERGED here (SEVA-EDWA -> DAIJ-EDWA), not
-- parked. This merge supersedes that aside; no finding depends on it.
--
-- Externally verified during adjudication: Arlington Louis "Ali" Highsmith,
-- James Connor Neighbors, James Curtis Gatewood, Montese Overton (father was
-- a basketball player), Sevarian Daijun Edwards, plus the eight the check's
-- calibration already verified (Chop/Demeioun Robinson, Kool-Aid/Ga'Quincy
-- McKinstry, Speedy/Devante Noil, Geno/Euguene Hayes, Cobee/Jacobee Bryant,
-- George/Miles Dieffenbach, John/Tyler Varga, Christian/Blake Proehl).
--
-- Gamelog collisions: five pairs hold BOTH rows' gamelogs for the same game
-- (109 rows measured 2026-08-17). The stats agree; the rows differ only in
-- provenance and per-row metadata (source, career_game, is_starter,
-- snaps_* on the Bryant pair). Step 4 lifts the donor's non-null values onto
-- the survivor (round-2 rescue, coalesce never overwrites); step 5 then drops
-- the colliding donor rows.
--
-- db:exec wraps this file in a single transaction; no explicit BEGIN here.
-- statement_timeout is raised because step 6 re-points thousands of rows
-- across the large odds tables; lock_timeout is set in the same breath and
-- deliberately NOT left at 0.
--
-- ---------------------------------------------------------------------------
-- Evidence
-- ---------------------------------------------------------------------------
--
--   drop -> keep   deciding evidence
--
--   LABB-OVER-000573 (labbeus overton) -> LTXX-OVER-030470 (lt overton)   draft pick 137 on the rich row
--   TYXX-SCOT-044460 (ty scott) -> TYRO-SCOT-000328 (tyrone scott)   nickname/legal-name variant; shared birth date, mint shape
--   OJXX-HILI-044526 (oj hiliare) -> ODIE-HILI-001621 (odieu hiliare)   nickname/legal-name variant; shared birth date, mint shape
--   SAMX-WIGL-044535 (sam wiglusz) -> SAMU-WIGL-001553 (samuel wiglusz)   nickname/legal-name variant; shared birth date, mint shape
--   PATR-COOG-000773 (patrick coogan) -> PATX-COOG-030516 (pat coogan)   draft pick 194 on the rich row
--   ELIJ-RARI-000259 (elijah raridon) -> ELIX-RARI-044712 (eli raridon)   nickname/legal-name variant; shared birth date
--   JOSH-PITS-030532 (josh pitsenberger) -> JOSH-PITS-044799 (joshua pitsenberger)   nickname/legal-name variant
--   NICH-GARG-022776 (nicholas gargiulo) -> NICK-GARG-026375 (nick gargiulo)   draft pick 256 on the rich row
--   TERR-SMIT-000177 (terrell smith) -> TERE-SMIT-007009 (terell smith)   draft pick 165 on the rich row
--   DANI-ZIEM-024767 (daniel ziemba) -> LEEX-ZIEM-027228 (lee ziemba)   draft pick 244 on the rich row
--   JOEY-AGUI-044713 (joey aguilar) -> JOSE-AGUI-000447 (jose aguilar)   nickname/legal-name variant; mint shape
--   NATE-WIGG-006862 (nate wiggins) -> NATH-WIGG-001219 (nathaniel wiggins)   draft pick 30 on the rich row
--   JOEX-MORG-000555 (joe morgan) -> JOSE-MORG-004512 (joseph morgan)   nickname/legal-name variant
--   JEFF-OTAH-024680 (jeffrey otah) -> JEFF-OTAH-006701 (jeff otah)   draft pick 19 on the rich row
--   KITA-OLAD-004565 (kitan oladapo) -> OLAK-OLAD-001270 (olakitan oladapo)   draft pick 169 on the rich row
--   JACO-BRYA-001787 (jacobee bryant) -> COBE-BRYA-025380 (cobee bryant)   externally verified same person
--   AUBR-TARP-002156 (aubrey tarpley) -> AJXX-TARP-005519 (aj tarpley)   nickname/legal-name variant
--   MATT-WALE-019004 (matthew waletzko) -> MATT-WALE-003119 (matt waletzko)   shared draft_overall_pick 155 on both rows
--   CJXX-JOHN-017911 (cj johnson) -> CHRI-JOHN-004839 (christopher johnson)   nickname/legal-name variant
--   MAXX-MELT-006509 (max melton) -> MALA-MELT-015183 (malachi melton)   draft pick 43 on the rich row
--   EUGU-HAYE-021001 (euguene hayes) -> GENO-HAYE-016470 (geno hayes)   externally verified same person
--   GEOR-DIEF-020749 (george dieffenbach) -> MILE-DIEF-022666 (miles dieffenbach)   externally verified same person
--   TJXX-TAMP-006856 (tj tampa) -> MARQ-TAMP-011830 (marques tampa)   draft pick 130 on the rich row
--   MARL-DEVO-022528 (marlon devonshire) -> MJXX-DEVO-006298 (mj devonshire)   draft pick 229 on the rich row
--   JOHN-VARG-018376 (john varga) -> TYLE-VARG-025435 (tyler varga)   externally verified same person
--   DANN-AIKE-007526 (danny aiken) -> DANI-AIKE-020035 (daniel aiken)   nickname/legal-name variant
--   GABR-HALL-012215 (gabriel hall) -> GABE-HALL-009899 (gabe hall)   nickname/legal-name variant
--   MALA-MACK-007707 (malaefou mackenzie) -> MATT-MACK-006887 (matthew mark mackenzie)   shared draft_overall_pick 218 on both rows; shared birth date
--   KAIT-LEVE-012908 (kaitori leveston) -> KTXX-LEVE-002194 (kt leveston)   draft pick 254 on the rich row
--   DARI-CAMP-019947 (darion campbell) -> DJXX-CAMP-026510 (dj campbell)   draft pick 216 on the rich row
--   CHRI-NEIL-004497 (christopher neild) -> CHRI-NEIL-008262 (chris neild)   draft pick 253 on the rich row
--   GARY-SMIT-012212 (gary smith) -> BREN-SMIT-000990 (brent smith)   draft pick 96 on the rich row; shared birth date
--   KHAL-MURD-000803 (khalil murdock) -> REDX-MURD-030486 (red murdock)   draft pick 257 on the rich row
--   DEVA-NOIL-007933 (devante noil) -> SPEE-NOIL-014368 (speedy noil)   externally verified same person
--   ZACH-MILL-014491 (zachary miller) -> ZACH-MILL-001981 (zach miller)   draft pick 38 on the rich row
--   CHAS-HENR-015253 (chas henry) -> CHAR-HENR-000782 (charles henry)   nickname/legal-name variant
--   CHOP-ROBI-004556 (chop robinson) -> DEME-ROBI-015288 (demeioun robinson)   externally verified same person
--   CHRI-HARP-015514 (christopher harper) -> CHRI-HARP-002592 (chris harper)   draft pick 123 on the rich row
--   CHRI-HOLL-019743 (christopher holloman) -> DEVO-HOLL-004160 (devonte holloman)   draft pick 185 on the rich row
--   KEVI-WALK-016093 (kevin walker) -> KENY-WALK-005337 (kenyatta walker)   shared draft_overall_pick 14 on both rows; shared birth date
--   JAME-ROLD-000448 (james rolder) -> JIMM-ROLD-030496 (jimmy rolder)   draft pick 118 on the rich row
--   NICH-ZAKE-019075 (nicholas zakelj) -> NICK-ZAKE-018526 (nick zakelj)   shared draft_overall_pick 187 on both rows
--   DUEC-WATT-044476 (duece watts) -> NATO-WATT-017332 (natorian watts)   nickname/legal-name variant; mint shape
--   TJXX-LUTH-044487 (tj luther) -> TYRE-LUTH-017346 (tyreece luther)   nickname/legal-name variant; mint shape
--   STEV-WEAT-018602 (steven weatherford) -> STEV-WEAT-023907 (steve weatherford)   nickname/legal-name variant
--   ARLI-HIGH-018816 (arlington highsmith) -> ALIX-HIGH-003825 (ali highsmith)   externally verified same person
--   CHRI-PROE-019717 (christian proehl) -> BLAK-PROE-026218 (blake proehl)   externally verified same person
--   JACO-INGR-004973 (jake ingram) -> JACO-INGR-020901 (jacob ingram)   draft pick 198 on the rich row
--   JAME-NEIG-021252 (james neighbors) -> CONN-NEIG-015608 (connor neighbors)   externally verified same person
--   THOM-ZBIK-024063 (thomas zbikowski) -> THOM-ZBIK-026269 (tom zbikowski)   draft pick 86 on the rich row
--   JOSH-DAWS-021862 (joshua dawson) -> JOSH-DAWS-005174 (josh dawson)   nickname/legal-name variant
--   KENN-DEME-022001 (kenneth demens) -> KENN-DEME-016877 (kenny demens)   nickname/legal-name variant
--   MATT-DODG-018961 (matt dodge) -> MATT-DODG-022431 (matthew dodge)   draft pick 221 on the rich row
--   WEST-LUNT-024264 (weston lunt) -> WESX-LUNT-007628 (wes lunt)   nickname/legal-name variant
--   NATE-GARN-022738 (nate garner) -> NATH-GARN-022775 (nathaniel garner)   draft pick 211 on the rich row
--   SEVA-EDWA-023676 (sevarian edwards) -> DAIJ-EDWA-003100 (daijun edwards)   externally verified same person
--   TORR-MARA-024099 (torrance marable) -> CJXX-MARA-025502 (cj marable)   nickname/legal-name variant
--   CHRI-KUPE-024571 (christopher kuper) -> CHRI-KUPE-017559 (chris kuper)   draft pick 161 on the rich row
--   JOSH-GATT-024621 (joshua gattis) -> JOSH-GATT-018790 (josh gattis)   draft pick 150 on the rich row
--   CURT-GATE-019836 (curtis gatewood) -> JAME-GATE-024650 (james gatewood)   externally verified same person
--   EDWA-WANG-020956 (ed wang) -> EDWA-WANG-024715 (edward wang)   nickname/legal-name variant
--   ZACH-HURD-015111 (zach hurd) -> ZACH-HURD-024786 (zachary hurd)   nickname/legal-name variant
--   JOEX-MADS-021595 (joe madsen) -> JOSE-MADS-024807 (joseph madsen)   nickname/legal-name variant
--   WILL-TURN-024856 (william turner) -> TREX-TURN-024145 (tre turner)   nickname/legal-name variant
--   KOOL-MCKI-006879 (kool-aid mckinstry) -> GAQU-MCKI-009495 (gaquincy mckinstry)   externally verified same person
--   JAME-SMAC-000856 (james smack) -> TREY-SMAC-030511 (trey smack)   draft pick 216 on the rich row
--   JASO-ALFO-013420 (jason alford) -> JAYX-ALFO-004590 (jay alford)   draft pick 81 on the rich row
--   CAME-ROSS-044753 (cameron ross) -> CAMX-ROSS-030481 (cam ross)   nickname/legal-name variant; shared birth date, mint shape
--   ANTO-MAFI-000249 (antonio mafi) -> ATON-MAFI-020410 (atonio mafi)   draft pick 144 on the rich row
--   CALL-ADOM-019313 (callen adomitis) -> CALX-ADOM-006361 (cal adomitis)   nickname/legal-name variant
--   MICH-WILL-024738 (michael williams) -> MIKE-WILL-025950 (mike williams)   draft pick 101 on the rich row
--   CAMX-HART-007033 (cam hart) -> CAME-HART-007932 (cameron hart)   draft pick 140 on the rich row
--   DARR-OVER-007542 (darrell overton) -> MONT-OVER-022719 (montese overton)   externally verified same person
--   JAMI-SILV-021292 (jamie silva) -> JAME-SILV-024663 (james silva)   nickname/legal-name variant
--   JONA-AMAY-021767 (jonathan amaya) -> JONA-AMAY-006978 (jonathon amaya)   nickname/legal-name variant
--   CHRI-GIVE-005272 (christopher givens) -> CHRI-GIVE-025585 (chris givens)   draft pick 96 on the rich row
--   BENJ-BECK-018976 (benjamin beckwith) -> BENX-BECK-007959 (ben beckwith)   nickname/legal-name variant

SET lock_timeout = '30s';
SET statement_timeout = 0;

CREATE TEMP TABLE merge_map (
  drop_pid varchar NOT NULL PRIMARY KEY,
  keep_pid varchar NOT NULL
) ON COMMIT DROP;

INSERT INTO merge_map (drop_pid, keep_pid) VALUES
  ('LABB-OVER-000573', 'LTXX-OVER-030470'),
  ('TYXX-SCOT-044460', 'TYRO-SCOT-000328'),
  ('OJXX-HILI-044526', 'ODIE-HILI-001621'),
  ('SAMX-WIGL-044535', 'SAMU-WIGL-001553'),
  ('PATR-COOG-000773', 'PATX-COOG-030516'),
  ('ELIJ-RARI-000259', 'ELIX-RARI-044712'),
  ('JOSH-PITS-030532', 'JOSH-PITS-044799'),
  ('NICH-GARG-022776', 'NICK-GARG-026375'),
  ('TERR-SMIT-000177', 'TERE-SMIT-007009'),
  ('DANI-ZIEM-024767', 'LEEX-ZIEM-027228'),
  ('JOEY-AGUI-044713', 'JOSE-AGUI-000447'),
  ('NATE-WIGG-006862', 'NATH-WIGG-001219'),
  ('JOEX-MORG-000555', 'JOSE-MORG-004512'),
  ('JEFF-OTAH-024680', 'JEFF-OTAH-006701'),
  ('KITA-OLAD-004565', 'OLAK-OLAD-001270'),
  ('JACO-BRYA-001787', 'COBE-BRYA-025380'),
  ('AUBR-TARP-002156', 'AJXX-TARP-005519'),
  ('MATT-WALE-019004', 'MATT-WALE-003119'),
  ('CJXX-JOHN-017911', 'CHRI-JOHN-004839'),
  ('MAXX-MELT-006509', 'MALA-MELT-015183'),
  ('EUGU-HAYE-021001', 'GENO-HAYE-016470'),
  ('GEOR-DIEF-020749', 'MILE-DIEF-022666'),
  ('TJXX-TAMP-006856', 'MARQ-TAMP-011830'),
  ('MARL-DEVO-022528', 'MJXX-DEVO-006298'),
  ('JOHN-VARG-018376', 'TYLE-VARG-025435'),
  ('DANN-AIKE-007526', 'DANI-AIKE-020035'),
  ('GABR-HALL-012215', 'GABE-HALL-009899'),
  ('MALA-MACK-007707', 'MATT-MACK-006887'),
  ('KAIT-LEVE-012908', 'KTXX-LEVE-002194'),
  ('DARI-CAMP-019947', 'DJXX-CAMP-026510'),
  ('CHRI-NEIL-004497', 'CHRI-NEIL-008262'),
  ('GARY-SMIT-012212', 'BREN-SMIT-000990'),
  ('KHAL-MURD-000803', 'REDX-MURD-030486'),
  ('DEVA-NOIL-007933', 'SPEE-NOIL-014368'),
  ('ZACH-MILL-014491', 'ZACH-MILL-001981'),
  ('CHAS-HENR-015253', 'CHAR-HENR-000782'),
  ('CHOP-ROBI-004556', 'DEME-ROBI-015288'),
  ('CHRI-HARP-015514', 'CHRI-HARP-002592'),
  ('CHRI-HOLL-019743', 'DEVO-HOLL-004160'),
  ('KEVI-WALK-016093', 'KENY-WALK-005337'),
  ('JAME-ROLD-000448', 'JIMM-ROLD-030496'),
  ('NICH-ZAKE-019075', 'NICK-ZAKE-018526'),
  ('DUEC-WATT-044476', 'NATO-WATT-017332'),
  ('TJXX-LUTH-044487', 'TYRE-LUTH-017346'),
  ('STEV-WEAT-018602', 'STEV-WEAT-023907'),
  ('ARLI-HIGH-018816', 'ALIX-HIGH-003825'),
  ('CHRI-PROE-019717', 'BLAK-PROE-026218'),
  ('JACO-INGR-004973', 'JACO-INGR-020901'),
  ('JAME-NEIG-021252', 'CONN-NEIG-015608'),
  ('THOM-ZBIK-024063', 'THOM-ZBIK-026269'),
  ('JOSH-DAWS-021862', 'JOSH-DAWS-005174'),
  ('KENN-DEME-022001', 'KENN-DEME-016877'),
  ('MATT-DODG-018961', 'MATT-DODG-022431'),
  ('WEST-LUNT-024264', 'WESX-LUNT-007628'),
  ('NATE-GARN-022738', 'NATH-GARN-022775'),
  ('SEVA-EDWA-023676', 'DAIJ-EDWA-003100'),
  ('TORR-MARA-024099', 'CJXX-MARA-025502'),
  ('CHRI-KUPE-024571', 'CHRI-KUPE-017559'),
  ('JOSH-GATT-024621', 'JOSH-GATT-018790'),
  ('CURT-GATE-019836', 'JAME-GATE-024650'),
  ('EDWA-WANG-020956', 'EDWA-WANG-024715'),
  ('ZACH-HURD-015111', 'ZACH-HURD-024786'),
  ('JOEX-MADS-021595', 'JOSE-MADS-024807'),
  ('WILL-TURN-024856', 'TREX-TURN-024145'),
  ('KOOL-MCKI-006879', 'GAQU-MCKI-009495'),
  ('JAME-SMAC-000856', 'TREY-SMAC-030511'),
  ('JASO-ALFO-013420', 'JAYX-ALFO-004590'),
  ('CAME-ROSS-044753', 'CAMX-ROSS-030481'),
  ('ANTO-MAFI-000249', 'ATON-MAFI-020410'),
  ('CALL-ADOM-019313', 'CALX-ADOM-006361'),
  ('MICH-WILL-024738', 'MIKE-WILL-025950'),
  ('CAMX-HART-007033', 'CAME-HART-007932'),
  ('DARR-OVER-007542', 'MONT-OVER-022719'),
  ('JAMI-SILV-021292', 'JAME-SILV-024663'),
  ('JONA-AMAY-021767', 'JONA-AMAY-006978'),
  ('CHRI-GIVE-005272', 'CHRI-GIVE-025585'),
  ('BENJ-BECK-018976', 'BENX-BECK-007959');

-- Step 0. Refuse to run against a database this map was not built for.
DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM merge_map;
  IF n <> 77 THEN RAISE EXCEPTION 'expected 77 merge rows, got %', n; END IF;

  SELECT count(DISTINCT keep_pid) INTO n FROM merge_map;
  IF n <> 77 THEN RAISE EXCEPTION 'expected 77 distinct survivors, got %', n; END IF;

  SELECT count(*) INTO n FROM merge_map m WHERE NOT EXISTS (SELECT 1 FROM player p WHERE p.pid = m.drop_pid);
  IF n > 0 THEN RAISE EXCEPTION '% drop rows are already absent from player -- map is stale', n; END IF;

  SELECT count(*) INTO n FROM merge_map m WHERE NOT EXISTS (SELECT 1 FROM player p WHERE p.pid = m.keep_pid);
  IF n > 0 THEN RAISE EXCEPTION '% survivors are absent from player -- map is stale', n; END IF;

  SELECT count(*) INTO n FROM merge_map m JOIN merge_map x ON x.drop_pid = m.keep_pid;
  IF n > 0 THEN RAISE EXCEPTION '% survivors are themselves scheduled for deletion', n; END IF;

  -- The five adjudicated NON-duplicates for this check in db/checks/parked.json
  -- as of 2026-08-17. These are different people and a merge would be
  -- unrecoverable, so the map is refused outright if one appears on either side.
  SELECT count(*) INTO n FROM merge_map
   WHERE drop_pid IN ('RICH-SAUL-014018','RONA-SAUL-014155','RALE-MCKE-019193','REGI-MCKE-023172',
                      'HARO-SHOE-021140','HERB-SHOE-011342','COLT-TAYL-019782','DYLA-TAYL-020394',
                      'JOSH-JOHN-017834','TYLE-JOHN-024181')
      OR keep_pid IN ('RICH-SAUL-014018','RONA-SAUL-014155','RALE-MCKE-019193','REGI-MCKE-023172',
                      'HARO-SHOE-021140','HERB-SHOE-011342','COLT-TAYL-019782','DYLA-TAYL-020394',
                      'JOSH-JOHN-017834','TYLE-JOHN-024181');
  IF n > 0 THEN RAISE EXCEPTION 'map contains a pid adjudicated as a DIFFERENT PERSON -- refusing'; END IF;

  -- Each pair must still agree on the anchor that identified it (last name,
  -- college, draft year) and must still spell the first name differently.
  SELECT count(*) INTO n
    FROM merge_map m
    JOIN player d ON d.pid = m.drop_pid
    JOIN player k ON k.pid = m.keep_pid
   WHERE lower(trim(d.last_name)) IS DISTINCT FROM lower(trim(k.last_name))
      OR lower(trim(d.college)) IS DISTINCT FROM lower(trim(k.college))
      OR d.nfl_draft_year IS DISTINCT FROM k.nfl_draft_year;
  IF n > 0 THEN RAISE EXCEPTION '% pairs no longer agree on the anchor -- map is stale', n; END IF;

  SELECT count(*) INTO n
    FROM merge_map m
    JOIN player d ON d.pid = m.drop_pid
    JOIN player k ON k.pid = m.keep_pid
   WHERE d.formatted_name IS NOT DISTINCT FROM k.formatted_name;
  IF n > 0 THEN RAISE EXCEPTION '% pairs no longer spell the name differently -- map is stale', n; END IF;

  -- The check vetoes a pair whose two rows hold DIFFERENT values of any
  -- person-level identifier. The merge depends on that veto: step 9 fills the
  -- survivor additively, so a donor identifier the survivor does not hold
  -- would otherwise be silently dropped. Re-assert it against the live rows.
  SELECT count(*) INTO n
    FROM merge_map m
    JOIN player d ON d.pid = m.drop_pid
    JOIN player k ON k.pid = m.keep_pid
   WHERE (d.gsis_player_id is not null and k.gsis_player_id is not null and d.gsis_player_id <> k.gsis_player_id)
      OR (d.esb_player_id is not null and k.esb_player_id is not null and d.esb_player_id <> k.esb_player_id)
      OR (d.pfr_player_id is not null and k.pfr_player_id is not null and d.pfr_player_id <> k.pfr_player_id)
      OR (d.smart_player_id is not null and k.smart_player_id is not null and d.smart_player_id <> k.smart_player_id)
      OR (d.sleeper_player_id is not null and k.sleeper_player_id is not null and d.sleeper_player_id <> k.sleeper_player_id)
      OR (d.nfl_player_id is not null and k.nfl_player_id is not null and d.nfl_player_id <> k.nfl_player_id);
  IF n > 0 THEN RAISE EXCEPTION '% pairs hold conflicting person-level identifiers -- re-adjudicate', n; END IF;

  -- A pair holding two DIFFERENT real birth dates would be two people (the
  -- check vetoes it); re-assert the sentinel-aware conflict is absent.
  SELECT count(*) INTO n
    FROM merge_map m
    JOIN player d ON d.pid = m.drop_pid
    JOIN player k ON k.pid = m.keep_pid
   WHERE nullif(d.date_of_birth, '0000-00-00') IS NOT NULL
     AND nullif(k.date_of_birth, '0000-00-00') IS NOT NULL
     AND d.date_of_birth <> k.date_of_birth;
  IF n > 0 THEN RAISE EXCEPTION '% pairs hold conflicting birth dates -- re-adjudicate', n; END IF;
END $$;

-- Step 1. Snapshot every row about to be deleted. Everything after this reads
-- the deleted rows from here, never from `player`, so the fill in step 9 still
-- works after the delete in step 8.
CREATE TEMP TABLE drop_snapshot ON COMMIT DROP AS
SELECT p.* FROM player p JOIN merge_map m ON m.drop_pid = p.pid;

DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM drop_snapshot;
  IF n <> 77 THEN RAISE EXCEPTION 'expected 77 rows snapshotted, got %', n; END IF;
END $$;

-- Step 2. Preserve every non-null value held by each deleted row into
-- player_changelog against the surviving pid. This is what makes the delete
-- reversible from the database alone, and it preserves every identifier and
-- measurement that lives only on the donor side.
INSERT INTO player_changelog (pid, column_name, previous_value, new_value, source, reason, changed_at)
SELECT m.keep_pid, kv.key, kv.value #>> '{}', NULL,
  'adhoc/2026-08-17-merge-nickname-legal-name-player-rows',
  'preserved value from merged duplicate row ' || m.drop_pid,
  now()
FROM merge_map m
JOIN drop_snapshot s ON s.pid = m.drop_pid
CROSS JOIN LATERAL jsonb_each(to_jsonb(s)) kv
WHERE kv.value IS NOT NULL
  AND kv.value <> 'null'::jsonb
  AND kv.key NOT IN ('pid', 'name_search_vector');

-- Step 3. Record the merge itself.
INSERT INTO player_changelog (pid, column_name, previous_value, new_value, source, reason, changed_at)
SELECT m.keep_pid, 'pid', m.drop_pid, m.keep_pid,
  'adhoc/2026-08-17-merge-nickname-legal-name-player-rows',
  'nickname/legal-name duplicate player row merged into surviving pid',
  now()
FROM merge_map m;

-- Step 4. Rescue the gamelog values that live only on a row about to be
-- dropped (round-2 rescue). Five pairs hold BOTH rows' gamelogs for the same
-- game; measured 2026-08-17 at 109 colliding rows. The stats agree and the
-- rows differ only in provenance and per-row metadata (source, career_game,
-- is_starter, snaps_*). Coalesce takes the survivor's value whenever the
-- survivor has one -- it never overwrites. Runs BEFORE step 5, which drops
-- the colliding donor rows.
DO $$
DECLARE cols text; n int;
BEGIN
  SELECT string_agg(format('%I = coalesce(k.%I, d.%I)', column_name, column_name, column_name), ', ')
  INTO cols
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'player_gamelogs'
    AND column_name NOT IN ('pid', 'esbid', 'season_year');

  -- A generator that resolved nothing would make this step a silent no-op.
  SELECT count(*) INTO n FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'player_gamelogs'
     AND column_name NOT IN ('pid', 'esbid', 'season_year');
  IF n < 40 THEN RAISE EXCEPTION 'expected at least 40 fillable gamelog columns, resolved %', n; END IF;

  EXECUTE format($f$
    UPDATE player_gamelogs k SET %s
    FROM merge_map m
    JOIN player_gamelogs d ON d.pid = m.drop_pid
    WHERE k.pid = m.keep_pid AND k.esbid = d.esbid AND k.season_year = d.season_year
  $f$, cols);
  GET DIAGNOSTICS n = ROW_COUNT;
  RAISE NOTICE 'step 4: rescued % surviving gamelog rows from donor copies', n;
  IF n <> 109 THEN RAISE EXCEPTION 'expected 109 colliding gamelog rows, got % -- re-measure', n; END IF;
END $$;

-- Step 5. Drop the donor rows that would collide once re-pointed. Driven off
-- the live unique indexes rather than a hand-written table list, so an index
-- added since this file was written is still respected. Every row deleted here
-- is a duplicate of one the survivor already holds, and step 4 has already
-- lifted any value that existed only on the donor side.
DO $$
DECLARE r record; q text; n int; total int := 0;
BEGIN
  FOR r IN
    SELECT t.relname AS tbl, array_agg(a.attname ORDER BY k.ord) AS colnames
    FROM pg_index x
    JOIN pg_class t ON t.oid = x.indrelid
    JOIN pg_namespace ns ON ns.oid = t.relnamespace AND ns.nspname = 'public'
    CROSS JOIN LATERAL unnest(x.indkey) WITH ORDINALITY AS k(attnum, ord)
    JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = k.attnum
    WHERE x.indisunique AND t.relname <> 'player' AND NOT t.relispartition
    GROUP BY t.relname, x.indexrelid
    HAVING 'pid' = ANY(array_agg(a.attname))
  LOOP
    q := format(
      'DELETE FROM %I d USING merge_map m WHERE m.drop_pid = d.pid AND EXISTS (SELECT 1 FROM %I k WHERE k.pid = m.keep_pid%s)',
      r.tbl, r.tbl,
      (SELECT coalesce(string_agg(format(' AND k.%I IS NOT DISTINCT FROM d.%I', c, c), ''), '')
       FROM unnest(r.colnames) c WHERE c <> 'pid'));
    EXECUTE q;
    GET DIAGNOSTICS n = ROW_COUNT;
    IF n > 0 THEN
      RAISE NOTICE 'step 5: dropped % colliding rows from %', n, r.tbl;
      total := total + n;
    END IF;
  END LOOP;
  RAISE NOTICE 'step 5: % colliding donor rows dropped in total', total;
END $$;

-- Step 6. Re-point everything that still references a row being deleted. Driven
-- off information_schema so no pid-bearing table can be missed; partition
-- children are skipped because the update is applied to their parent.
DO $$
DECLARE tbl text; n int; total int := 0;
BEGIN
  FOR tbl IN
    SELECT c.table_name FROM information_schema.columns c
    JOIN pg_class t ON t.relname = c.table_name
    JOIN pg_namespace ns ON ns.oid = t.relnamespace AND ns.nspname = 'public'
    WHERE c.column_name = 'pid' AND c.table_schema = 'public'
      AND c.table_name <> 'player' AND NOT t.relispartition AND t.relkind IN ('r','p')
    ORDER BY 1
  LOOP
    EXECUTE format('UPDATE %I t SET pid = m.keep_pid FROM merge_map m WHERE t.pid = m.drop_pid', tbl);
    GET DIAGNOSTICS n = ROW_COUNT;
    IF n > 0 THEN
      RAISE NOTICE 'step 6: re-pointed % rows in %', n, tbl;
      total := total + n;
    END IF;
  END LOOP;
  RAISE NOTICE 'step 6: % rows re-pointed in total', total;
END $$;

-- Step 7. Verify nothing anywhere still references a row about to be deleted.
DO $$
DECLARE tbl text; n int;
BEGIN
  FOR tbl IN
    SELECT c.table_name FROM information_schema.columns c
    JOIN pg_class t ON t.relname = c.table_name
    JOIN pg_namespace ns ON ns.oid = t.relnamespace AND ns.nspname = 'public'
    WHERE c.column_name = 'pid' AND c.table_schema = 'public'
      AND c.table_name <> 'player' AND NOT t.relispartition AND t.relkind IN ('r','p')
  LOOP
    EXECUTE format('SELECT count(*) FROM %I t JOIN merge_map m ON m.drop_pid = t.pid', tbl) INTO n;
    IF n > 0 THEN RAISE EXCEPTION 'table % still holds % rows on a pid about to be deleted', tbl, n; END IF;
  END LOOP;
END $$;

-- Step 8. Drop the duplicate rows, releasing their identifiers from every
-- UNIQUE index before those identifiers are written onto the survivors in
-- step 9.
DELETE FROM player p USING merge_map m WHERE p.pid = m.drop_pid;

DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM player p JOIN merge_map m ON m.drop_pid = p.pid;
  IF n <> 0 THEN RAISE EXCEPTION '% duplicate rows survived the delete', n; END IF;
END $$;

-- Step 9. Fill every column the survivor is missing, from the snapshot. Purely
-- additive: coalesce never overwrites a value the survivor already holds, so no
-- adjudication between two competing non-null values happens here.
--
-- Generated from the catalog rather than written out (round-5 note): a
-- hand-written list silently STOPS CARRYING any column added to `player` after
-- it was written. Three columns carry a non-NULL empty value and need the
-- sentinel made absent first:
--   date_of_birth       varchar whose absent value is the string '0000-00-00'
--   draft_overall_pick  0 is the empty value, not NULL
--   draft_round         0 is the empty value, not NULL
--   jersey_number       0 is the empty value, not NULL
-- `pid` is excluded because it is the join key, and `name_search_vector` because
-- it is derived from the name columns rather than carried.
DO $$
DECLARE assignments text; n int;
BEGIN
  SELECT string_agg(
    CASE
      WHEN c.column_name = 'date_of_birth'
        THEN format('%1$I = coalesce(nullif(c.%1$I, %2$L), nullif(s.%1$I, %2$L), c.%1$I)',
                    c.column_name, '0000-00-00')
      WHEN c.column_name IN ('draft_overall_pick', 'draft_round', 'jersey_number')
        THEN format('%1$I = coalesce(nullif(c.%1$I, 0), nullif(s.%1$I, 0), c.%1$I)', c.column_name)
      ELSE format('%1$I = coalesce(c.%1$I, s.%1$I)', c.column_name)
    END, ', ' ORDER BY c.ordinal_position)
  INTO assignments
  FROM information_schema.columns c
  WHERE c.table_schema = 'public' AND c.table_name = 'player'
    AND c.column_name NOT IN ('pid', 'name_search_vector')
    AND c.is_generated = 'NEVER';

  SELECT count(*) INTO n FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'player'
     AND column_name NOT IN ('pid', 'name_search_vector') AND is_generated = 'NEVER';
  IF n < 80 THEN RAISE EXCEPTION 'expected at least 80 fillable player columns, resolved % -- the generator is not seeing the table', n; END IF;
  RAISE NOTICE 'step 9: filling % columns additively', n;

  EXECUTE format(
    'UPDATE player c SET %s FROM drop_snapshot s JOIN merge_map m ON m.drop_pid = s.pid WHERE c.pid = m.keep_pid',
    assignments);
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 77 THEN RAISE EXCEPTION 'expected 77 survivors filled, got %', n; END IF;
END $$;

-- Step 10. Post-conditions. The 77 survivors remain, the 77 donors are gone,
-- and the check that surfaced this set must now return exactly the five parked
-- pairs and nothing else. Recomputing its predicate here is what turns "the
-- merge ran" into "the finding is gone".
DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM player
   WHERE pid IN ('LTXX-OVER-030470','TYRO-SCOT-000328','ODIE-HILI-001621','SAMU-WIGL-001553','PATX-COOG-030516','ELIX-RARI-044712','JOSH-PITS-044799','NICK-GARG-026375','TERE-SMIT-007009','LEEX-ZIEM-027228','JOSE-AGUI-000447','NATH-WIGG-001219','JOSE-MORG-004512','JEFF-OTAH-006701','OLAK-OLAD-001270','COBE-BRYA-025380','AJXX-TARP-005519','MATT-WALE-003119','CHRI-JOHN-004839','MALA-MELT-015183','GENO-HAYE-016470','MILE-DIEF-022666','MARQ-TAMP-011830','MJXX-DEVO-006298','TYLE-VARG-025435','DANI-AIKE-020035','GABE-HALL-009899','MATT-MACK-006887','KTXX-LEVE-002194','DJXX-CAMP-026510','CHRI-NEIL-008262','BREN-SMIT-000990','REDX-MURD-030486','SPEE-NOIL-014368','ZACH-MILL-001981','CHAR-HENR-000782','DEME-ROBI-015288','CHRI-HARP-002592','DEVO-HOLL-004160','KENY-WALK-005337','JIMM-ROLD-030496','NICK-ZAKE-018526','NATO-WATT-017332','TYRE-LUTH-017346','STEV-WEAT-023907','ALIX-HIGH-003825','BLAK-PROE-026218','JACO-INGR-020901','CONN-NEIG-015608','THOM-ZBIK-026269','JOSH-DAWS-005174','KENN-DEME-016877','MATT-DODG-022431','WESX-LUNT-007628','NATH-GARN-022775','DAIJ-EDWA-003100','CJXX-MARA-025502','CHRI-KUPE-017559','JOSH-GATT-018790','JAME-GATE-024650','EDWA-WANG-024715','ZACH-HURD-024786','JOSE-MADS-024807','TREX-TURN-024145','GAQU-MCKI-009495','TREY-SMAC-030511','JAYX-ALFO-004590','CAMX-ROSS-030481','ATON-MAFI-020410','CALX-ADOM-006361','MIKE-WILL-025950','CAME-HART-007932','MONT-OVER-022719','JAME-SILV-024663','JONA-AMAY-006978','CHRI-GIVE-025585','BENX-BECK-007959');
  IF n <> 77 THEN RAISE EXCEPTION 'expected 77 survivors present, got %', n; END IF;

  SELECT count(*) INTO n FROM player
   WHERE pid IN ('LABB-OVER-000573','TYXX-SCOT-044460','OJXX-HILI-044526','SAMX-WIGL-044535','PATR-COOG-000773','ELIJ-RARI-000259','JOSH-PITS-030532','NICH-GARG-022776','TERR-SMIT-000177','DANI-ZIEM-024767','JOEY-AGUI-044713','NATE-WIGG-006862','JOEX-MORG-000555','JEFF-OTAH-024680','KITA-OLAD-004565','JACO-BRYA-001787','AUBR-TARP-002156','MATT-WALE-019004','CJXX-JOHN-017911','MAXX-MELT-006509','EUGU-HAYE-021001','GEOR-DIEF-020749','TJXX-TAMP-006856','MARL-DEVO-022528','JOHN-VARG-018376','DANN-AIKE-007526','GABR-HALL-012215','MALA-MACK-007707','KAIT-LEVE-012908','DARI-CAMP-019947','CHRI-NEIL-004497','GARY-SMIT-012212','KHAL-MURD-000803','DEVA-NOIL-007933','ZACH-MILL-014491','CHAS-HENR-015253','CHOP-ROBI-004556','CHRI-HARP-015514','CHRI-HOLL-019743','KEVI-WALK-016093','JAME-ROLD-000448','NICH-ZAKE-019075','DUEC-WATT-044476','TJXX-LUTH-044487','STEV-WEAT-018602','ARLI-HIGH-018816','CHRI-PROE-019717','JACO-INGR-004973','JAME-NEIG-021252','THOM-ZBIK-024063','JOSH-DAWS-021862','KENN-DEME-022001','MATT-DODG-018961','WEST-LUNT-024264','NATE-GARN-022738','SEVA-EDWA-023676','TORR-MARA-024099','CHRI-KUPE-024571','JOSH-GATT-024621','CURT-GATE-019836','EDWA-WANG-020956','ZACH-HURD-015111','JOEX-MADS-021595','WILL-TURN-024856','KOOL-MCKI-006879','JAME-SMAC-000856','JASO-ALFO-013420','CAME-ROSS-044753','ANTO-MAFI-000249','CALL-ADOM-019313','MICH-WILL-024738','CAMX-HART-007033','DARR-OVER-007542','JAMI-SILV-021292','JONA-AMAY-021767','CHRI-GIVE-005272','BENJ-BECK-018976');
  IF n <> 0 THEN RAISE EXCEPTION '% donors still present, expected 0', n; END IF;

  -- Recompute the check's predicate. Every returned pair must be one of the
  -- five parked two-person pairs (which the classifier suppresses), so the
  -- non-parked count must be exactly zero.
  WITH anchored AS (
    SELECT pid, formatted_name,
           lower(trim(last_name)) AS last_name_key,
           lower(trim(college)) AS college_key,
           nfl_draft_year,
           nullif(date_of_birth, '0000-00-00') AS date_of_birth,
           nullif(trim(gsis_player_id), '') AS gsis_player_id,
           nullif(trim(esb_player_id), '') AS esb_player_id,
           nullif(trim(pfr_player_id), '') AS pfr_player_id,
           nullif(trim(smart_player_id), '') AS smart_player_id,
           nullif(trim(sleeper_player_id), '') AS sleeper_player_id,
           nfl_player_id
    FROM player
    WHERE last_name is not null and trim(last_name) <> ''
      and college is not null and trim(college) <> ''
      and nfl_draft_year is not null
  ),
  anchor_groups AS (
    SELECT last_name_key, college_key, nfl_draft_year, count(*) AS row_count
    FROM anchored GROUP BY 1, 2, 3
  ),
  pairs AS (
    SELECT a.pid, b.pid AS duplicate_pid
    FROM anchored a
    JOIN anchored b
      ON a.last_name_key = b.last_name_key
     AND a.college_key = b.college_key
     AND a.nfl_draft_year = b.nfl_draft_year
     AND a.pid < b.pid
    JOIN anchor_groups g
      ON g.last_name_key = a.last_name_key
     AND g.college_key = a.college_key
     AND g.nfl_draft_year = a.nfl_draft_year
     AND g.row_count = 2
    WHERE a.formatted_name IS DISTINCT FROM b.formatted_name
      AND NOT (a.gsis_player_id is not null and b.gsis_player_id is not null and a.gsis_player_id <> b.gsis_player_id)
      AND NOT (a.esb_player_id is not null and b.esb_player_id is not null and a.esb_player_id <> b.esb_player_id)
      AND NOT (a.pfr_player_id is not null and b.pfr_player_id is not null and a.pfr_player_id <> b.pfr_player_id)
      AND NOT (a.smart_player_id is not null and b.smart_player_id is not null and a.smart_player_id <> b.smart_player_id)
      AND NOT (a.sleeper_player_id is not null and b.sleeper_player_id is not null and a.sleeper_player_id <> b.sleeper_player_id)
      AND NOT (a.nfl_player_id is not null and b.nfl_player_id is not null and a.nfl_player_id <> b.nfl_player_id)
      AND NOT (a.date_of_birth is not null and b.date_of_birth is not null and a.date_of_birth <> b.date_of_birth)
  )
  SELECT count(*) INTO n FROM pairs x
   WHERE NOT (
        (x.pid = 'RICH-SAUL-014018' AND x.duplicate_pid = 'RONA-SAUL-014155')
     OR (x.pid = 'RONA-SAUL-014155' AND x.duplicate_pid = 'RICH-SAUL-014018')
     OR (x.pid = 'RALE-MCKE-019193' AND x.duplicate_pid = 'REGI-MCKE-023172')
     OR (x.pid = 'REGI-MCKE-023172' AND x.duplicate_pid = 'RALE-MCKE-019193')
     OR (x.pid = 'HARO-SHOE-021140' AND x.duplicate_pid = 'HERB-SHOE-011342')
     OR (x.pid = 'HERB-SHOE-011342' AND x.duplicate_pid = 'HARO-SHOE-021140')
     OR (x.pid = 'COLT-TAYL-019782' AND x.duplicate_pid = 'DYLA-TAYL-020394')
     OR (x.pid = 'DYLA-TAYL-020394' AND x.duplicate_pid = 'COLT-TAYL-019782')
     OR (x.pid = 'JOSH-JOHN-017834' AND x.duplicate_pid = 'TYLE-JOHN-024181')
     OR (x.pid = 'TYLE-JOHN-024181' AND x.duplicate_pid = 'JOSH-JOHN-017834'));
  IF n <> 0 THEN RAISE EXCEPTION 'nickname-legal-name check still returns % non-parked finding(s) after this merge', n; END IF;
END $$;
