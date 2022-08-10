#!/bin/sh
set -e
set -x

FULL=false
LOGS=false
STATS=true
CACHE=true

while getopts 'flsu' opt; do
    case $opt in
        f) FULL=true ;;
        c) CACHE=true ;;
        l) LOGS=true ;;
        s) STATS=true ;;
        u) USER=true ;;

        *) echo 'Error in command line parsing' >&2
    esac
done

DUMP_DIR="/root/backups"
DB_NAME="league_production"
DB_FILE="/root/.mysql/mysqldump.cnf"

DB_USER_TABLES="
draft
league_cutlist
leagues
matchups
playoffs
poach_releases
poaches
rosters
rosters_players
schedule
seasons
team_stats
teams
trade_releases
trades
trades_picks
trades_players
trades_transactions
transactions
transition_bids
transition_releases
users
users_sources
users_teams
waiver_releases
waivers"

DB_CACHE_TABLES="
league_baselines
league_player_projection_points
league_player_projection_values
league_team_forecast
league_team_lineup_contribution_weeks
league_team_lineup_contributions
league_team_lineup_starters
league_team_lineups
ros_projections"

DB_LOGS_TABLES="
jobs
player_changelog"

DB_STATS_TABLES="
footballoutsiders
gamelogs
keeptradecut_rankings
nfl_games
nfl_play_stats
nfl_plays
nflSnap
player
players
players_status
practice
projections
props
rankings
"

DATE_FORMAT="%Y-%m-%d_%H-%M"

file_name="$(date +$DATE_FORMAT)"
if $FULL; then
    backup_type="full"
elif $LOGS; then
    backup_type="logs"
elif $STATS; then
    backup_type="stats"
elif $CACHE; then
    backup_type="cache"
else
    backup_type="user"
fi
sql_file="$file_name-$backup_type.sql"
gz_file="$file_name-$backup_type.tar.gz"

# make sure that the folder exists
mkdir -p $DUMP_DIR
cd $DUMP_DIR

# run mysqlbackup, tar gz and delete sql file
if $FULL; then
    mysqldump --defaults-extra-file=$DB_FILE $DB_NAME > $sql_file
elif $LOGS; then
    mysqldump --defaults-extra-file=$DB_FILE $DB_NAME $DB_LOGS_TABLES > $sql_file
elif $STATS; then
    mysqldump --defaults-extra-file=$DB_FILE $DB_NAME $DB_STATS_TABLES > $sql_file
elif $CACHE; then
    mysqldump --defaults-extra-file=$DB_FILE $DB_NAME $DB_CACHE_TABLES > $sql_file
else
    mysqldump --defaults-extra-file=$DB_FILE $DB_NAME $DB_USER_TABLES > $sql_file
fi
tar -vcf $gz_file $sql_file
rm $sql_file

/root/.google-drive-upload/bin/gupload $gz_file
rm $gz_file
