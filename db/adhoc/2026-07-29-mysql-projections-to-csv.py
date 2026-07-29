#!/usr/bin/env python3
"""Convert MySQL-era `projections` / `projections_archive` INSERT statements to CSV.

Source: the `2023-11-29_04-00-full` dump held at
`base-storage:/storage/backups/servers/league-production/archive/`, which is the
only surviving artifact carrying 2020-2023 projection history. The MySQL to
Postgres migration carried neither `projections_archive`'s 2020-2022 nor
`projections`' 2023, so live history restarts at 2024-07-16.

This emits CSV for a Postgres staging table; pid resolution and the load into
`projections_history` are done in SQL by the companion
`2026-07-29-backfill-projections-history.sql`.

Three semantic notes, all load-bearing:

1. `snp` is DISCARDED. The column was dropped from Postgres in 2026-05 and has
   no target to land in.

2. `season_type` does not exist in the source. MySQL-era `projections` carried
   no season-type discriminator at all -- its unique key was
   (sourceid, pid, userid, timestamp, week, year). Postseason projections are
   therefore NOT separable from regular-season ones and every recovered row
   loads as REG. A 2023 POST week-1 projection is indistinguishable from a REG
   week-1 projection in this data and will be attributed to REG.

3. `pid` is the pre-rekey content-derived id (`FNAM-LNAM-<draft_year>-<dob>`),
   emitted here verbatim as `legacy_pid`. Resolution to the current opaque
   serial pid happens in SQL.

Usage:
    python3 2026-07-29-mysql-projections-to-csv.py <region.sql> <out.csv>
"""

import csv
import re
import sys

# Source column order, identical for `projections` and `projections_archive`
# (verified by diffing both CREATE TABLE blocks in the dump).
SOURCE_COLUMNS = [
    'pid', 'sourceid', 'userid', 'pa', 'pc', 'py', 'ints', 'tdp', 'ra', 'ry',
    'tdr', 'trg', 'rec', 'recy', 'tdrec', 'fuml', 'snp', 'twoptc', 'week',
    'year', 'timestamp', 'fgm', 'fgy', 'fg19', 'fg29', 'fg39', 'fg49', 'fg50',
    'xpm', 'dsk', 'dint', 'dff', 'drf', 'dtno', 'dfds', 'dpa', 'dya', 'dblk',
    'dsf', 'dtpr', 'dtd', 'krtd', 'prtd'
]

# Pre-conform vocabulary -> current Postgres names. `snp` is absent by design.
COLUMN_MAP = {
    'pid': 'legacy_pid',
    'sourceid': 'sourceid',
    'userid': 'userid',
    'pa': 'passing_attempts',
    'pc': 'passing_completions',
    'py': 'passing_yards',
    'ints': 'passing_interceptions',
    'tdp': 'passing_touchdowns',
    'ra': 'rushing_attempts',
    'ry': 'rushing_yards',
    'tdr': 'rushing_touchdowns',
    'trg': 'targets',
    'rec': 'receptions',
    'recy': 'receiving_yards',
    'tdrec': 'receiving_touchdowns',
    'fuml': 'fumbles_lost',
    'twoptc': 'two_point_conversions',
    'week': 'week',
    'year': 'season_year',
    'timestamp': 'generated_at',
    'fgm': 'field_goals_made',
    'fgy': 'field_goal_yards',
    'fg19': 'field_goals_made_0_19_yards',
    'fg29': 'field_goals_made_20_29_yards',
    'fg39': 'field_goals_made_30_39_yards',
    'fg49': 'field_goals_made_40_49_yards',
    'fg50': 'field_goals_made_50_plus_yards',
    'xpm': 'extra_points_made',
    'dsk': 'defensive_sacks',
    'dint': 'defensive_interceptions',
    'dff': 'defensive_forced_fumbles',
    'drf': 'defensive_recovered_fumbles',
    'dtno': 'defensive_three_and_outs',
    'dfds': 'defensive_fourth_down_stops',
    'dpa': 'defensive_points_against',
    'dya': 'defensive_yards_against',
    'dblk': 'defensive_blocked_kicks',
    'dsf': 'defensive_safeties',
    'dtpr': 'defensive_two_point_returns',
    'dtd': 'defensive_touchdowns',
    'krtd': 'kickoff_return_touchdowns',
    'prtd': 'punt_return_touchdowns'
}

KEEP_INDEXES = [i for i, c in enumerate(SOURCE_COLUMNS) if c != 'snp']
OUTPUT_COLUMNS = [COLUMN_MAP[SOURCE_COLUMNS[i]] for i in KEEP_INDEXES]

INSERT_RE = re.compile(r'^INSERT INTO `(projections|projections_archive)` VALUES ')

# MySQL string escapes as emitted by mysqldump.
UNESCAPE = {
    '0': '\0', "'": "'", '"': '"', 'b': '\b', 'n': '\n', 'r': '\r',
    't': '\t', 'Z': '\x1a', '\\': '\\', '%': '%', '_': '_'
}


def parse_tuples(payload):
    """Yield one list of python values per `(...)` tuple in a VALUES payload.

    Hand-rolled rather than split(',') because a quoted value may legally
    contain commas, parens, or escaped quotes. Values are emitted as raw
    strings, or None for SQL NULL.
    """
    i = 0
    n = len(payload)
    while i < n:
        # advance to the opening paren of the next tuple
        while i < n and payload[i] != '(':
            if payload[i] == ';':
                return
            i += 1
        if i >= n:
            return
        i += 1  # consume '('

        row = []
        field = []
        in_string = False
        while i < n:
            ch = payload[i]
            if in_string:
                if ch == '\\':
                    nxt = payload[i + 1]
                    field.append(UNESCAPE.get(nxt, nxt))
                    i += 2
                    continue
                if ch == "'":
                    # doubled '' is a literal quote
                    if i + 1 < n and payload[i + 1] == "'":
                        field.append("'")
                        i += 2
                        continue
                    in_string = False
                    i += 1
                    continue
                field.append(ch)
                i += 1
                continue

            if ch == "'":
                in_string = True
                field.append('\x00STR')  # mark as string-typed
                i += 1
                continue
            if ch == ',':
                row.append(''.join(field))
                field = []
                i += 1
                continue
            if ch == ')':
                row.append(''.join(field))
                i += 1
                break
            field.append(ch)
            i += 1

        yield [None if v.strip() == 'NULL' else v.replace('\x00STR', '')
               for v in row]


def main():
    if len(sys.argv) != 3:
        print(__doc__)
        return 1

    src_path, out_path = sys.argv[1], sys.argv[2]
    written = 0
    malformed = 0

    with open(src_path, 'r', encoding='utf-8', errors='replace') as src, \
            open(out_path, 'w', encoding='utf-8', newline='') as out:
        writer = csv.writer(out)
        writer.writerow(OUTPUT_COLUMNS)

        for line in src:
            match = INSERT_RE.match(line)
            if not match:
                continue
            payload = line[match.end():]
            for row in parse_tuples(payload):
                if len(row) != len(SOURCE_COLUMNS):
                    malformed += 1
                    continue
                writer.writerow([row[i] for i in KEEP_INDEXES])
                written += 1

    print(f'wrote {written} rows to {out_path}', file=sys.stderr)
    if malformed:
        # A nonzero count means the tuple parser desynchronised; the load must
        # not proceed on a partial extraction.
        print(f'ERROR: {malformed} malformed tuples', file=sys.stderr)
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
