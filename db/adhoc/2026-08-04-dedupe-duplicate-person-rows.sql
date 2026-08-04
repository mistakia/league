-- STATUS: APPLIED 2026-08-04 against league_production
--
-- Collapse 189 duplicate-PERSON rows in `player`: one person represented by both
-- a populated canonical row and a near-empty shell row. Distinct from the
-- conflated-identity work (one row merging two people) repaired in d85c5c64b.
--
-- Root cause. 146 of the shells carry a `player_changelog` row rewriting a
-- legacy-format pid (`CC-4400`, `FT-0430`) to the current format, every one of
-- them between 2023-03-06 and 2023-03-10 under source `sleeper`. A one-time pid
-- migration renamed legacy-scheme rows into the new namespace without checking
-- whether the person already held a new-format row. This is a migration
-- artifact, not an ongoing importer defect -- no new duplicates of this shape
-- are accruing.
--
-- Population. The candidate sweep is: zero external identifiers AND zero
-- gamelogs on the shell, against a same-formatted_name twin holding two or more
-- identifiers. Requiring college equality yields 150; relaxing to "same college
-- OR either college null" yields 242, because the canonical row is often the
-- thinner one on `college` and a strict join is structurally blind to that side.
-- The relaxed 242 is the population adjudicated here.
--
-- Adjudication. `nfl_draft_year` is corrupt on exactly these rows and cannot
-- discriminate -- 32 canonical rows carry a sentinel 1974 against shells
-- spanning 1957-1973. `date_of_birth` does discriminate. Pairs split as:
--   * 189 merge      -- birth years within 5 and DOB differing in at most one
--                       of year/month/day (89 byte-identical, the rest single
--                       digit corruption in one field)
--   * 19 left alone  -- birth years 19 to 69 years apart, positions differ
--                       materially: fathers, sons and namesakes (Tony Dorsett
--                       against Anthony Dorsett Jr., Bill Glass, Arthur Jones)
--   * 34 deferred    -- DOB is the 0000-00-00 sentinel on one side, or differs
--                       in two or three fields. No action taken.
--
-- Corroboration. Across all 242 pairs not one shell-and-canonical pair both
-- hold an `nfl_player_id`; 149 of the merges have the id on the shell and none
-- on the canonical. Two distinct people would not partition their identifiers
-- that way. The era oracle (local median of the `gsis_player_id` block over the
-- 60 nearest `nfl_player_id` neighbours, median absolute residual 25, 90th
-- percentile 315) was run against all 149 carried ids: median residual 11.5,
-- 147 inside the 90th percentile band.
--
-- Two ids are deliberately NOT carried; both are preserved in player_changelog
-- and so remain recoverable. A shell produced by a name-match hijack inherits
-- the nfl_player_id of whoever the matcher hit, which makes that field the one
-- most likely to belong to a third person -- and a foreign-but-unique id
-- collides with nothing, so the UNIQUE index cannot catch it. Every one of the
-- 150 carries was therefore gated: predict entry year from the median
-- nfl_draft_year of the 60 nearest nfl_player_id neighbours, and compare against
-- the canonical row's own date of birth plus 22. 148 agree within five years
-- (median gap 1.0 year). The two that do not:
--   * JAME-BROW-002403 holds 2534535, predicted entry 2012 against a canonical
--     born 1970-01-30 (expected 1992) -- a 20-year disagreement, and the block
--     is dense so the vote is real evidence. The 2012 james brown is
--     JAME-BROW-015782, who already holds his own 2532805, so 2534535 belongs
--     to neither. Carrying it would manufacture an era-foreign id on a row that
--     is clean today.
--   * JOHN-MALE-021744 holds 2520016, which falls in the sparse
--     2508600-2530400 dead zone. Its implied era happens to agree within a
--     year, but inside that range nearest-median is a coin flip and agreement
--     is not evidence, so the default is to not carry.
--
-- Reversibility. Every non-null column value on every deleted shell row is
-- written to `player_changelog` under this source before the delete, so the
-- shells are reconstructable from the database alone. A full JSON backup of all
-- 378 player rows and every downstream row also sits in
-- scratch/dedupe-duplicate-person-rows/2026-08-04-dedupe-backup.json.
--
-- Re-pointing. Shell rows exist in player_changelog (58981),
-- keeptradecut_valuations (1208), player_contracts (45), projections_history
-- (36), practice (27), projections_index (6), player_rankings_index (3),
-- pff_player_seasonlogs (2), pff_player_facet_seasonlogs (2) and
-- player_rankings_history (1). There are zero
-- shell rows in player_gamelogs, rosters_players, transactions, trades_players,
-- draft or any seasonlog table, so no fantasy-league integrity surface is
-- touched. Collisions against every unique index on every affected table were
-- probed and are zero, so no copy-versus-copy adjudication is needed.

