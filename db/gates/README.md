# db/gates

Durable consistency gates for schema and rename clusters, plus the adjudication
and baseline files they read.

**Two things make a file belong here: it produces a pass/fail verdict, and it is
in the `scripts/check-cluster-gates.mjs` manifest.** Both halves are required. A
checker with a verdict that no runner invokes is a gate nobody runs, which is
this repo's documented recurring failure rather than a hypothetical one — the
2026 plays/snaps cluster silently dropped filters on 45 saved views, and the
verdict on it was that what was missing was running the check at all.

Something durable that must NOT carry a verdict belongs in `../tools`. Something
whose cluster has closed belongs in `../archive`. See [../README.md](../README.md).

## The list lives in the manifest, not here

`yarn check:cluster --list` prints every gate with its prerequisite and its
oracle. That is authoritative and is deliberately not restated in prose anywhere,
so it cannot drift out of agreement with what actually runs.

Run them as one command — `yarn check:cluster`, adding `--base <pre-cluster-ref>`
to include the gates that diff against a base revision.

## Conventions for a gate in this directory

**Its state file lives beside it.** A gate's adjudications or baseline is
meaningless without the gate, and a gate whose suppressions live somewhere else
is a gate whose suppressions nobody can find. `check-rename-alias-residue.mjs`
and `rename-alias-residue-adjudications.json` move together, always.

**Adjudicate per SITE, never per name.** Every adjudication file here is keyed on
a tuple that includes the file — `(table, column, file)` or `(path, table,
column)` — with a required reason. A name-keyed entry is a stoplist, and the
stoplist is what hid `scoring_format_player_projection_points.total` from
`check-renamed-column-consumers` while it returned 129 findings over a rename
that wiped a year of projection values. Never quiet a gate by name.

**An adjudication that suppresses nothing is itself a finding.** A repaired site
forces its entry out rather than leaving a standing exemption for the name.
Gates that do not enforce this yet should grow it.

**Carry an always-on negative control, and inject rather than monkeypatch.** A
control that STAYS GREEN must fail the run; the runner enforces this from
outside, so declaring a control in the manifest and not printing one is a BLIND
verdict. Inject the file reader as a parameter with a default — an ESM namespace
object is frozen, so a control that patches `fs.readFileSync` silently does
nothing and then reports a green it never earned. That is a control failing OPEN,
the one direction a control must never fail.

**A SILENT control whose mutation plants one token while its assertion watches
for another passes over anything.** It is the same failing-open shape, reached
without any monkeypatching: the mutation lands, the gate is asked whether it
reported `<sentinel>`, and the answer is no for the trivial reason that
`<sentinel>` was never planted — so the control reads STAYED SILENT against a
gate that reports every occurrence of the shape. Caught 2026-08-18 on the
file-extension control in `check-renamed-column-consumers` gate 1, whose
mutation plants `'<table>.csv'` while the shared assertion looked for
`zzz_control_absent`. The check is mechanical: every silent control must be made
to FAIL by removing the exclusion it covers, one exclusion at a time. A silent
control that cannot be made to fail is not a control.

**Call `main()` bare; do not guard on `is_main`.** These are run by hand from a
relative path, and `is_main` compares `process.argv[1]` VERBATIM against the
resolved module path — so a guarded call silently does nothing and exits 0.

**Print outcomes with `console.log`, not `debug`.** Namespace resolution is a
runtime negotiation with the whole ESM import graph; a gate's verdict must not
depend on winning it.

**An unresolvable base ref is a hard failure, not a pass.**
`check-renamed-column-consumers.mjs` exits 0 with `GATE OK` on a base ref git
cannot resolve, printing one `SKIPPED` line — so a typo reads as a passed gate
from every angle except that line. Do not reproduce that shape.
`check-rename-alias-residue.mjs` exits 2. The runner independently resolves the
ref and treats an unresolvable one as a missing prerequisite.

## Mostly not in CI, on purpose

Only the gates that compare a spec or the schema file against ITSELF are
CI-eligible: they cannot go red on a sibling's in-flight migration.
`check-renamed-column-consumers --gate 1`, `check-knex-column-resolution` and the
conformance ratchet are in CI for that reason. The knex resolver qualifies on the
same test: it resolves each column reference through the statement that binds it
against the current schema file, so it carries no rename list and no base ref.

Everything else stays out. Those gates read the WORKING TREE and diff against a
base ref, and their findings need per-site adjudication by someone who knows what
the cluster did — a judgment CI cannot make. The cost of getting this wrong is
not local: a red master makes the sync-all pre-push guard defer **every** push to
`mistakia/league`, so unrelated sessions pile up behind a failure invisible in
their diffs.

When the shared tree is dirty, run from a clean worktree at your HEAD. A sibling
mid-cluster turns these red on findings belonging to nobody in your push.
