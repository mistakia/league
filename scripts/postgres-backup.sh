#!/bin/sh
set -e
set -x

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

/root/.google-drive-upload/bin/gupload -o $gz_file
rm $gz_file