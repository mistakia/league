module.exports = {
  apps: [
    {
      name: 'import-live-odds-worker',
      script: '/root/league/jobs/import-live-odds-worker.mjs',
      cwd: '/root/league',
      autorestart: true,
      min_uptime: '60s',
      max_restarts: 10,
      max_memory_restart: '1G',
      merge_logs: true,
      env_production: {
        NODE_ENV: 'production',
        // An explicit DEBUG is AUTHORITATIVE: enable_debug_namespaces() returns
        // early when it is set, so this list is the whole namespace set for the
        // process and a helper's instrumentation is unreachable unless named
        // here. (Before that helper, a module-scope debug.enable REPLACED the
        // set and the last import won regardless of this line.)
        // insert-prop-markets was missing, which made the entire prop
        // write path's telemetry dark in production: the per-batch line carrying
        // market count, selection-insert count and reaper deletes, the cache
        // prefetch sizes, and the run total have never been logged. That is the
        // shape worth avoiding for an instrument whose job is to show whether a
        // write is degrading -- and it is what left the 2026-08-03 batch-size
        // retune with only wall-clock insertion timings to be judged on, with no
        // row counts to normalize them against.
        // draftkings-tracking is listed separately on purpose: debug matches a
        // namespace exactly, so `draftkings` does NOT cover it. Its absence is
        // half of why draftkings_category_activity failed every write for ten
        // months in silence -- the per-write catch logged the Postgres error to
        // a namespace nothing had ever enabled.
        DEBUG:
          'import-live-odds-worker,draftkings,draftkings-tracking,pinnacle,prizepicks,insert-prop-markets,insert-prop-market-selections',
        // Declares the cadence of the three book arms to the runs ledger.
        // report_job forwards JOB_SCHEDULE/JOB_SCHEDULE_TYPE to
        // `base run report --schedule`, which is how every league CRONTAB job
        // gets its cadence -- the preamble sets them per line. A pm2 service has
        // no crontab line, so without these the three sources
        // (service:league-draftkings-odds, service:league-import-pinnacle-odds,
        // service:league-prizepicks-projections) reported no cadence at all and
        // check-stale-runs fell back to its flat 3-day window. A 4-hour arm that
        // stops is then invisible for three days, and the only other ledger
        // signal this worker emits is a 60s `alive` tick that stays green while
        // an individual arm is dead. That is why a PrizePicks arm that had not
        // cycled since a deploy had to be found by a hand-written probe.
        //
        // `every` rather than a cron expression because BOOKMAKER_CONFIG
        // throttles on an interval measured from the last run, not a wall clock.
        // An interval cadence is zone-independent by construction, so it
        // deliberately carries no timezone -- see the is_interval_cadence branch
        // in user-base cli/monitoring/check-stale-runs.mjs, where marking one
        // untimezoned would additionally force the flat 3-day window back on.
        //
        // One value covers all three arms because all three share this process
        // AND share the same 4-hour interval_ms. If a book's interval ever
        // diverges, this env var can no longer express it and the cadence has to
        // move to a per-source entry in user-base config/runs-source-cadence.json.
        JOB_SCHEDULE: '4h',
        JOB_SCHEDULE_TYPE: 'every',
        BASE_MACHINE_SLUG: 'digitalocean-0',
        BASE_INSTANCE_KEY_FILE: '/root/.base-instance-private.key',
        USER_BASE_DIRECTORY:
          process.env.USER_BASE_DIRECTORY ||
          `${process.env.HOME || '/root'}/.base-stub`
      }
    }
  ]
}
