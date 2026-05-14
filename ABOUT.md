---
title: League Repository Graph Entry
type: text
description: >-
  Graph entry point for the league (xo.football) codebase, mapping how this repo relates to
  user-base text/league system docs, task directory, and sibling repos (react-table).
base_uri: user:repository/active/league/ABOUT.md
created_at: '2026-05-13T16:05:02.284Z'
entity_id: fad7fc09-ef9c-4eba-b891-f81f7a4159f9
public_read: false
relations:
  - follows [[user:guideline/directory-markdown-standards.md]]
tags:
  - user:tag/league-xo-football.md
updated_at: '2026-05-13T16:05:02.284Z'
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
