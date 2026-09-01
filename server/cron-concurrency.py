#!/usr/bin/env python3
"""Report how many crontab-main jobs start in the same wall-clock minute.

Why this exists. The obvious check -- group the cron lines by their literal
minute and hour fields -- cannot see past the text. It never expands `*` or
`*/N`, so `*/5 * * * *` and `0 * * * *` fire together every hour and it counts
them as two unrelated schedules. It under-reports real collisions, and it
invents fake ones in the other direction by collapsing distinct day-of-week and
month schedules that never co-fire. A 2026-08 stagger was verified with that
check and left a four-job convoy at :00 of every hour standing.

This expands every field and simulates a full year of fire times, so it sees
month and day-of-week as well as minute and hour. The bar is a maximum of two
concurrent starts; the residual worth arguing about is whether what is left is
a convoy or a long tail.

Usage:

    python3 server/cron-concurrency.py

Reads server/crontab-main/*.cron relative to THIS FILE, not the working
directory. An earlier copy globbed relative to cwd and printed a confident zero
when run from anywhere else, which reads exactly like a clean result.
"""

import re
import sys
from collections import defaultdict
from datetime import date, timedelta
from pathlib import Path

CRON_DIR = Path(__file__).resolve().parent / 'crontab-main'
CRON_LINE = re.compile(r'^(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(.*)$')
BAR = 2
DAYS = 366


def expand(field, lo, hi):
    """Expand one cron field into the set of values it fires on."""
    out = set()
    for part in field.split(','):
        step = 1
        if '/' in part:
            part, raw_step = part.split('/')
            step = int(raw_step)
        if part == '*':
            a, b = lo, hi
        elif '-' in part:
            a, b = (int(x) for x in part.split('-'))
        else:
            a = b = int(part)
            # `5/10` means "from 5, every 10, to the end of the range" -- not a
            # single value. Without this the form silently fires once.
            if step > 1:
                b = hi
        out.update(range(a, b + 1, step))
    return out


def load_jobs():
    files = sorted(CRON_DIR.glob('*.cron'))
    if not files:
        sys.exit(f'no .cron files under {CRON_DIR} -- refusing to report a zero')
    jobs, unparsed = [], []
    for path in files:
        for raw in path.read_text().splitlines():
            line = raw.strip()
            if not line or line.startswith('#'):
                continue
            match = CRON_LINE.match(line)
            if not match or not re.fullmatch(r'[\d,*/\-]+', ''.join(match.groups()[:5])):
                unparsed.append(line[:60])
                continue
            jobs.append(match.groups())
    return jobs, unparsed


def fires_today(day, dom_field, dow_field):
    """Cron's day rule: with both day fields restricted, EITHER match fires."""
    dow_cron = (day.weekday() + 1) % 7
    dom_any = dom_field == '*'
    dow_any = dow_field == '*'
    if dom_any and dow_any:
        return True
    dow_values = {v % 7 for v in expand(dow_field, 0, 7)}
    if dom_any:
        return dow_cron in dow_values
    dom_values = expand(dom_field, 1, 31)
    if dow_any:
        return day.day in dom_values
    return day.day in dom_values or dow_cron in dow_values


def main():
    jobs, unparsed = load_jobs()
    worst = defaultdict(int)
    example = {}
    day = date.today()
    for _ in range(DAYS):
        counts = defaultdict(list)
        for minute, hour, dom, month, dow, cmd in jobs:
            if day.month not in expand(month, 1, 12):
                continue
            if not fires_today(day, dom, dow):
                continue
            for h in expand(hour, 0, 23):
                for m in expand(minute, 0, 59):
                    counts[(h, m)].append(cmd)
        for slot, cmds in counts.items():
            if len(cmds) > worst[slot]:
                worst[slot] = len(cmds)
                example[slot] = (day.isoformat(), cmds)
        day += timedelta(days=1)

    over = [(slot, n) for slot, n in worst.items() if n > BAR]
    print(f'jobs parsed: {len(jobs)}   unparsed lines: {len(unparsed)} {unparsed}')
    print(
        f'minutes over the {BAR}-job bar: {len(over)}   '
        f'overall max concurrent: {max(worst.values()) if worst else 0}'
    )
    for (h, m), n in sorted(over, key=lambda kv: -kv[1])[:6]:
        print(f'  {h:02d}:{m:02d} n={n} worst day {example[(h, m)][0]}')
        for cmd in example[(h, m)][1]:
            print('     -', re.sub(r'.*/root/league/', '', cmd)[:70])


if __name__ == '__main__':
    main()
