#!/bin/sh
set -e
set -x

# Capture run start time so the post-tar oracle can confirm the output file
# was produced by this run (rather than a stale artifact from a prior run
# whose tar silently failed to overwrite).
run_start_ts=$(date +%s)

full=false
filename=""

while getopts 'fn:' opt; do
    case $opt in
        f) full=true ;;
        n) filename="$OPTARG" ;;
        *) echo 'Error in command line parsing' >&2
    esac
done

dump_dir="/root/backups"
db_name="league_production"
db_user="league_writer"
db_host="localhost"

# Tables whose DATA is excluded from the full dump (their schema/DDL is still
# dumped, so a full restore recreates them empty). These are large (~16 GB),
# derived, no-FK, no-consumer tables regenerated on demand by
# generate-prop-pairings.mjs; carrying their data into every full would bloat
# the dump, the B2 copy, and the replica snapshots for no recovery value.
# Mirrors the legacy mysql-backup.sh --ignore-table treatment.
full_exclude_data_tables="
prop_pairings
prop_pairing_props
"

# Parallel worker count for the full (-Fd) dump. Directory format lets pg_dump
# dump tables concurrently, using multiple CPUs. Default to (CPUs - 2) to leave
# headroom for the live API / DB backend on this shared host; override with the
# FULL_JOBS env var.
if [ -n "$FULL_JOBS" ]; then
    full_jobs="$FULL_JOBS"
else
    ncpu=$(nproc 2>/dev/null || echo 4)
    if [ "$ncpu" -gt 2 ]; then
        full_jobs=$((ncpu - 2))
    else
        full_jobs=1
    fi
fi

db_user_tables="
config
draft
league_cutlist
league_divisions
leagues
matchups
playoffs
poach_releases
poaches
rosters
rosters_players
schedule
seasons
league_team_seasonlogs
teams
trade_releases
trades
trades_picks
trades_players
trades_transactions
transactions
restricted_free_agency_bids
restricted_free_agency_releases
users
users_sources
users_teams
waiver_releases
waivers
placed_wagers
urls
user_data_views
league_user_careerlogs
league_team_careerlogs
invite_codes
"

date_format="%Y-%m-%d_%H-%M"

if [ -z "$filename" ]; then  # Check if filename is provided
    file_name="$(date +$date_format)"
else
    file_name="$filename"  # Use provided filename
fi

if $full; then
    backup_type="full"
else
    backup_type="user"
fi

# make sure that the folder exists
mkdir -p $dump_dir
cd $dump_dir

dump_tables() {
    tables=$1
    echo "Dumping tables: $tables"
    table_args=""
    for table in $tables; do
        table_args="$table_args -t $table"
    done
    pg_dump -h $db_host -U $db_user -d $db_name $table_args > $sql_file
    if [ $? -ne 0 ]; then
        echo "Error: pg_dump failed for tables: $tables"
        exit 1
    fi
}

if $full; then
    # Full whole-DB dump in DIRECTORY format (-Fd) with parallel workers (-j):
    # uses multiple CPUs to dump, is compressed, and is pg_restore -j
    # parallel-restorable. The artifact is a directory (toc.dat + per-table
    # *.dat.gz), not a single file -- no plain-SQL intermediate, no tar.
    output_file="$file_name-full"
    echo "Performing full backup (directory format, -j $full_jobs)"
    exclude_args=""
    for table in $full_exclude_data_tables; do
        exclude_args="$exclude_args --exclude-table-data=public.$table"
    done
    pg_dump -h $db_host -U $db_user -d $db_name -Fd -j "$full_jobs" $exclude_args -f "$output_file"
    if [ $? -ne 0 ]; then
        echo "Error: pg_dump -Fd failed for full backup" >&2
        exit 1
    fi
else
    # User dump: the small, irreplaceable, fast-changing slice. Stays plain-SQL
    # inside a .tar.gz so the two dev consumers (restore-backup.mjs,
    # import-database-backup.mjs) keep working unchanged.
    sql_file="$file_name-$backup_type.sql"
    output_file="$file_name-$backup_type.tar.gz"
    dump_tables "$db_user_tables"
    # Real gzip (-z), not a misnamed uncompressed tar: the .tar.gz name is now
    # honest, and both consumers extract with `tar -xzf` (explicit -z), which
    # only works against a genuinely gzipped archive on GNU tar.
    tar -vczf "$output_file" "$sql_file"
    rm "$sql_file"
fi

# Output oracle: confirm the run produced a non-empty artifact whose mtime is
# from this run. set -e + the explicit pg_dump checks earlier already cover the
# throwing paths, but a silently-truncated write (e.g. ENOSPC mid-write that
# doesn't propagate) would leave an empty or stale artifact behind. Exit 2 so
# the job-wrapper reports the run failed and the artifact is preserved as
# forensic state for the cleanup pass (the >7d find runs afterward). The full
# (-Fd) artifact is a directory whose table-of-contents (toc.dat) is the freshness
# witness; the user artifact is a single .tar.gz file.
if $full; then
    if [ ! -d "$output_file" ]; then
        echo "Error: backup output dir $output_file missing after run" >&2
        exit 2
    fi
    oracle_target="$output_file/toc.dat"
else
    if [ ! -f "$output_file" ]; then
        echo "Error: backup output $output_file missing after run" >&2
        exit 2
    fi
    oracle_target="$output_file"
fi
if [ ! -s "$oracle_target" ]; then
    echo "Error: backup output $oracle_target is empty" >&2
    exit 2
fi
file_mtime=$(stat -c %Y "$oracle_target")
if [ "$file_mtime" -lt "$run_start_ts" ]; then
    echo "Error: backup output $oracle_target mtime ($file_mtime) predates run start ($run_start_ts) -- the dump did not refresh the artifact" >&2
    exit 2
fi

# Local retention, user dumps: delete dated time-series user backups older than
# 7 days. Checkpoint files (checkpoint-*.tar.gz) are overwritten in place on each
# run, so only the latest checkpoint is retained automatically. base-storage pulls
# from this directory via rsync and owns long-term retention.
#
# Best-effort, and deliberately NOT allowed to gate the job's exit code: when a
# sibling backup instance runs its identical sweep concurrently, one process can
# unlink a file between this find's enumeration and its own -delete, so find
# exits non-zero on a benign "No such file or directory". The backup outcome is
# already established by the oracle above (dump + tar + mtime), so a retention
# race must not flip a healthy backup into a reported failure under `set -e`.
find "$dump_dir" -maxdepth 1 -type f -name "[0-9]*.tar.gz" -mtime +7 -delete || true

# Local retention, full dumps: keep the latest 2 *-full directories, delete older.
# The -Fd full is a DIRECTORY, so the -type f find above never touches it; this is
# its dedicated prune. Two fulls (one Tue, one Fri) is a rolling week of on-VPS
# whole-DB restorability; base-storage holds the 30-day window. Same best-effort
# discipline (|| true, race-tolerant) as the user sweep — the oracle already
# established this run's outcome, so a prune race must not fail the job.
full_dirs=$(ls -1dt "$dump_dir"/*-full 2>/dev/null || true)
if [ -n "$full_dirs" ]; then
    echo "$full_dirs" | tail -n +3 | while IFS= read -r stale_full; do
        [ -n "$stale_full" ] && rm -rf "$stale_full"
    done || true
fi
