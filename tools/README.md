# tools

Repo-wide **measurement** tooling that carries no pass/fail verdict.

This is the non-database sibling of `db/tools`. That directory is chartered for
durable _schema_ tooling; this one holds measurements about the code itself —
module structure, type-checking adoption, and anything else that informs where
effort pays without asserting that a build is broken.

The same prohibition applies, for the same reason: **nothing here may be wired
into CI.** These tools report large, expected numbers. A verdict attached to one
would produce a permanently red master, which defers every session's push to
`mistakia/league` rather than just yours. Gates live in `db/gates`.

| File                             | What it measures                                                                                |
| -------------------------------- | ----------------------------------------------------------------------------------------------- |
| `measure-cross-module-seams.mjs` | Object-key seams between modules — where renaming a producer's key silently yields `undefined`. |

## Every tool here must be able to fail

A measurement that cannot be shown to detect a known-present instance is
unvalidated, not clean. `measure-cross-module-seams.mjs` carries a
`self_validation` block anchored on a real defect and prints a loud stderr
warning when it stops finding it.

That check exists because the first version of that scan reported a confident
1,151 seams while being structurally blind to the one live defect it had been
built to find. The total looked entirely plausible. Only checking it against a
known instance exposed the gap.

So: when adding a tool here, anchor it on something you have verified is present,
and prove the anchor can go red by breaking the detection on purpose. If a tool's
anchor becomes stale because the code legitimately moved, re-anchor it on another
verified instance — never delete the check to make the tool quiet.
