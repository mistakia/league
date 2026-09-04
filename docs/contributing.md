# Contributing to xo.football

The README says we are seeking contributors. This is what that points at.

## Reporting a bug or suggesting a feature

Use the **Report a problem** link in the site menu. It is on every page, and it works whether or not you are signed in — the pages where things break most often (`/data-views`, `/plays`) are public, so the report path is too.

The dialog shows you exactly what it is about to send before it sends it. That includes the page you were on, your browser's viewport, the build you were running, and — for a data view — the view's configuration. You can see all of it, and you can drop the screenshot, before anything leaves your browser.

**What makes a report actionable:** what you expected, what happened instead, and the steps to make it happen again. A bug report without a reproduction cannot be accepted — not because we doubt you, but because nobody can verify a fix for something they cannot make happen.

## What happens next

1. **Received.** Your report is stored and queued.
2. **Triage.** It gets checked against known issues and open work, and is either accepted, merged into an existing report as a duplicate, sent back with questions, or declined.
3. **Questions, if needed.** At most three, drawn from a fixed set. They appear on your submission's page — the same link you got when you submitted.
4. **Outcome.** Accepted reports become tracked work. Where a fix ships, the submission records it.

**If you submitted while signed out, the link you get at submission time is the only way back to your report.** There is no email to resend it to, because we did not ask for one. Save it.

Signed-in submitters can find everything they have filed under `/contributions`.

## Two things that are out of bounds for contributions

**Dependency changes** — anything touching `package.json`, `yarn.lock`, or `.yarnrc.yml`. Adding a dependency is a supply-chain decision, and it is made deliberately or not at all.

**Schema changes** — anything under `db/adhoc/` or `db/schema.postgres.sql`. These run against the production database.

Both are enforced, not just requested: a contribution pull request touching either is refused by CI. The same applies to `.github/workflows/` and `.sops.yaml`.

If your idea genuinely needs one of these, say so in the report and explain why. It becomes a conversation rather than a patch.

## Feature ideas

Feature ideas are welcome and are ruled on by the maintainer alone, against what xo.football is deliberately for and deliberately not. A declined idea is recorded with the reason, so nobody has to re-argue it later and you get a real answer rather than silence.

Check the [roadmap](https://base.tint.space/task?tag=user%3Atag%2Fleague-xo-football.md) first — your idea may already be planned, in which case the question is timing, not fit. Signed out, the statuses are readable and most titles are not.

## Your data

The report body, any screenshot, and the captured context are stored in the application database. They are never copied into public issues or public replies.

You can ask for a submission to be deleted. Deletion redacts the content — body, context, screenshot — while keeping the record that the report existed and what was done about it, so work that shipped because of your report stays traceable.

## Talking to us

[Discord](https://discord.com/invite/azSX97Qj9Z) for questions and discussion. The report surface is for things that need tracking.
