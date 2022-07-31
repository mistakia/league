#!/bin/sh
set -e
set -x

FULL=false
LITE=false

while getopts 'fl' opt; do
    case $opt in
        f) FULL=true ;;
        l) LITE=true ;;
        *) echo 'Error in command line parsing' >&2
    esac
done

DUMP_DIR="/root/backups"
DB_NAME="league_production"
DB_FILE="/root/.mysql/mysqldump.cnf"
DB_TABLES="draft leagues matchups playoffs poaches poach_releases rosters rosters_players seasons team_stats teams trades trade_releases trades_picks trades_players trades_transactions transactions users users_sources users_teams waivers waiver_releases league_cutlist transition_bids transition_releases"
DB_LITE_TABLES="draft footballoutsiders gamelogs league_baselines league_player_projection_points league_player_projection_values league_team_forecast league_team_lineup_contribution_weeks league_team_lineup_contributions league_team_lineup_starters league_team_lineups leagues matchups nfl_games nfl_play_stats player player_changelog players playoffs poaches poach_releases rosters rosters_players seasons team_stats teams trades trade_releases trades_picks trades_players trades_transactions transactions users users_sources users_teams waivers waiver_releases league_cutlist transition_bids transition_releases"
DATE_FORMAT="%Y-%m-%d_%H-%M"

file_name="$(date +$DATE_FORMAT)"
if $FULL; then
    backup_type="full"
elif $LITE; then
    backup_type="lite"
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
elif $LITE; then
    mysqldump --defaults-extra-file=$DB_FILE $DB_NAME $DB_LITE_TABLES > $sql_file
else
    mysqldump --defaults-extra-file=$DB_FILE $DB_NAME $DB_TABLES > $sql_file
fi
tar -vcf $gz_file $sql_file
rm $sql_file

/root/.google-drive-upload/bin/gupload $gz_file
rm $gz_file
