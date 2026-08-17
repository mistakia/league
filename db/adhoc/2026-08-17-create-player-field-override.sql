-- STATUS: APPLIED 2026-08-17 against league_production
--
-- Create player_field_override: the durable record of a HUMAN VERDICT about a
-- single (pid, column_name), carrying the adjudicated value and its provenance.
--
-- Why this table exists. Nearly every column on `player` is learned from an
-- external provider -- Sleeper, nflverse, the NFL feed, PFF, NGS. When a
-- provider is wrong and a person establishes the truth, there has until now
-- been no way to record that verdict so it survives the next import. The
-- correction is applied as a one-row UPDATE and the next run of the importer
-- that learns that field either overwrites it, or is refused by a guard that
-- knows nothing about the adjudication and would have refused any write.
--
-- Two things measured against the live table on 2026-08-17 are the whole
-- requirement in miniature:
--
--   * Fourteen adjudicated writes (8 date_of_birth, 6 sleeper_player_id) are
--     present in `player` and NONE of them appears in player_changelog. They
--     were applied outside updatePlayer, so nothing records who decided them,
--     against which source, or on what date.
--   * Two writes recorded as applied and "verified by read-back" were never
--     applied: JORD-MURR-006621 still held 8106 and SEAN-RYAN-027249 still held
--     5834. Because the intended values existed only as prose, nothing could
--     detect the gap, and it was found by hand months of importer runs later.
--
-- An unattributed correction is unfalsifiable, and a correction whose intended
-- value is not machine-readable cannot be checked. This table makes both
-- detectable.
--
-- Why not player_changelog. It is the right home for the TRAIL and the wrong
-- home for the VERDICT. It is an append-only audit of what happened, 67.9M rows
-- as of today with 67.8M of them from `sleeper`, so using it as the policy means
-- inferring present intent from a sequence of past events -- a rule with no
-- single answer after two conflicting corrections. Decisively: a correction that
-- was never applied writes NO changelog row at all, so the audit log is
-- structurally blind to the exact failure observed above. updatePlayer keeps
-- writing the trail there, unchanged.
--
-- Why the VALUE and not a pin. A pin -- a flag freezing the field without
-- saying what it should hold -- is refuted by the case that motivated this.
-- A pin on JORD-MURR-006621.sleeper_player_id would have frozen 8106, the WRONG
-- value, permanently and undetectably. Storing the intended 11493 is what lets
-- the reconciliation check in db/checks/registry.mjs assert that every override
-- equals its live `player` value.
--
-- This is NOT a second source of truth. `player` still holds the value every
-- consumer reads; nothing reads this table except updatePlayer's veto and that
-- check. It is a declaration plus provenance, and the check is what keeps it
-- from drifting.
--
-- override_value is NULLABLE and the ROW'S EXISTENCE is the override. Three of
-- the pending repairs are CLEARS -- REGG-BROW-019194 must hold no
-- sleeper_player_id, because 12169 belongs to a James Madison WR who has no row
-- here. With the primary key on (pid, column_name) there is no ambiguity: the
-- row present means adjudicated, and NULL means adjudicated to be empty.
--
-- Provenance is enforced by CONSTRAINT and not only by the writer. NOT NULL
-- alone accepts the empty string, and a rule that lives only in JavaScript is
-- bypassed by the first hand-written INSERT -- which is precisely how the
-- fourteen unattributed writes happened.
--
-- See user:task/league/design-durable-external-provider-overrides.md.

CREATE TABLE public.player_field_override (
    pid character varying(25) NOT NULL,
    column_name text NOT NULL,
    -- The adjudicated value, as text, in the same spelling `player` holds it.
    -- NULL means adjudicated to be empty; the row's existence is the override.
    override_value text,
    -- The provider being overridden, so a future reader knows which feed was
    -- wrong rather than only that something was.
    provider_name text NOT NULL,
    adjudicated_by text NOT NULL,
    adjudicated_at timestamp with time zone NOT NULL,
    -- The independent evidence the verdict rests on, not the provider that was
    -- wrong. These are different questions and collapsing them loses the one
    -- that lets the verdict be revisited.
    evidence_source text NOT NULL,
    reason text NOT NULL,
    CONSTRAINT player_field_override_pkey PRIMARY KEY (pid, column_name),
    -- Provenance is mandatory at write time, the way updatePlayer already
    -- rejects a changelog write with no source.
    CONSTRAINT player_field_override_provenance_present CHECK (
        length(btrim(provider_name)) > 0
        AND length(btrim(adjudicated_by)) > 0
        AND length(btrim(evidence_source)) > 0
        AND length(btrim(reason)) > 0
    ),
    -- Mirrors excluded_props in libs-server/update-player.mjs. An override on
    -- the row's own key is not a verdict about anything, and formatted_name is
    -- derived rather than learned, so neither can be adjudicated. Held here as
    -- well as in the writer because the writer is not the only way in.
    CONSTRAINT player_field_override_column_name_writable CHECK (
        column_name NOT IN ('pid', 'formatted_name')
    )
);

COMMENT ON TABLE public.player_field_override IS
    'Human verdicts about a single (pid, column_name) that must survive re-import. Declared and applied together by libs-server/set-player-field-override.mjs; enforced as a per-field veto in libs-server/update-player.mjs; reconciled against live `player` values by the player-field-override-drift data check. Not a read path -- `player` remains the only value consumers read.';