-- db:exec wraps this file in a single transaction; no explicit BEGIN here.

CREATE TEMP TABLE merge_map (
  shell_pid varchar NOT NULL PRIMARY KEY,
  canon_pid varchar NOT NULL,
  carry_nfl_player_id boolean NOT NULL
) ON COMMIT DROP;

INSERT INTO merge_map (shell_pid, canon_pid, carry_nfl_player_id) VALUES
  ('AARO-GIBS-016538', 'AARO-GIBS-016549', true),
  ('AARO-SMIT-016566', 'AARO-SMIT-016573', true),
  ('ADAM-GOLD-002783', 'ADAM-GOLD-001702', true),
  ('ADAM-HAAY-000109', 'ADAM-HAAY-016604', true),
  ('ADRI-CLAR-000144', 'ADRI-CLAR-016626', true),
  ('ANDR-ECON-006424', 'ANDR-ECON-001899', true),
  ('ANDR-HAST-000471', 'ANDR-HAST-001044', true),
  ('ARTI-HICK-005222', 'ARTI-HICK-001390', true),
  ('BENN-ANDE-018987', 'BENN-ANDE-001183', true),
  ('BENX-ARCH-018998', 'BENX-ARCH-001848', true),
  ('BERN-ROBE-001031', 'BERN-ROBE-017344', true),
  ('BERT-JONE-016181', 'BERT-JONE-000492', true),
  ('BILL-FERR-001047', 'BILL-FERR-001679', true),
  ('BOBB-WILL-001353', 'BOBB-WILL-001522', true),
  ('BRAD-LEKK-019084', 'BRAD-LEKK-001854', true),
  ('BRAD-SMEL-017417', 'BRAD-SMEL-007028', true),
  ('BRAD-WRIG-007220', 'BRAD-WRIG-000802', true),
  ('BRAN-GORI-000401', 'BRAN-GORI-002024', true),
  ('BRAN-MOOR-018901', 'BRAN-MOOR-001412', true),
  ('BRAN-WINE-017282', 'BRAN-WINE-017283', true),
  ('BREN-SMIT-001202', 'BREN-SMIT-000990', true),
  ('BRET-WILL-017294', 'BRET-WILL-017453', true),
  ('BRYA-ANDE-001706', 'BRYA-ANDE-017498', true),
  ('CARS-DACH-019521', 'CARS-DACH-001523', true),
  ('CHAD-BEAS-017691', 'CHAD-BEAS-001463', true),
  ('CHAD-RINE-001925', 'CHAD-RINE-005903', true),
  ('CHAD-SLAU-006847', 'CHAD-SLAU-001182', true),
  ('CHRI-COOP-002135', 'CHRI-COOP-017863', true),
  ('CHRI-JURG-017878', 'CHRI-JURG-000514', true),
  ('CHRI-PATR-007114', 'CHRI-PATR-002021', true),
  ('CHRI-THOM-017883', 'CHRI-THOM-002854', true),
  ('CLIF-DICK-011672', 'CLIF-DICK-000204', true),
  ('CORE-CLAR-017983', 'CORE-CLAR-003195', true),
  ('CORE-HULS-019796', 'CORE-HULS-000596', true),
  ('CORY-BRAN-019835', 'CORY-BRAN-002168', true),
  ('CRAI-HENT-002546', 'CRAI-HENT-018095', true),
  ('CRAI-SAUE-018014', 'CRAI-SAUE-018010', true),
  ('DAMI-COOK-019855', 'DAMI-COOK-001304', true),
  ('DANI-FOUT-020055', 'DANI-FOUT-000350', true),
  ('DANI-LOPE-002634', 'DANI-LOPE-003501', true),
  ('DANI-NEIL-003505', 'DANX-NEIL-000799', true),
  ('DANT-ELLI-020060', 'DANT-ELLI-001847', true),
  ('DANX-CURL-002781', 'DANX-CURL-001549', true),
  ('DARE-SCOT-002663', 'DARE-SCOT-017952', true),
  ('DARN-STAP-007730', 'DARN-STAP-001979', true),
  ('DARR-ASHM-002676', 'DARR-ASHM-018155', true),
  ('DARR-WILL-015679', 'DARR-WILL-020095', true),
  ('DARY-TERR-020086', 'DARY-TERR-001030', true),
  ('DAVE-WILL-018182', 'DAVE-WILL-004030', true),
  ('DAVI-DIXO-018399', 'DAVI-DIXO-018194', true),
  ('DAVI-LOVE-003235', 'DAVI-LOVE-018201', true),
  ('DEQU-MENZ-017858', 'DEQU-MENZ-003836', true),
  ('DERR-DEES-003047', 'DERR-DEES-000250', true),
  ('DERR-FLET-018283', 'DERR-FLET-009490', true),
  ('DONA-STRO-020334', 'DONA-STRO-000742', true),
  ('DUST-DVOR-003336', 'DUST-DVOR-018553', true),
  ('DWAY-MORG-018956', 'DWAY-MORG-000781', true),
  ('EASO-WINS-020592', 'EASO-WINS-027440', true),
  ('ELIS-MANN-009376', 'ELIS-MANN-000588', true),
  ('ETHA-KELL-004159', 'ETHA-KELL-004072', true),
  ('EVAN-PILG-004300', 'EVAN-PILG-004273', true),
  ('FLOY-WEDD-003668', 'FLOY-WEDD-016137', true),
  ('FRAN-OMIY-016169', 'FRAN-OMIY-004945', true),
  ('FRAN-TARK-012445', 'FRAN-TARK-000751', true),
  ('FRAN-WOOD-015382', 'FRAN-WOOD-000798', true),
  ('GJXX-KINN-007737', 'GJXX-KINN-012511', true),
  ('HARV-DAHL-002257', 'HARV-DAHL-001878', true),
  ('HEAT-IRWI-017663', 'HEAT-IRWI-009629', true),
  ('IANX-ALLE-020862', 'IANX-ALLE-001309', true),
  ('JACK-MEWH-025986', 'JACK-MEWH-008980', true),
  ('JAMA-LEWI-004468', 'JAMA-LEWI-005410', true),
  ('JAMA-STEP-002340', 'JAMA-STEP-012437', true),
  ('JAME-BROW-002403', 'JAME-BROW-012500', false),
  ('JAME-HUNT-015904', 'JAME-HUNT-000469', true),
  ('JAME-PLUN-012659', 'JAME-PLUN-000663', true),
  ('JAMI-NAIL-015336', 'JAMI-NAIL-015289', true),
  ('JARE-PECK-021296', 'JARE-PECK-001691', true),
  ('JASO-THOM-004725', 'JASO-THOM-006545', true),
  ('JAVI-COLL-021466', 'JAVI-COLL-001294', true),
  ('JAYL-WATK-026659', 'JAYL-WATK-018659', true),
  ('JERE-BRID-006725', 'JERE-BRID-005610', true),
  ('JERE-MCKI-021510', 'JERE-MCKI-001803', true),
  ('JERM-CUNN-008816', 'JERM-CUNN-008800', true),
  ('JERO-CLAR-008837', 'JERO-CLAR-027231', true),
  ('JOHN-CONC-021606', 'JOHN-CONC-000191', true),
  ('JOHN-MALE-021744', 'JOHN-MALE-002167', false),
  ('JORD-BLAC-007591', 'JORD-BLAC-001544', true),
  ('JOSE-GILL-012866', 'JOSE-GILL-000387', true),
  ('JOSE-NAMA-012872', 'JOSE-NAMA-000626', true),
  ('JOSE-THEI-021867', 'JOSE-THEI-000752', true),
  ('JOSH-LOVE-021873', 'JOSH-LOVE-001338', true),
  ('JOSH-PERR-006128', 'JOSH-PERR-006125', true),
  ('JUST-GEIS-018808', 'JUST-GEIS-008978', true),
  ('KELL-BUTL-015409', 'KELL-BUTL-011145', true),
  ('KELV-GARM-005259', 'KELV-GARM-015400', true),
  ('KEND-CLAN-018838', 'KEND-CLAN-018852', true),
  ('KENN-STAB-012996', 'KENN-STAB-000729', true),
  ('KERL-BLAI-022053', 'KERL-BLAI-000080', true),
  ('KYLE-KOSI-006039', 'KYLE-KOSI-009898', true),
  ('KYLE-WILL-022168', 'KYLE-WILL-002019', true),
  ('LARR-MORT-011245', 'LARR-MORT-000621', true),
  ('LAWR-SMIT-022261', 'LAWR-SMIT-001681', true),
  ('LEAN-JORD-005550', 'LEAN-JORD-006569', true),
  ('LEON-DAWS-013104', 'LEON-DAWS-000199', true),
  ('LEVI-HORN-022288', 'LEVI-HORN-002130', true),
  ('LEWI-KELL-015843', 'LEWI-KELL-008939', true),
  ('LUCA-PETI-009031', 'LUKE-PETI-000903', true),
  ('MARC-PRIC-018933', 'MARC-PRIC-006763', true),
  ('MARC-RIVE-013985', 'MARC-RIVE-013961', true),
  ('MARI-PORT-022505', 'MARI-PORT-001729', true),
  ('MARK-DIXO-022510', 'MARK-DIXO-000254', true),
  ('MARQ-MCFA-022401', 'MARQ-MCFA-001811', true),
  ('MARQ-SPRU-018985', 'MARQ-SPRU-010034', true),
  ('MART-DOMR-022425', 'MART-DOMR-000220', true),
  ('MART-TEVA-022414', 'MART-TEVA-002113', true),
  ('MATT-JOYC-022445', 'MATT-JOYC-000616', true),
  ('MATT-LEPS-022447', 'MATT-LEPS-000644', true),
  ('MATT-MORG-022453', 'MATT-MORG-001855', true),
  ('MICH-OTTO-005840', 'MICH-OTTO-019007', true),
  ('MICH-PERE-013468', 'MICH-PERE-000656', true),
  ('MICH-PHIP-013368', 'MICH-PHIP-000659', true),
  ('MICH-RAEX-013376', 'MICH-RAEX-000678', true),
  ('MICH-ROSE-010172', 'MIKE-ROSE-000943', true),
  ('MICH-WELL-013453', 'MICH-WELL-000776', true),
  ('MIKE-KRAC-022647', 'MIKE-KRAC-001902', true),
  ('MIKE-PUCI-019049', 'MIKE-PUCI-001462', true),
  ('MIKE-WEBE-025878', 'MIKE-WEBE-010238', true),
  ('MILF-BROW-022692', 'MILF-BROW-013537', true),
  ('MORG-PEAR-022675', 'MORG-PEAR-001723', true),
  ('NASH-GODD-022728', 'NASH-GODD-001908', true),
  ('NATH-DORS-007139', 'NATX-DORS-001784', true),
  ('NICH-KACZ-019091', 'NICK-KACZ-001891', true),
  ('NORM-SNEA-013590', 'NORM-SNEA-000725', true),
  ('OMAR-SMIT-022842', 'OMAR-SMIT-001310', true),
  ('ONIE-COUS-012298', 'ONIE-COUS-008496', true),
  ('ORLA-BROW-022843', 'ORLA-BROW-000135', true),
  ('OTIS-HUDS-019139', 'OTIS-HUDS-010257', true),
  ('PATR-BROW-012351', 'PATR-BROW-002092', true),
  ('PATR-ESTE-019140', 'PATR-ESTE-010336', true),
  ('PATR-SULL-013629', 'PATR-SULL-000744', true),
  ('PETE-BEAT-013693', 'PETE-BEAT-000039', true),
  ('PETE-WOOD-013705', 'PETE-WOOD-000800', true),
  ('PHIL-MERL-011751', 'PHIL-MERL-019949', true),
  ('QASI-MITC-023030', 'QASI-MITC-001402', true),
  ('RALE-ROUN-019185', 'RALE-ROUN-010481', true),
  ('RAMO-HARE-022983', 'RAMO-HARE-000023', true),
  ('REGI-WELL-019214', 'REGG-WELL-001520', true),
  ('RICH-SHIN-013856', 'RICH-SHIN-000721', true),
  ('ROBE-BERR-023230', 'ROBE-BERR-000041', true),
  ('ROBE-DOUG-014045', 'ROBE-DOUG-000292', true),
  ('ROBE-GRIE-014049', 'ROBE-GRIE-000409', true),
  ('ROBE-JOHN-023286', 'ROBE-JOHN-017413', true),
  ('ROBE-SCOT-013998', 'ROBE-SCOT-000713', true),
  ('ROBE-WHIT-015850', 'BOBX-WHIT-001091', true),
  ('ROBX-MURP-023499', 'ROBX-MURP-001147', true),
  ('RODN-WILL-019268', 'RODN-WILL-010730', true),
  ('ROGE-CHAN-013225', 'ROGE-CHAN-001788', true),
  ('ROHA-DAVE-017487', 'ROHA-DAVE-009242', true),
  ('ROLA-CANT-023516', 'ROLA-CANT-001860', true),
  ('RONA-JAWO-014147', 'RONA-JAWO-000476', true),
  ('RONX-STON-006355', 'RONX-STON-001016', true),
  ('RYAN-BENJ-023590', 'RYAN-BENJ-001285', true),
  ('RYAN-DURA-023592', 'RYAN-DURA-007585', true),
  ('SAMM-WILL-002769', 'SAMM-WILL-010930', true),
  ('SCOT-TERC-019317', 'SCOT-TERC-010858', true),
  ('SCOT-YOUN-019319', 'SCOT-YOUN-010834', true),
  ('SPEN-FOLA-023781', 'SPEN-FOLA-000425', true),
  ('STEP-PETE-019375', 'STEP-PETE-011025', true),
  ('STEP-RAMS-014311', 'STEP-RAMS-000679', true),
  ('STEV-CHEE-013885', 'STEV-CHEE-001660', true),
  ('STEV-HERN-023856', 'STEV-HERN-001175', true),
  ('STEV-SPUR-014449', 'STEV-SPUR-000728', true),
  ('TAMX-HOPK-023874', 'TAMX-HOPK-001815', true),
  ('TAYL-WHIT-019420', 'TAYL-WHIT-019422', true),
  ('TERR-HANR-014478', 'TERR-HANR-000430', true),
  ('THOM-REAV-014582', 'THOM-REAV-000684', true),
  ('TOMM-POLL-019485', 'TOMM-POLL-011284', true),
  ('TOMX-ASHW-024111', 'TOMX-ASHW-001286', true),
  ('TONY-SEMP-019480', 'TONY-SEMP-001807', true),
  ('TROY-VINC-019557', 'TROY-VINC-011374', true),
  ('VICT-LEYV-019580', 'VICT-LEYV-011406', true),
  ('VICT-ROGE-006870', 'VICT-ROGE-011481', true),
  ('WAVE-JACK-024262', 'WAVE-JACK-001798', true),
  ('WAYN-HUNT-019616', 'WAYN-HUNT-016440', true),
  ('WESL-BRIT-016589', 'WESL-BRIT-016329', true),
  ('WESL-SIMS-009170', 'WESX-SIMS-001892', true),
  ('WILL-KILM-015016', 'WILL-KILM-000527', true),
  ('YAMO-FIGU-019622', 'YAMO-FIGU-011889', true),
  ('ZOLT-MESK-019652', 'ZOLT-MESK-011528', true);

