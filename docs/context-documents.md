# Context Documents

Server-generated, self-contained markdown "context documents" for a league and
its teams. A user copies a stable URL from the team or league page and pastes it
into an agent session to load full, current context in a single fetch — rules,
standings, rosters, cap, and calendar — without navigating the SPA or making
authenticated API calls.

All league read data is already public (auth guards only mutations), so these
docs work for every league with no tokens.

## The four documents

| Document        | URL                           | Contents                                                                 |
| --------------- | ----------------------------- | ------------------------------------------------------------------------ |
| League index    | `/leagues/:lid.md`            | Identity, standings table, divisions, current phase, recent transactions |
| League rules    | `/leagues/:lid/rules.md`      | Roster construction, scoring, cap/FAAB, franchise tags, RFA timing       |
| League schedule | `/leagues/:lid/schedule.md`   | Current-phase banner, full league calendar, playoffs, matchup grid       |
| Team            | `/leagues/:lid/teams/:tid.md` | Manager, record, cap space, roster by slot, draft picks, schedule        |

Each is served at the human path plus a `.md` suffix and returns
`text/markdown`. The routes live in `api/routes/context-docs.mjs`, mounted after
the static handlers and before the SPA catch-all in `api/index.mjs` (they are
NOT under `/api`). Generators live in `libs-server/context-docs/`; the shared
markdown primitives are in `libs-server/context-docs/markdown.mjs`.

## URL rule: entity vs. sub-view

- An entity is `<path>.md` — `/leagues/1.md`, `/leagues/1/teams/5.md`.
- A named sub-view of an entity is `<path>/<view>.md` — `/leagues/1/rules.md`,
  `/leagues/1/schedule.md`.

Sub-views are named for the reader: `rules.md` (not `settings.md`) describes the
format/scoring/cap/calendar content, versus the SPA's editing surface. Follow
this rule when adding new docs so the URL scheme stays predictable.

## Frontmatter and relation vocabulary

Every doc opens with YAML frontmatter carrying at least `type`, `generated_at`,
and `canonical_url`. Traversal uses a fixed relation vocabulary of fetchable
absolute URLs — `parent`, `children`, `related` — making the doc set a
traversable graph (the `base entity tree` analog) while remaining WebFetch-able
by an external agent. The league index is the root; its `children` are the team
docs; rules and schedule are `related`.

## Self-sufficiency contract

Each doc carries enough for its level with no follow-up call required, while
staying compact (progressive disclosure). The league index summarizes
teams/standings and links to per-team docs (full rosters live there, not
inlined). Lifecycle states are first-class, not edge cases:

- A league with no configured season for the year returns 404 ("season not yet
  configured"), never a degenerate doc.
- Offseason / week-0 with no matchups renders an explicit "no matchups scheduled
  yet" section.
- An empty roster (new team, pre-draft) renders empty slot groups with cap space
  equal to the full league cap.

Cap space is computed from a per-team `getRoster` source (its week-0 branch
populates the RFA `bid`), never from the userId-less league-wide rosters helper,
so figures are correct during the RFA/pre-extension window.

## Docs vs. API output-format boundary

These context docs are curated, self-contained, human/agent-readable summaries.
They are distinct from the API's `?export_format=` output-format convention
(`api/routes/data-views.mjs`), which serves raw filterable result sets as
csv/json/md/html. The full, filterable transaction log is served by the
transactions API markdown output-format, not inlined here — the league index
summarizes only the most recent transactions.

The directory is named `context-docs/`, following the repo's existing `docs/`
shorthand.
