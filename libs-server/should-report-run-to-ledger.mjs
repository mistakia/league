// Whether a run may write to the runs ledger.
//
// The ledger records this project's PRODUCTION pipelines, and every declared
// executor already says so in its own invocation. Verified across all of them:
// the 106 node lines in server/crontab-main/ and server/crontab-worker-1/ set
// NODE_ENV=production inline, and the three pm2 workers are reloaded with
// `--env production` (package.json load:main / load:worker1), which is what
// applies their env_production block -- confirmed live from `pm2 jlist` on both
// league and digitalocean-0, where all three report NODE_ENV=production. A run
// under any other environment is therefore not a pipeline execution at all: it
// is a developer or an agent invoking the code by hand, and it must reach
// neither the ledger nor the signal queue.
//
// The incident (signals 127954 / 127955, 2026-09-01). Two ad-hoc runs of
// import-nflverse-injuries and generate-historical-injury-index on a laptop
// loaded config-development.json, whose committed placeholder names a
// `league_development` role that exists on no host, and died at config load.
// Both reported the failure to the production ledger under the SAME
// `service:league-*` source key the league host's crontab reports under, and the
// oracle opened two real pipeline_failure signals carrying a run_host with no
// executor. That shape reads as a job running on the wrong host rather than as a
// mistyped command, and establishing otherwise cost a full triage arm. Both
// ledger rows had to be retired by hand.
//
// Gating on the environment rather than on an explicit executor marker is
// deliberate. A marker (JOB_EXECUTOR=cron, or similar) would be a truer
// statement of "a declared executor ran this", but it can only be declared in
// the crontab and the pm2 configs -- so if this code deployed and the crontab
// did not, every league source would stop reporting at once. That is the
// partial-deploy incident this repo keeps having, and its failure mode is a
// fleet-wide alarm storm. Reading NODE_ENV cannot silence a declared executor,
// because every declared executor already sets it.
//
// What this deliberately does NOT cover: an ad-hoc run that DOES set
// NODE_ENV=production (a hand-run production import from a laptop, which is a
// real practice here) still reports, and on a host with no crontab that creates
// a ledger row no schedule will ever refresh. That row goes stale and is cleaned
// up with `base run retire`, the same manual class it already belongs to.
// Closing it needs the executor marker above and its deploy-ordering risk.
//
// The environment is passed in rather than read here so the rule is testable
// without mutating process.env, which is global and would leak across specs.
export const should_report_run_to_ledger = ({ node_env }) =>
  node_env === 'production'
