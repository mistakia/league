#!/bin/sh
set -e
set -x

DUMP_DIR="/root/backups"
DB_NAME="league_production"
DB_FILE="/root/.mysql/mysqldump.cnf"
DB_TABLES="draft leagues matchups poaches rosters rosters_players teams trades trades_drops trades_picks trades_players trades_transactions transactions users users_sources users_teams waivers"
DATE_FORMAT="%Y-%m-%d_%H"

file_name="$(date +$DATE_FORMAT)"
sql_file="$file_name.sql"
gz_file="$file_name.tar.gz"

# make sure that the folder exists
mkdir -p $DUMP_DIR
cd $DUMP_DIR

# run mysqlbackup, tar gz and delete sql file
mysqldump --defaults-extra-file=$DB_FILE $DB_NAME $DB_TABLES > $sql_file
tar -zvcf $gz_file $sql_file
rm $sql_file

/root/.google-drive-upload/bin/gupload $gz_file
rm $gz_file
