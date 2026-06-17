---
title: League Repository Graph Entry
type: text
description: >-
  Graph entry point for the league (xo.football) codebase, mapping how this repo relates to
  user-base text/league system docs, task directory, and sibling repos (react-table).
base_uri: user:repository/active/league/ABOUT.md
created_at: '2026-05-13T16:05:02.284Z'
entity_id: fad7fc09-ef9c-4eba-b891-f81f7a4159f9
observations:
  - >-
    [bug] 2026-06-17 Data-views had a year_offset double-shift: resolve_nfl_week_params baked the
    offset into an explicit nfl_week_id list AND resolve-view-scope.mjs re-applied it, shifting the
    source window to base+2*offset while the outer join shifted by 1*offset, silently blanking the
    bottom offset-cohort of base years (e.g. a 2020-rookie WR lost their 2021 next-year value).
  - >-
    [fix] 2026-06-17 Fixed the year_offset double-shift via a single-application invariant:
    resolve_nfl_week_params sets year_offset_applied_to_nfl_week_id; resolve-view-scope.mjs
    re-applies the offset only to lists lacking that marker. Shipped in commit d46440cc, deployed to
    API.
  - >-
    [verification] 2026-06-17 Confirmed live on xo.football: Tee Higgins 2020 WR row now shows 15.58
    in the year_offset+1 DraftKings PPG column (was blank); CeeDee Lamb populated too.
  - >-
    [testing] 2026-06-17 Local test suite needs Postgres >= 15 (schema uses NULLS NOT DISTINCT); the
    official postgres image also lacks the postgres/league_user/league_readonly roles the schema
    GRANTs to. Recipe documented in repo CLAUDE.md Testing section.
  - >-
    [bug] player_adp and its sibling columns (adp_min/max/stddev/sample_size/percent_drafted)
    silently returned base-year ADP for any year_offset after the adp_type -> adp_format CTE-attach
    migration, because player_adp_source.attach() filtered the CTE to params.year and correlated the
    join to the unshifted year_reference; the anchored range-offset case additionally emitted
    invalid SQL referencing an unregistered CTE.
  - >-
    [fix] Commit a45281ab threads year_offset through the player_adp CTE-attach bridge by
    offset-expanding the CTE year filter (new offset_expanded_years helper), correlating the join
    through the offset via the existing emit_year_match primitive, decoupling CTE registration from
    join emission via register_ctes (so range-offset-with-no-where still materializes the CTE), and
    adding a declarative range_offset_aggregate per column (adp/percent_drafted AVG, min_pick MIN,
    max_pick MAX, sample_size SUM); verified against production (base-2024 +1 returns 2025 ADP,
    range [1,2] returns AVG not SUM).
  - >-
    [architecture] year_offset handling in data-views is duplicated across 8+ emitters
    (is_year_offset_range reimplemented inline, resolve_year_offset_range used in only 2 sites) with
    select-string trusting an un-asserted "CTE pre-filtered itself" contract; the long-term shape is
    one shared offset-correlation primitive consumed by every year-grained source plus a declarative
    per-column range aggregate, with the silent-loss-prone empty-year_predicate branch removed.
  - >-
    [followup] The same year_offset-drop bug class affects other CTE-attach year-grained sources not
    yet fixed -- player_projected_* and keeptradecut (range offset) silently drop the offset, and
    dozens of rate/rank/grade columns (PFF grades, rankings, nfl_team_seasonlogs rate stats, cpoe,
    time_to_throw) are summed across the offset window instead of averaged; each needs migration
    onto the offset primitive and a declared range_offset_aggregate, gated by result-equivalence.
public_read: false
relations:
  - follows [[user:guideline/directory-markdown-standards.md]]
tags:
  - user:tag/league-xo-football.md
updated_at: '2026-06-17T05:57:06.141Z'
user_public_key: 10ba842b1307fd60475b887df61ccc7e697970a2d222e7cbf011e51f5de3349b
---

## Purpose

This repository is the codebase for **xo.football** — an open-source platform for fantasy football league management, NFL analytics, DFS, and betting markets.

For public project overview and feature list, see [[README.md]]. For agent-facing build, deploy, and architecture conventions, see [[CLAUDE.md]].

## Context

Two domains of documentation cooperate:

- **In-repo** (`CLAUDE.md`, `README.md`, this file): development commands, code-level conventions, public-facing pitch.
- **User-base** ([[user:text/league/ABOUT.md]]): system infrastructure, data model, deploy topology, data sources, operational runbooks. Canonical for anything that isn't tied to a specific code path.

## Notable Context

**Tag**: [[user:tag/league-xo-football.md]] — entities related to the league system across code, tasks, and docs.

**Task directory**: [[user:task/league/]] — active work items for this codebase.

**Canonical system docs** in user-base (consult before duplicating into CLAUDE.md):

- [[user:text/league/league-system-architecture.md]] — overall topology and service layout
- [[user:text/league/league-server.md]] — main server configuration
- [[user:text/league/data-sources.md]] — external data integrations
- [[user:text/league/data-model-reference.md]] — database schema reference
- [[user:text/league/data-view-storage-architecture.md]] — custom data view persistence
- [[user:text/league/league-backup-system.md]] — backup posture
- [[user:text/league/landscape.md]] — domain landscape

**Sibling repositories**:

- [[user:repository/active/react-table/ABOUT.md]] — reusable React table component used by the data-view UI

**Governing guidelines**:

- [[user:guideline/directory-markdown-standards.md]] — structure for this file
- [[user:guideline/single-source-of-truth.md]] — system docs above are canonical; CLAUDE.md links to them rather than restating

## Scope

**Belongs in this repo**: app code, build/deploy scripts, in-repo tests, dev commands, code-level conventions.

**Belongs in user-base**:

- Infrastructure, deploy topology, data model reference → `text/league/`
- Open work, planned features, bugs → `task/league/`
- Constitution amendments and league-specific operational records → user-base
