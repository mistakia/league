import db from '#db'
import { fixTeam } from '#libs-shared'

import {
  create_snap_gamelog_team_resolver,
  is_agreeing_verdict
} from '#libs-server/resolve-snap-gamelog-team.mjs'

/*
  Grades `player_gamelogs.nfl_team` against the game the row belongs to.

  The defect this exists for is a WEEK TEAM the writer inferred wrongly, and it
  lands on the OTHER SIDE OF THE SAME GAME rather than on a random franchise --
  so every null check, every foreign key and every "is this team in this game"
  predicate reads the row as healthy. Measured 2026-09-01 against production:
  1,254 REG player-weeks across 2016-2024 in which a player sits on one team
  all season, exactly one week reads the opponent, and the next week returns.

  Two properties put the class out of reach of everything else we run.

  `opponent_nfl_team` is DERIVED from `nfl_team` at every write site
  (`calculate_opponent` in scripts/generate-player-gamelogs.mjs, and the roster
  feed's own pairing in private/scripts/import-gameday-rosters.mjs), so the pair
  is always internally consistent. The row is never self-contradictory and no
  cross-column predicate can see it -- the two columns simply name the wrong
  sides of a real matchup. A consumer picking a side of a spread by matching the
  player's week team therefore renders the OPPOSING side, silently.

  And the wrong value WAS SELF-PERPETUATING. The snap-only branch of the
  generator resolved a team as `existing gamelog team || play_stats team ||
  resolver`, so a regeneration read the bad row back as its first-priority
  evidence and rewrote it unchanged -- which is why re-running the writer was
  never a repair, and why db/adhoc/2026-09-02-repair-gamelog-week-team.mjs had
  to overwrite the 547 admissible rows directly. Since 2026-09-02 that readback
  loses to a verdict both resolver sources agree on (`is_agreeing_verdict`), so
  the branch can no longer re-mint the class. It still cannot DRAIN one: it
  writes only where the two sources agree, and every other stored team survives
  untouched, so this detector remains the only way the class is seen.

  ## The oracle, and why it is two sources rather than one

  The oracle is the SHIPPED resolver (libs-server/resolve-snap-gamelog-team.mjs)
  rather than a second selector, so the detector and the repair cannot drift and
  a finding is reproducible by the command the finding names. The resolver
  reaches a verdict from two sources that are properties of the GAME: roster
  continuity over the player's other weeks that season, constrained to this
  game's two teams, and modal scrimmage possession over his snaps, sided by
  position group. Continuity excludes the row's own esbid, so the row under test
  never votes on itself.

  Only rows where BOTH sources spoke and AGREED WITH EACH OTHER are graded, and
  only where continuity rests on three or more other weeks. That is not caution,
  it is what makes the check able to discriminate at all. Measured across
  2016-2025 REG:

    every verdict, any method   2.3% disagreement in EVERY season, 2025
                                included -- a rate set by the weaker source's
                                own error and blind to the defect entirely
    continuity_and_scrimmage,   2016: 53   2019: 47   2022: 73
    support >= 3                2017: 50   2020: 71   2023: 90
                                2018: 43   2021: 65   2024: 55
                                2025:  0, on all 18 weeks and 19,443 rows

  The 2025 column is the whole calibration. Two independent sources agreeing
  with each other and disagreeing with the stored row is not a tolerance to be
  tuned -- it happens 0 times in a clean season and 43 to 90 times in every
  season before it. So the floor is exact agreement, and the benign class is
  excluded by SHAPE (which verdicts are admissible) rather than by threshold.

  ## What cannot be graded, and is reported rather than passed

    - Seasons before 2016. `nfl_snaps` holds nothing before then -- 0 of 333
      games in every season 2010-2015 against 330 of 333 in 2016 -- so neither
      source can speak and the era would grade vacuously clean.
    - PRE and POST. Both carry real roster churn against thin snap counts, and
      the same admissible population reads 0.93 in preseason even in the clean
      2025 season. A floor that tolerated that could not see the REG defect, so
      those weeks are emitted UN-GRADEABLE instead of being graded loosely.
    - A row whose player took no recorded snap in the game, or on which the two
      sources did not both speak and agree. The oracle has no verdict, which is
      a statement about the evidence and never about the row.

  A genuine mid-season trade needs no threshold room and produces no finding: a
  player who appeared for both sides of this matchup makes continuity ambiguous,
  so the row is not admissible and is never graded.
*/

// nfl_snaps begins here. Below this bound both sources are empty, so a season
// is un-gradeable rather than clean.
const FIRST_SNAP_SEASON = 2016

/**
 * Per-week agreement between the stored week team and the shipped resolver,
 * over the rows where both of the resolver's sources agree with each other.
 *
 * @returns {Promise<Array<object>>} rows carrying the grain plus numerator and denominator
 */
export const gamelog_week_team_attribution_rows = async () => {
  const season_rows = await db('nfl_games')
    .distinct('season_year')
    .where('season_year', '>=', FIRST_SNAP_SEASON)
    .whereNotNull('week')
    .orderBy('season_year')

  const rows = []

  for (const { season_year } of season_rows) {
    // One query per season, because the resolver is built per season and reads
    // its three supporting queries once for the whole candidate set. The join
    // to `nfl_snaps` is what makes this the RESOLVABLE population rather than
    // every gamelog row, and it is anchored on the same esbid rather than on
    // the week so a player who moved mid-week cannot match the wrong game.
    const candidates = await db({ pg: 'player_gamelogs' })
      .join('nfl_games as g', 'g.esbid', 'pg.esbid')
      .join('player as pl', 'pl.pid', 'pg.pid')
      .select(
        'g.season_year',
        'g.season_type',
        'g.week',
        'pg.pid',
        'pg.esbid',
        'pg.nfl_team',
        'pl.gsis_it_player_id',
        'pl.primary_position'
      )
      .where('g.season_year', season_year)
      .whereNotNull('g.week')
      .whereNotNull('pg.nfl_team')
      .whereNotNull('pl.gsis_it_player_id')
      .whereExists(function () {
        this.select(db.raw(1))
          .from('nfl_snaps as sn')
          .whereRaw('sn.esbid = pg.esbid')
          .whereRaw('sn.gsis_it_player_id = pl.gsis_it_player_id')
      })

    if (!candidates.length) continue

    const resolve = await create_snap_gamelog_team_resolver({
      candidates,
      season_year
    })

    // Every week the season holds gets a unit, including one whose admissible
    // population turns out to be empty. Such a week carries a denominator of
    // zero, which the classifier reads as un-gradeable -- the point being that
    // a week the oracle went silent on must never look like a clean sweep.
    const by_week = new Map()

    for (const candidate of candidates) {
      const key = `${candidate.season_type}_${candidate.week}`

      if (!by_week.has(key)) {
        by_week.set(key, {
          season_year: Number(candidate.season_year),
          season_type: candidate.season_type,
          week: Number(candidate.week),
          numerator: 0,
          denominator: 0
        })
      }

      const resolved = resolve(candidate)

      // The admissibility rule lives in the resolver, so this check, the repair
      // and the writer's override cannot come to grade, write and act on three
      // different rules.
      if (!is_agreeing_verdict(resolved)) continue

      const unit = by_week.get(key)
      unit.denominator += 1

      if (fixTeam(candidate.nfl_team) === fixTeam(resolved.nfl_team)) {
        unit.numerator += 1
      }
    }

    rows.push(...by_week.values())
  }

  return rows
}