-- Guard: a pid must never be both a shell and a canonical target, and the
-- expected population must be exactly 189.
DO $$
DECLARE n_overlap int; n_pairs int;
BEGIN
  SELECT count(*) INTO n_overlap FROM merge_map m WHERE m.shell_pid IN (SELECT canon_pid FROM merge_map);
  IF n_overlap <> 0 THEN RAISE EXCEPTION 'shell/canonical overlap: %', n_overlap; END IF;
  SELECT count(*) INTO n_pairs FROM merge_map;
  IF n_pairs <> 189 THEN RAISE EXCEPTION 'expected 189 pairs, got %', n_pairs; END IF;
END $$;

-- Ordering note. Every identifier column on `player` carries a UNIQUE index,
-- including `nfl_player_id` since 8405aa3e8. Copying an identifier from the
-- shell onto the canonical row while the shell still holds it puts two rows at
-- the same value for the duration of the statement, which the index rejects --
-- a rollback-only dry run caught exactly that on nfl_player_id 2500799
-- (AARO-GIBS-016538). So the shell rows are snapshotted, deleted, and only then
-- read back to fill the canonical. There is no window in which two rows share
-- an identifier.

-- Step 1. Snapshot the shell rows. Everything downstream reads from this copy,
-- not from `player`, so the shells can be deleted before any identifier moves.
CREATE TEMP TABLE shell_snapshot ON COMMIT DROP AS
SELECT p.* FROM player p JOIN merge_map m ON m.shell_pid = p.pid;

DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM shell_snapshot;
  IF n <> 189 THEN RAISE EXCEPTION 'expected 189 shell rows snapshotted, got %', n; END IF;
END $$;

-- Step 2. Preserve every non-null value held by each shell row into
-- player_changelog against the surviving canonical pid. This is what makes the
-- delete reversible from the database alone.
INSERT INTO player_changelog (pid, column_name, previous_value, new_value, source, reason, changed_at)
SELECT m.canon_pid, kv.key, kv.value #>> '{}', NULL,
  'adhoc/2026-08-04-dedupe-duplicate-person-rows',
  'preserved value from merged duplicate row ' || m.shell_pid,
  now()
FROM merge_map m
JOIN shell_snapshot s ON s.pid = m.shell_pid
CROSS JOIN LATERAL jsonb_each(to_jsonb(s)) kv
WHERE kv.value IS NOT NULL
  AND kv.value <> 'null'::jsonb
  AND kv.key NOT IN ('pid', 'name_search_vector');

-- Step 3. Record the merge itself, mirroring how the 2023 pid migration
-- recorded its rewrites.
INSERT INTO player_changelog (pid, column_name, previous_value, new_value, source, reason, changed_at)
SELECT m.canon_pid, 'pid', m.shell_pid, m.canon_pid,
  'adhoc/2026-08-04-dedupe-duplicate-person-rows',
  'duplicate-person row merged into canonical pid',
  now()
