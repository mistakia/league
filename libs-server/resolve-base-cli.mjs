import { accessSync, constants } from 'fs'
import { join } from 'path'

// Resolve the base CLI by absolute path, not as a bare `base` on PATH: the pm2
// worker process env does not include ~/.base/bin, so a bare spawn ENOENTs and
// every run report is silently lost. Mirrors base job-wrapper.sh's own
// absolute-path resolution. See user:text/base/machine-token-auth.md.
//
// PROBE THE CANDIDATES rather than hardcoding one. A single `/root/...` path is
// why league jobs scheduled on base-storage reported nowhere for eleven days:
// that host runs jobs as `user`, whose base lives at ~/bin/base, and /root
// there is not merely the wrong path but unreadable. The spawn ENOENTed into a
// catch that logs to a cron stderr nobody reads. It worked on the league host
// and on digitalocean-0 only because both happen to run as root, which is
// exactly the shape of a latent defect: correct everywhere it was tried.
//
// `accessSync` is the right probe precisely because it fails the same way for
// "absent" and "not executable by this uid" -- for a spawn those are one fact.
const CANDIDATES = () =>
  [
    process.env.BASE_CLI_PATH,
    '/root/.base/bin/base',
    process.env.HOME && join(process.env.HOME, '.base/bin/base'),
    process.env.HOME && join(process.env.HOME, 'bin/base')
  ].filter(Boolean)

/**
 * @returns {string|null} an executable base CLI path, or null if none is usable
 */
export const resolve_base_cli = () => {
  for (const candidate of CANDIDATES()) {
    try {
      accessSync(candidate, constants.X_OK)
      return candidate
    } catch {
      // Not present, or not executable by this uid. Either way, unusable.
    }
  }
  return null
}
