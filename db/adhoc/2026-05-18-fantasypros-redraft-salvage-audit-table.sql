-- Phase B: forensic audit table for fantasypros redraft salvage.
--
-- Each row in player_rankings_history within the 92 buggy timestamps
-- (2024-08-28 .. 2025-08-31, source_id=FANTASYPROS, non-SF *_REDRAFT) gets
-- one row here recording the salvage decision (keep as ALL or relabel to OP),
-- the stage that made the call, the supporting signals, and a confidence
-- score. The script writes to this table in dry-run; the apply step joins
-- this table back to player_rankings_history and UPDATEs ranking_type for
-- rows where decision = 'OP'.

DROP TABLE IF EXISTS fp_redraft_salvage_audit;

CREATE TABLE fp_redraft_salvage_audit (
  -- row identity (matches player_rankings_history). (ts, type, pid, overall_rank)
  -- alone is not unique because two pair members can share overall_rank with
  -- different min/max/avg/std. Adding min+max disambiguates every in-scope row.
  timestamp        integer  NOT NULL,
  pid              varchar  NOT NULL,
  ranking_type     text     NOT NULL,
  overall_rank     integer  NOT NULL,
  min              integer  NOT NULL,
  max              integer  NOT NULL,
  pos              varchar  NOT NULL,
  year             smallint NOT NULL,

  -- decision
  decision         text     NOT NULL CHECK (decision IN ('ALL','OP')),
  stage            smallint NOT NULL,
  confidence       numeric  NOT NULL,

  -- signals captured for forensic review
  all_ref_rank     integer,
  op_ref_rank      integer,
  pair_partner_rank integer,        -- the other row's overall_rank when in a pair
  sleeper_all_rank  integer,        -- sleeper adp-derived rank, normal scoring
  sleeper_op_rank   integer,        -- sleeper adp-derived rank, SF scoring
  sleeper_ts        integer,
  ktc_value_1qb    integer,
  ktc_value_sf     integer,
  ktc_d            integer,
  notes            text,

  PRIMARY KEY (timestamp, ranking_type, pid, overall_rank, min, max)
);

CREATE INDEX fp_redraft_salvage_audit_decision_idx
  ON fp_redraft_salvage_audit (decision);
CREATE INDEX fp_redraft_salvage_audit_stage_idx
  ON fp_redraft_salvage_audit (stage);

\echo === audit table created ===
SELECT COUNT(*) AS row_count FROM fp_redraft_salvage_audit;