FROM merge_map m;

-- Step 4. Re-point every table keyed on a shell pid. Collision counts against
-- each unique index were probed and are zero.
UPDATE player_changelog t SET pid = m.canon_pid FROM merge_map m WHERE t.pid = m.shell_pid;
UPDATE keeptradecut_valuations t SET pid = m.canon_pid FROM merge_map m WHERE t.pid = m.shell_pid;
UPDATE player_contracts t SET pid = m.canon_pid FROM merge_map m WHERE t.pid = m.shell_pid;
UPDATE projections_index t SET pid = m.canon_pid FROM merge_map m WHERE t.pid = m.shell_pid;
UPDATE projections_history t SET pid = m.canon_pid FROM merge_map m WHERE t.pid = m.shell_pid;
UPDATE player_rankings_index t SET pid = m.canon_pid FROM merge_map m WHERE t.pid = m.shell_pid;
UPDATE player_rankings_history t SET pid = m.canon_pid FROM merge_map m WHERE t.pid = m.shell_pid;
UPDATE pff_player_seasonlogs t SET pid = m.canon_pid FROM merge_map m WHERE t.pid = m.shell_pid;
UPDATE practice t SET pid = m.canon_pid FROM merge_map m WHERE t.pid = m.shell_pid;
UPDATE pff_player_facet_seasonlogs t SET pid = m.canon_pid FROM merge_map m WHERE t.pid = m.shell_pid;

