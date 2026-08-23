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
        BASE_MACHINE_SLUG: 'digitalocean-0',
        BASE_INSTANCE_KEY_FILE: '/root/.base-instance-private.key',
        USER_BASE_DIRECTORY:
          process.env.USER_BASE_DIRECTORY ||
          `${process.env.HOME || '/root'}/.base-stub`
      }
    }
  ]
}
