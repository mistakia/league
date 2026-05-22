#!/bin/sh
set -e
set -x

# Capture run start time so the post-tar oracle can confirm the output file
# was produced by this run (rather than a stale artifact from a prior run
# whose tar silently failed to overwrite).
run_start_ts=$(date +%s)

full=false
logs=false
stats=false
cache=false
projections=false
betting=false
filename=""

while getopts 'fclspbn:' opt; do
    case $opt in
        f) full=true ;;
        c) cache=true ;;
        l) logs=true ;;
        s) stats=true ;;
        p) projections=true ;;
        b) betting=true ;;
        n) filename="$OPTARG" ;;
        *) echo 'Error in command line parsing' >&2
    esac
done

dump_dir="/root/backups"
db_name="league_production"
db_user="league_user"
db_host="localhost"

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

db_cache_tables="
league_baselines
league_formats
league_scoring_formats
league_format_player_careerlogs
scoring_format_player_careerlogs
league_format_player_gamelogs
scoring_format_player_gamelogs
league_format_player_seasonlogs
scoring_format_player_seasonlogs
league_player_seasonlogs
scoring_format_player_projection_points
league_format_player_projection_values
league_format_draft_pick_value
league_player_projection_values
league_team_forecast
league_team_lineup_contribution_weeks
league_team_lineup_contributions
league_team_lineup_starters
league_team_lineups
ros_projections
league_nfl_team_seasonlogs
league_team_daily_values
nfl_team_seasonlogs
percentiles"

db_logs_tables="
jobs
player_changelog
nfl_games_changelog
play_changelog
"

db_stats_tables="
footballoutsiders
player_gamelogs
keeptradecut_rankings
nfl_games
nfl_play_stats
nfl_plays
nfl_snaps
player
player_aliases
players_status
practice
player_rankings_history
player_rankings_index
player_adp_index
player_adp_history
player_seasonlogs
pff_player_seasonlogs
pff_player_seasonlogs_changelog
espn_player_win_rates_history
espn_player_win_rates_index
espn_team_win_rates_history
espn_team_win_rates_index
nfl_plays_passer
nfl_plays_player
nfl_plays_receiver
nfl_plays_rusher
player_salaries
"

db_betting_tables="
props
props_index
props_index_new
prop_markets_history
prop_markets_index
prop_market_selections_history
prop_market_selections_index
"

db_projections_tables="
projections
projections_index
"

date_format="%Y-%m-%d_%H-%M"

if [ -z "$filename" ]; then  # Check if filename is provided
    file_name="$(date +$date_format)"
else
    file_name="$filename"  # Use provided filename
fi

if $full; then
    backup_type="full"
elif $logs; then
    backup_type="logs"
elif $stats; then
    backup_type="stats"
elif $betting; then
    backup_type="betting"
elif $cache; then
    backup_type="cache"
elif $projections; then
    backup_type="projections"
else
    backup_type="user"
fi
sql_file="$file_name-$backup_type.sql"
gz_file="$file_name-$backup_type.tar.gz"

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
    echo "Performing full backup"
    pg_dump -h $db_host -U $db_user -d $db_name > $sql_file
elif $logs; then
    dump_tables "$db_logs_tables"
elif $stats; then
    dump_tables "$db_stats_tables"
elif $betting; then
    dump_tables "$db_betting_tables"
elif $cache; then
    dump_tables "$db_cache_tables"
elif $projections; then
    dump_tables "$db_projections_tables"
else
    dump_tables "$db_user_tables"
fi

tar -vcf $gz_file $sql_file
rm $sql_file

# Output-file oracle: confirm the tar landed a non-empty file whose mtime is
# from this run. set -e + the explicit pg_dump check earlier already cover
# the throwing paths, but a silently-truncated tar (e.g. ENOSPC mid-write
# that doesn't propagate) would leave an empty or stale .tar.gz behind. Exit
# 2 so the job-wrapper reports the run failed and the file is preserved as
# forensic state for the cleanup pass (the >7d find runs afterward).
if [ ! -f "$gz_file" ]; then
    echo "Error: backup output $gz_file missing after tar" >&2
    exit 2
fi
if [ ! -s "$gz_file" ]; then
    echo "Error: backup output $gz_file is empty" >&2
    exit 2
fi
file_mtime=$(stat -c %Y "$gz_file")
if [ "$file_mtime" -lt "$run_start_ts" ]; then
    echo "Error: backup output $gz_file mtime ($file_mtime) predates run start ($run_start_ts) -- tar did not refresh the file" >&2
    exit 2
fi

# Local retention: delete ALL time-series backups older than 7 days (any type).
# Cleaning all types prevents stale files from other backup categories (which may
# run on different schedules) from persisting and being re-copied by rsync.
# Checkpoint files (checkpoint-*.tar.gz) are overwritten in place on each run, so
# only the latest checkpoint per type is retained automatically. Storage server
# pulls files from this directory via rsync and manages long-term retention.
find "$dump_dir" -maxdepth 1 -type f -name "[0-9]*.tar.gz" -mtime +7 -delete
