-- Immutable player-id (pid) re-key -- correct legacy_pid to nullable (post-cutover fix).
--
-- DEFECT (found by the post-deploy mint smoke test, 2026-07-20): the cutover's
-- `RENAME COLUMN pid TO legacy_pid` inherited the old pid column's NOT NULL, so legacy_pid
-- landed NOT NULL. But legacy_pid is the demoted alternate key -- it must be NULLABLE: a
-- player minted AFTER the re-key never had an old pid, so create-player inserts a NULL
-- legacy_pid. With NOT NULL every new mint fails ("null value in column legacy_pid ...
-- violates not-null constraint"). The plan specified legacy_pid nullable + UNIQUE (nulls
-- distinct, so multiple future NULLs are allowed, which player_legacy_pid_key already is).
--
-- Safe, additive, instant: DROP NOT NULL only. Existing rows keep their legacy pid; the
-- UNIQUE index is unaffected (NULLs are distinct).

ALTER TABLE player ALTER COLUMN legacy_pid DROP NOT NULL;

-- Correct the stale column comment carried over from the old pid column by the rename.
COMMENT ON COLUMN player.legacy_pid IS 'pre-rekey player id, demoted alternate key (nullable; NULL for players minted after the re-key)';
