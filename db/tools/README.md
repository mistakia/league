# db/tools

Durable schema tooling that must **never** carry a pass/fail verdict wired to a
run.

That prohibition is the entire reason this directory is separate from
`../gates`. Every file here has a specific, stated reason it cannot be a gate,
and wiring one in would produce a permanently red master — which defers **every**
session's push to `mistakia/league`, not just yours. The boundary is a directory
rather than a convention because a convention is exactly what a future session
would talk itself out of.

| File                               | Why it is not a gate                                                                                                                                                              |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `audit-schema-conformance.mjs`     | An ORACLE, not a verdict. Exits 1 by design on standing debt. `../gates/check-schema-conformance-ratchet.mjs` converts its output into a pass/fail against a checked-in baseline. |
| `scan-source-leakage.mjs`          | Advisory. A non-zero count is the EXPECTED state; its header states it must not be wired into a publish gate or CI.                                                               |
| `schema-partitions.mjs`            | Shared library. Derives partition-child membership from the dump for the audit and the inventory generator. No verdict at all.                                                    |
| `generate-migration-inventory.mjs` | Regenerates an inventory. Never hand-edit its output.                                                                                                                             |

## The ratchet split, since it is the one that looks redundant

`audit-schema-conformance.mjs` and `../gates/check-schema-conformance-ratchet.mjs`
read as two names for one thing and are not. The audit answers "what violates the
naming standard", and the honest answer is a large standing number that will
never be zero. The gate answers "did THIS change add to it", which is a question
with a correct answer of no.

Putting the audit in CI would fail every build forever. Putting the ratchet in
CI is exactly right, and it is there. The gate spawns the audit across the
directory boundary, which is explicit and intended.

Run the audit directly when you want the full picture; run the ratchet before
pushing anything that adds a table or column. The ratchet is CI-only from this
repo's perspective — no local suite, lint run, or SQL-validity gate exercises it,
so the first signal of a violation is a red master, and it takes about a second
to run yourself.

When the ratchet fires on a table you just added, that is new debt and the fix is
renaming the columns. **Never `--rebaseline`** — that is reserved for a deliberate
audit widening, and reaching for it buries a real regression landing in the same
window.
