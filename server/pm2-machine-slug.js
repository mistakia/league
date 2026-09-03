// The machine slug a pm2 app reports its runs under.
//
// WHY IT IS NOT A LITERAL. Every pm2 config here used to name its own host --
// `league`, `digitalocean-0` -- and this repository is PUBLIC, so those are
// fleet topology published in the clear. The value is not league's to state
// anyway: each host declares its own identity in /etc/environment, which is
// authoritative and is already present in the non-interactive environment a
// `pm2 start` runs in (verified on both deploy hosts). Reading it there is both
// more correct and one fewer thing to keep in step with the fleet.
//
// WHY IT THROWS RATHER THAN INHERITING QUIETLY. An absent slug does not stop a
// worker; it makes it report its runs as nobody, and a job that runs correctly
// while writing nothing to the ledger is invisible for as long as nobody
// thinks to look -- eleven days, the last time this fleet paid for it. A throw
// here happens at `pm2 start` and stops the app from coming up at all, which is
// loud, immediate, and attributable. Fail-closed beats a silent ledger gap.
//
// NOTE FOR DEPLOYS: `pm2 reload` does NOT re-read a config file, so changing
// this affects a process only at the next delete-then-start. Running processes
// keep the environment they were started with.

module.exports = function require_machine_slug() {
  const slug = process.env.BASE_MACHINE_SLUG
  if (!slug) {
    throw new Error(
      'BASE_MACHINE_SLUG is not set in this environment, so this app would report its runs as nobody. It is declared per host in /etc/environment; this repository is public and does not carry hostnames. Refusing to start rather than run unreported.'
    )
  }
  return slug
}
