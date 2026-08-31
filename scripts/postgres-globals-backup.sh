#!/bin/bash
# Dump the PostgreSQL cluster-global catalogs (roles, their passwords, their
# per-role settings, and role grants) and store the result sops/age-ENCRYPTED.
#
# WHY THIS EXISTS
# ---------------
# postgres-backup.sh runs `pg_dump` only. `pg_dump` is per-DATABASE and does not
# touch the cluster-global catalogs (`pg_authid`, `pg_db_role_setting`,
# `pg_auth_members`), so a bare-metal rebuild that restores the full dump
# reconstructs every row and still cannot connect: `league_writer` and
# `league_reader` do not exist, and neither do their passwords, their
# `GRANT pg_read_all_data`, or their `ALTER ROLE ... SET` values
# (`search_path`, `default_transaction_read_only`, and the 2026-08-04
# `log_min_duration_statement = 2000` profiling override). Those had to be
# recreated by hand from documentation, which is not a backup.
#
# WHY IT IS ENCRYPTED
# -------------------
# `pg_dumpall --globals-only` emits `ALTER ROLE ... PASSWORD 'SCRAM-SHA-256$...'`
# — the verifier for every login role on the cluster. That is credential
# material and must not sit plaintext-at-rest in a backup tree that replicates
# to base-storage, to base-storage-replica, and offsite to B2. So the artifact
# is sops/age-encrypted ON THIS HOST, before it is written into /root/backups,
# and only the ciphertext ever leaves. Recipients are declared in
# /root/league/.sops.yaml (league host + the operator workstation); base-storage
# stores the file and deliberately CANNOT read it, matching the
# compartmentalization of external-league-credentials-key.sops.json.
#
# The alternative — `--no-role-passwords` — was rejected: it turns the artifact
# into documentation of role NAMES and leaves the rebuild needing a manual
# password set coordinated with config-production.json, which is the same
# unrecoverable state this script exists to remove.
#
# THE ORACLE IS A PARSE, NOT A COUNT
# ----------------------------------
# Per user:guideline/surface-pipeline-failures.md, a file-exists / non-empty
# check is not an integrity oracle — a truncated dump satisfies it as readily as
# a whole one, which is exactly how league-backup-pull once reported success
# over a half-written archive. So this script DECRYPTS its own output and
# asserts the roles, the password clauses, the grants and the per-role settings
# a rebuild needs are all present in the ciphertext it just wrote. Every
# assertion is value-free: it counts matches and never prints a matched line, so
# no password verifier can reach the (synced, FTS-indexed) thread timeline or
# the cron log.
#
# Usage: postgres-globals-backup.sh   (no arguments; run as root from cron)

set -euo pipefail

run_start_ts=$(date +%s)

dump_dir="/root/backups"
output_file="$dump_dir/league-globals.sops.sql"
# LEAGUE_SOPS_CONFIG exists so this can be exercised against a candidate
# recipient policy before that policy is deployed into the /root/league checkout
# (the deploy tree is shared and a hand-edit there blocks every session's
# `yarn deploy`). Cron never sets it.
sops_config="${LEAGUE_SOPS_CONFIG:-/root/league/.sops.yaml}"

# The plaintext file's BASENAME is what sops matches against the creation_rules
# in $sops_config, so it must stay `league-globals.sql` — renaming it here
# silently detaches the recipient policy and sops fails with "no matching
# creation rules found" rather than encrypting to the wrong recipients.
plaintext_name="league-globals.sql"

# Everything a rebuild needs from the globals, asserted against the DECRYPTED
# artifact below. Extend this list when a role, grant or per-role setting is
# added — a new one that is not listed is still dumped, it just is not gated.
# Removing a live one makes this job fail loudly, which is the intended
# direction: a globals dump that quietly stopped carrying league_writer's
# password is the failure this script exists to prevent.
required_patterns=(
    '^CREATE ROLE league_writer;'
    '^CREATE ROLE league_reader;'
    '^ALTER ROLE league_writer WITH .*LOGIN.*PASSWORD '
    '^ALTER ROLE league_reader WITH .*LOGIN.*PASSWORD '
    '^ALTER ROLE league_writer SET search_path TO '
    '^ALTER ROLE league_writer SET log_min_duration_statement TO '
    '^ALTER ROLE league_reader SET default_transaction_read_only TO '
    '^ALTER ROLE league_reader SET log_min_duration_statement TO '
    '^GRANT pg_read_all_data TO league_reader'
    # The two scoped sandbox reader roles. Neither was gated when it was
    # created, so the artifact could have stopped carrying either one silently --
    # and these are the roles whose absence is hardest to notice, because the app
    # boots fine without them and only the data-view SQL tier and the
    # contribution reproduction path stop working. Their CONNECTION LIMIT is
    # part of the sandbox (server-side, unraisable from inside a session), so it
    # is gated too rather than left to be restored by hand.
    '^CREATE ROLE league_data_view_reader;'
    '^ALTER ROLE league_data_view_reader WITH .*LOGIN.*CONNECTION LIMIT .*PASSWORD '
    '^ALTER ROLE league_data_view_reader SET default_transaction_read_only TO '
    '^CREATE ROLE league_contribution_reader;'
    '^ALTER ROLE league_contribution_reader WITH .*LOGIN.*CONNECTION LIMIT .*PASSWORD '
    '^ALTER ROLE league_contribution_reader SET default_transaction_read_only TO '
    '^ALTER ROLE league_contribution_reader SET work_mem TO '
)

