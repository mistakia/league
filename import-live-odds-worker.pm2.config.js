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
        // debug.enable REPLACES the namespace set rather than adding to it, so a
        // helper's instrumentation is unreachable unless its namespace is named
        // here. insert-prop-markets was missing, which made the entire prop
        // write path's telemetry dark in production: the per-batch line carrying
        // market count, selection-insert count and reaper deletes, the cache
        // prefetch sizes, and the run total have never been logged. That is the
        // shape worth avoiding for an instrument whose job is to show whether a
        // write is degrading -- and it is what left the 2026-08-03 batch-size
        // retune with only wall-clock insertion timings to be judged on, with no
        // row counts to normalize them against.
        DEBUG:
          'import-live-odds-worker,draftkings,pinnacle,prizepicks,insert-prop-markets,insert-prop-market-selections',
        BASE_MACHINE_SLUG: 'digitalocean-0',
        BASE_INSTANCE_KEY_FILE: '/root/.base-instance-private.key',
        USER_BASE_DIRECTORY:
          process.env.USER_BASE_DIRECTORY ||
          `${process.env.HOME || '/root'}/.base-stub`
      }
    }
  ]
}