-- Step 5. Verify nothing still references a shell pid anywhere before deleting.
DO $$
DECLARE tbl text; n int;
BEGIN
  FOR tbl IN
    SELECT c.table_name FROM information_schema.columns c
    JOIN pg_tables t ON t.tablename = c.table_name AND t.schemaname = 'public'
    WHERE c.column_name = 'pid' AND c.table_schema = 'public' AND c.table_name <> 'player'
  LOOP
    EXECUTE format('SELECT count(*) FROM %I t JOIN merge_map m ON m.shell_pid = t.pid', tbl) INTO n;
    IF n > 0 THEN RAISE EXCEPTION 'table % still holds % shell rows', tbl, n; END IF;
  END LOOP;
END $$;

-- Step 6. Drop the shell rows, releasing their identifiers from every UNIQUE
-- index before those identifiers are written onto the canonical rows.
DELETE FROM player p USING merge_map m WHERE p.pid = m.shell_pid;

DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM player p JOIN merge_map m ON m.shell_pid = p.pid;
  IF n <> 0 THEN RAISE EXCEPTION 'shell rows survived delete: %', n; END IF;
END $$;

-- Step 7. Fill every column the canonical row is missing, from the snapshot.
-- Purely additive: coalesce never overwrites a value the canonical already
-- holds, so no adjudication between two competing non-null values happens here.
UPDATE player c SET
  tertiary_position = coalesce(c.tertiary_position, s.tertiary_position),
  height_inches = coalesce(c.height_inches, s.height_inches),
  weight_pounds = coalesce(c.weight_pounds, s.weight_pounds),
  date_of_birth = coalesce(c.date_of_birth, s.date_of_birth),
  forty_yard_dash_seconds = coalesce(c.forty_yard_dash_seconds, s.forty_yard_dash_seconds),
  bench_press_reps = coalesce(c.bench_press_reps, s.bench_press_reps),
  vertical_jump_inches = coalesce(c.vertical_jump_inches, s.vertical_jump_inches),
  broad_jump_inches = coalesce(c.broad_jump_inches, s.broad_jump_inches),
  shuttle_run_seconds = coalesce(c.shuttle_run_seconds, s.shuttle_run_seconds),
  three_cone_drill_seconds = coalesce(c.three_cone_drill_seconds, s.three_cone_drill_seconds),
  arm_length_inches = coalesce(c.arm_length_inches, s.arm_length_inches),
  hand_size_inches = coalesce(c.hand_size_inches, s.hand_size_inches),
  draft_overall_pick = coalesce(c.draft_overall_pick, s.draft_overall_pick),
  draft_round = coalesce(c.draft_round, s.draft_round),
  college = coalesce(c.college, s.college),
  college_division = coalesce(c.college_division, s.college_division),
  nfl_draft_year = coalesce(c.nfl_draft_year, s.nfl_draft_year),
  position_depth = coalesce(c.position_depth, s.position_depth),
  jersey_number = coalesce(c.jersey_number, s.jersey_number),
  draft_capital_points = coalesce(c.draft_capital_points, s.draft_capital_points),
  nfl_player_id = coalesce(c.nfl_player_id, case when m.carry_nfl_player_id then s.nfl_player_id end),
  esb_player_id = coalesce(c.esb_player_id, s.esb_player_id),
  gsis_player_id = coalesce(c.gsis_player_id, s.gsis_player_id),
  smart_player_id = coalesce(c.smart_player_id, s.smart_player_id),
  gsis_it_player_id = coalesce(c.gsis_it_player_id, s.gsis_it_player_id),
  high_school = coalesce(c.high_school, s.high_school),
  sleeper_player_id = coalesce(c.sleeper_player_id, s.sleeper_player_id),
  rotoworld_player_id = coalesce(c.rotoworld_player_id, s.rotoworld_player_id),
  rotowire_player_id = coalesce(c.rotowire_player_id, s.rotowire_player_id),
  sportradar_player_id = coalesce(c.sportradar_player_id, s.sportradar_player_id),
  espn_player_id = coalesce(c.espn_player_id, s.espn_player_id),
  fantasy_data_player_id = coalesce(c.fantasy_data_player_id, s.fantasy_data_player_id),
  yahoo_player_id = coalesce(c.yahoo_player_id, s.yahoo_player_id),
  keeptradecut_player_id = coalesce(c.keeptradecut_player_id, s.keeptradecut_player_id),
  pfr_player_id = coalesce(c.pfr_player_id, s.pfr_player_id),
  ngs_athleticism_score = coalesce(c.ngs_athleticism_score, s.ngs_athleticism_score),
  ngs_draft_grade = coalesce(c.ngs_draft_grade, s.ngs_draft_grade),
  nfl_grade = coalesce(c.nfl_grade, s.nfl_grade),
  ngs_production_score = coalesce(c.ngs_production_score, s.ngs_production_score),
  ngs_size_score = coalesce(c.ngs_size_score, s.ngs_size_score),
  otc_player_id = coalesce(c.otc_player_id, s.otc_player_id),
  contract_year_signed = coalesce(c.contract_year_signed, s.contract_year_signed),
  contract_years = coalesce(c.contract_years, s.contract_years),
  contract_value = coalesce(c.contract_value, s.contract_value),
  contract_apy = coalesce(c.contract_apy, s.contract_apy),
  contract_guaranteed = coalesce(c.contract_guaranteed, s.contract_guaranteed),
  contract_apy_cap_pct = coalesce(c.contract_apy_cap_pct, s.contract_apy_cap_pct),
  contract_inflated_value = coalesce(c.contract_inflated_value, s.contract_inflated_value),
  contract_inflated_apy = coalesce(c.contract_inflated_apy, s.contract_inflated_apy),
  contract_inflated_guaranteed = coalesce(c.contract_inflated_guaranteed, s.contract_inflated_guaranteed),
  pff_player_id = coalesce(c.pff_player_id, s.pff_player_id),
  mfl_player_id = coalesce(c.mfl_player_id, s.mfl_player_id),
  fleaflicker_player_id = coalesce(c.fleaflicker_player_id, s.fleaflicker_player_id),
  cbs_player_id = coalesce(c.cbs_player_id, s.cbs_player_id),
  cfbref_player_id = coalesce(c.cfbref_player_id, s.cfbref_player_id),
  twitter_username = coalesce(c.twitter_username, s.twitter_username),
  swish_player_id = coalesce(c.swish_player_id, s.swish_player_id),
  draftkings_player_id = coalesce(c.draftkings_player_id, s.draftkings_player_id),
  fanduel_player_id = coalesce(c.fanduel_player_id, s.fanduel_player_id),
  rts_player_id = coalesce(c.rts_player_id, s.rts_player_id),
  draft_team = coalesce(c.draft_team, s.draft_team),
  sis_player_id = coalesce(c.sis_player_id, s.sis_player_id),
  sis_prospect_grade = coalesce(c.sis_prospect_grade, s.sis_prospect_grade),
  sis_prospect_position_rank = coalesce(c.sis_prospect_position_rank, s.sis_prospect_position_rank),
  sis_prospect_overall_rank = coalesce(c.sis_prospect_overall_rank, s.sis_prospect_overall_rank),
  all_pro_first_team_selections = coalesce(c.all_pro_first_team_selections, s.all_pro_first_team_selections),
  pro_bowls_selections = coalesce(c.pro_bowls_selections, s.pro_bowls_selections),
  pfr_years_as_primary_starter = coalesce(c.pfr_years_as_primary_starter, s.pfr_years_as_primary_starter),
  pfr_weighted_career_approximate_value = coalesce(c.pfr_weighted_career_approximate_value, s.pfr_weighted_career_approximate_value),
  pfr_weighted_career_approximate_value_drafted_team = coalesce(c.pfr_weighted_career_approximate_value_drafted_team, s.pfr_weighted_career_approximate_value_drafted_team),
  ffpc_player_id = coalesce(c.ffpc_player_id, s.ffpc_player_id),
  nffc_player_id = coalesce(c.nffc_player_id, s.nffc_player_id),
  fantrax_player_id = coalesce(c.fantrax_player_id, s.fantrax_player_id),
  roster_status = coalesce(c.roster_status, s.roster_status),
  game_designation = coalesce(c.game_designation, s.game_designation),
  forty_yard_dash_designation = coalesce(c.forty_yard_dash_designation, s.forty_yard_dash_designation),
  ten_yard_split_seconds = coalesce(c.ten_yard_split_seconds, s.ten_yard_split_seconds),
  ten_yard_split_designation = coalesce(c.ten_yard_split_designation, s.ten_yard_split_designation),
  pro_day_forty_seconds = coalesce(c.pro_day_forty_seconds, s.pro_day_forty_seconds),
  pro_day_forty_designation = coalesce(c.pro_day_forty_designation, s.pro_day_forty_designation),
  sixty_yard_shuttle_seconds = coalesce(c.sixty_yard_shuttle_seconds, s.sixty_yard_shuttle_seconds),
  sixty_yard_shuttle_designation = coalesce(c.sixty_yard_shuttle_designation, s.sixty_yard_shuttle_designation),
  combine_attendance = coalesce(c.combine_attendance, s.combine_attendance),
  hometown = coalesce(c.hometown, s.hometown),
  sumer_player_id = coalesce(c.sumer_player_id, s.sumer_player_id),
  fantasylabs_player_id = coalesce(c.fantasylabs_player_id, s.fantasylabs_player_id),
  underdog_player_id = coalesce(c.underdog_player_id, s.underdog_player_id),
  fantasypoints_player_id = coalesce(c.fantasypoints_player_id, s.fantasypoints_player_id)