# Ciphertext at rest, but the plaintext exists for the duration of one dump and
# 0077 is what keeps it unreadable to anything but root in that window.
umask 077

mkdir -p "$dump_dir"

# Staging dir on the SAME filesystem as $output_file so the final install is a
# rename (atomic) rather than a copy — league-backup-pull reads this directory
# hourly and must never observe a partial artifact. Mirrors the .tmp discipline
# postgres-backup.sh uses for the user checkpoint.
work_dir=$(mktemp -d "$dump_dir/.globals.XXXXXXXX")

cleanup() {
    # shred the plaintext specifically (not just unlink) — it held every login
    # role's password verifier.
    if [ -f "$work_dir/$plaintext_name" ]; then
        shred -u "$work_dir/$plaintext_name" 2>/dev/null || rm -f "$work_dir/$plaintext_name"
    fi
    rm -rf "$work_dir"
}
trap cleanup EXIT

# Assert every required pattern is present on stdin. Value-free: `grep -c`
# reports a COUNT, and no branch here echoes a matched line. Reads stdin once
# into a variable rather than a temp file so the decrypted copy in the
# verification pass never touches disk at all.
assert_globals_complete() {
    local label="$1"
    local content
    content=$(cat)

    if [ -z "$content" ]; then
        echo "Error: $label is empty" >&2
        return 1
    fi

    local missing=0 pattern
    for pattern in "${required_patterns[@]}"; do
        if [ "$(printf '%s\n' "$content" | grep -c -E "$pattern" || true)" -eq 0 ]; then
            # The PATTERN is safe to print (it is this file's own literal); the
            # matched LINE never is, and is never printed anywhere.
            echo "Error: $label is missing required globals entry: $pattern" >&2
            missing=$((missing + 1))
        fi
    done

    if [ "$missing" -gt 0 ]; then
        echo "Error: $label failed the globals integrity oracle ($missing of ${#required_patterns[@]} required entries absent)" >&2
        return 1
    fi

    echo "$label passed the globals integrity oracle (${#required_patterns[@]}/${#required_patterns[@]} required entries present)"
    return 0
}

# --- Dump -------------------------------------------------------------------
# Superuser-only: pg_authid's password verifiers are not readable by
# league_writer, so a dump run as the app role would silently emit roles with no
# PASSWORD clause and pass every non-parsing oracle. Peer auth as the postgres
# OS user is why this runs under sudo rather than over TCP with a credential.
echo "Dumping cluster globals (roles, per-role settings, grants)"
if ! sudo -u postgres pg_dumpall --globals-only > "$work_dir/$plaintext_name"; then
    echo "Error: pg_dumpall --globals-only failed" >&2
    exit 1
fi

# Gate the PLAINTEXT before spending an encrypt on it, so a dump that came back
# short is reported as a dump failure rather than as a decrypt failure.
if ! assert_globals_complete "pg_dumpall output" < "$work_dir/$plaintext_name"; then
    exit 1
fi

# --- Encrypt ----------------------------------------------------------------
# --config is explicit because sops resolves .sops.yaml from the process CWD,
# not from the target file's directory, and cron's CWD is /root — from which the
# league creation_rules are invisible. See
# user:guideline/homelab/sops-age-authoring.md (the third friction observation).
echo "Encrypting globals to the league sops/age recipient set"
if ! sops --config "$sops_config" \
        --encrypt --input-type binary --output-type binary \
        "$work_dir/$plaintext_name" > "$work_dir/ciphertext"; then
    echo "Error: sops --encrypt failed for the globals dump" >&2
    exit 1
fi

# --- Verify the CIPHERTEXT round-trips --------------------------------------
# This, not the plaintext gate above, is the artifact oracle: it proves the file
# about to be installed is decryptable BY THIS HOST and still carries every
# entry a rebuild needs. An encrypt that succeeded against the wrong recipients,
# or a truncated write, fails here rather than three months from now in a
# recovery.
echo "Verifying the encrypted artifact decrypts and is complete"
if ! sops --config "$sops_config" \
        --decrypt --input-type binary --output-type binary \
        "$work_dir/ciphertext" \
        | assert_globals_complete "decrypted globals artifact"; then
    exit 1
fi

# --- Install ----------------------------------------------------------------
chmod 600 "$work_dir/ciphertext"
mv -f "$work_dir/ciphertext" "$output_file"

# Output oracle: the rename must have produced a non-empty file whose mtime is
# from THIS run. `set -e` plus the explicit checks above cover the throwing
# paths; this covers a silently-truncated or non-refreshed write, and matches
# the oracle postgres-backup.sh applies to its own artifacts. Exit 2 so
# job-wrapper.sh reports the run failed.
if [ ! -s "$output_file" ]; then
    echo "Error: globals artifact $output_file missing or empty after run" >&2
    exit 2
fi
file_mtime=$(stat -c %Y "$output_file")
if [ "$file_mtime" -lt "$run_start_ts" ]; then
    echo "Error: globals artifact $output_file mtime ($file_mtime) predates run start ($run_start_ts) -- the dump did not refresh the artifact" >&2
    exit 2
fi

echo "Wrote encrypted globals artifact: $output_file"
