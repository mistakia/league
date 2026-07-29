# Context Documents

Server-generated, self-contained markdown "context documents" for a league and
its teams. A user copies a stable URL from the team or league page and pastes it
into an agent session to load full, current context in a single fetch — rules,
standings, rosters, cap, and calendar — without navigating the SPA or making
authenticated API calls.

All league read data is already public (auth guards only mutations), so these
docs work for every league with no tokens.

## The documents

| Document        | URL                           | Contents                                                                  |
| --------------- | ----------------------------- | ------------------------------------------------------------------------- |
| Docs index      | `/docs.md`                    | Every published reference document and API surface, grouped and described |
| League index    | `/leagues/:lid.md`            | Identity, standings table, divisions, current phase, recent transactions  |
| League rules    | `/leagues/:lid/rules.md`      | Roster construction, scoring, cap/FAAB, extensions, franchise tags, RFA   |
| League schedule | `/leagues/:lid/schedule.md`   | Current-phase banner, full league calendar, playoffs, matchup grid        |
| League rosters  | `/leagues/:lid/rosters.md`    | Per-team cap summary and every team's roster, priced on a stated basis    |
| Rosters CSV     | `/leagues/:lid/rosters.csv`   | The same rows as `text/csv`, one row per rostered player                  |
| Team            | `/leagues/:lid/teams/:tid.md` | Manager, record, cap space, roster by slot, draft picks, schedule         |

Each is served at the human path plus a format suffix; `.md` returns
`text/markdown` and `.csv` returns `text/csv`. The routes live in
`api/routes/context-docs.mjs`, mounted after the static handlers and before the
SPA catch-all in `api/index.mjs` (they are NOT under `/api`). Generators live in
`libs-server/context-docs/`; the shared markdown primitives are in
`libs-server/context-docs/markdown.mjs`.

The rosters page and its CSV render from one loader (`rosters.mjs`), which is
also what the team doc prices its own roster from, so the three can never
disagree about roster state or salary.

## Documentation index and API

`/docs.md` is the platform-wide entry point, the sibling of the per-league
index: league state lives under `/leagues/`, and the reference material
explaining how that state is produced lives in `docs/`. The index is generated
by scanning `docs/` at request time and reading each file's own description —
entity frontmatter `title`/`description`, else the H1 and opening paragraph,
else a JSON schema's `title`/`description`. Nothing is transcribed, so the index
cannot drift from the documents, and a file added to `docs/` appears without
anyone editing the generator. `generate-docs-index.mjs` only declares grouping
(and a label where a file cannot describe itself); unplaced files fall into
"Other documents". A spec asserts every top-level file in `docs/` is listed.

The API is surfaced two ways because the explorer at `/api/docs/` is a browser
application an agent cannot read. `/api/docs/openapi.json` serves the same
specification as fetchable JSON, and that is what the index and the league
index link for programmatic readers.

The league index carries a "Documentation and API" section — the docs index,
both API surfaces, the data-view link workflow, the data-views system, and the
glossary — so an agent that enters at the root learns the query surface exists
without a second fetch. Every other league doc links the docs index from its
footer.

## URL rule: entity, sub-view, format

- An entity is `<path>.md` — `/leagues/1.md`, `/leagues/1/teams/5.md`.
- A named sub-view of an entity is `<path>/<view>.md` — `/leagues/1/rules.md`,
  `/leagues/1/schedule.md`.
- A machine-readable representation of the SAME resource is the same path under
  a different suffix — `/leagues/1/rosters.csv`. The suffix selects a format, it
  never selects different content; `doc_url(base_url, { lid, view, format })`
  builds both.

Sub-views are named for the reader: `rules.md` (not `settings.md`) describes the
format/scoring/cap/calendar content, versus the SPA's editing surface. Follow
this rule when adding new docs so the URL scheme stays predictable.

## Frontmatter and relation vocabulary

Every doc opens with YAML frontmatter carrying at least `type`, `generated_at`,
and `canonical_url`. Traversal uses a fixed relation vocabulary of fetchable
absolute URLs — `parent`, `children`, `related` — making the doc set a
traversable graph (the `base entity tree` analog) while remaining WebFetch-able
by an external agent. The league index is the root; its `children` are the team
docs; rules, schedule, and rosters are `related`. The rosters page also declares
the team docs as `children` (it is the other route to them) and carries its CSV
sibling as `csv_url` — a format alternate, not a graph edge, so it stays out of
the relation vocabulary.

## Self-sufficiency contract

Each doc carries enough for its level with no follow-up call required, while
staying compact (progressive disclosure). The league index summarizes
teams/standings and links to per-team docs (full rosters live there, not
inlined) and to the rosters page, which is the deliberate exception: it inlines
every roster because its purpose is the cross-team question that would otherwise
cost one fetch per team. Lifecycle states are first-class, not edge
cases:

- A league with no configured season for the year returns 404 ("season not yet
  configured"), never a degenerate doc.
- Offseason / week-0 with no matchups renders an explicit "no matchups scheduled
  yet" section.
- An empty roster (new team, pre-draft) renders empty slot groups with cap space
  equal to the full league cap.

Cap space is computed from a per-team `getRoster` source (its week-0 branch
populates the RFA `bid`), never from the userId-less league-wide rosters helper,
so figures are correct during the RFA/pre-extension window.

## Salary basis

A rostered contract carries two different numbers while the extension window is
open — the salary recorded on it, and the salary it will carry for the season
once extensions and tags are applied — so no doc may print a bare "Salary".
`Roster` decides which basis applies from
`libs-shared/is-before-extension-deadline.mjs` (the single definition of the
boundary), and `salary-basis.mjs` turns that one decision into the three forms
every salary-bearing surface renders:

- a year-labeled column header — `2026 Salary (post-extension)` while the
  window is open, `2026 Salary` once it closes;
- a prose note above the roster tables stating the basis, the deadline, and how
  extensions and each tag are priced;
- a machine-readable `salary_basis` (`post_extension` / `as_recorded`),
  `salary_year`, and `extension_deadline` in the frontmatter.

The team doc and the rosters page both render all three. The CSV cannot carry
frontmatter, so `salary_basis` and `salary_year` ride on every row instead — a
reader who fetched only the CSV still knows what the number means. Cap space
carries the same label wherever it appears, since it is summed from the same
figures. Transaction tables report an **Amount** — the salary recorded by
that transaction — which is never the contract's current salary; the docs say
so inline. The rules doc carries the mechanics (deadline, $5 per extension, tag
repricing) so a reader who fetched only that doc can interpret the numbers.

## Docs vs. API output-format boundary

These context docs are curated, self-contained, human/agent-readable summaries.
They are distinct from the API's `?export_format=` output-format convention
(`api/routes/data-views.mjs`), which serves raw filterable result sets as
csv/json/md/html. The full, filterable transaction log is served by the
transactions API markdown output-format, not inlined here — the league index
summarizes only the most recent transactions.

`rosters.csv` does not blur that line: it is a fixed, curated projection of one
context doc at a stable URL with no query parameters, not a filterable result
set. A request to slice or filter rosters belongs in a data view, not in a new
CSV route.

The directory is named `context-docs/`, following the repo's existing `docs/`
shorthand.