FROM merge_map m
JOIN shell_snapshot s ON s.pid = m.shell_pid
WHERE c.pid = m.canon_pid;

-- Step 8. Repair the sentinel 1974 draft year from the shell's true value.
-- 32 canonical rows claim 1974 against shells spanning 1957-1973; 1974 is a
-- default, not a draft class. Guarded on the shell year being consistent with
-- the canonical date of birth (entry at age 20 to 26), so a genuine 1974
-- entrant is never rewritten.
INSERT INTO player_changelog (pid, column_name, previous_value, new_value, source, reason, changed_at)
SELECT c.pid, 'nfl_draft_year', c.nfl_draft_year::text, s.nfl_draft_year::text,
  'adhoc/2026-08-04-dedupe-duplicate-person-rows',
  'sentinel 1974 draft year replaced with true value from merged duplicate row ' || m.shell_pid,
  now()
FROM merge_map m
JOIN shell_snapshot s ON s.pid = m.shell_pid
JOIN player c ON c.pid = m.canon_pid
WHERE c.nfl_draft_year = 1974
  AND s.nfl_draft_year IS NOT NULL
  AND s.nfl_draft_year <> 1974
  AND c.date_of_birth ~ '^[0-9]{4}-'
  AND s.nfl_draft_year - split_part(c.date_of_birth, '-', 1)::int BETWEEN 20 AND 26;

UPDATE player c SET nfl_draft_year = s.nfl_draft_year
FROM merge_map m
JOIN shell_snapshot s ON s.pid = m.shell_pid
WHERE c.pid = m.canon_pid
  AND c.nfl_draft_year = 1974
  AND s.nfl_draft_year IS NOT NULL
  AND s.nfl_draft_year <> 1974
  AND c.date_of_birth ~ '^[0-9]{4}-'
  AND s.nfl_draft_year - split_part(c.date_of_birth, '-', 1)::int BETWEEN 20 AND 26;
