/*
  The testable half of scripts/import-nfl-games-ngs.mjs: shaping one NGS
  schedule item into an nfl_games row, deciding which items are writable, and
  the upsert itself.

  It lives HERE rather than in the script for one reason, and it is a hard
  constraint rather than a preference. That script statically imports
  #private/libs-server/ngs.mjs for the feed URL, and `private/` is a submodule
  no workflow checks out -- on the runner and in any clone it is an EMPTY
  DIRECTORY. A module that cannot resolve aborts the suite during load and
  reports zero tests rather than one failure, so a spec importing the script
  would take the whole suite down in CI while passing locally. Nothing here
  imports #private, so it is safe for the suite to load.

  libs-shared/nfl-postseason-week.mjs was extracted from the same script for
  exactly this reason.

  `run` fetches live and has no injection seam, which is why the skip and the
  conflict key are reachable only through the two exports below.
*/

import dayjs from 'dayjs'
import debug from 'debug'
import timezone from 'dayjs/plugin/timezone.js'

import db from '#db'
import { fixTeam, getGameDayAbbreviation } from '#libs-shared'
import { nfl_week_from_week_type } from '#libs-shared/nfl-postseason-week.mjs'

dayjs.extend(timezone)

const log = debug('import-games-ngs')

export const format = (item) => {
  const date = item.gameDate ? dayjs(item.gameDate).format('YYYY/MM/DD') : null
  const season_type = item.seasonType
  const week_type = ['REG', 'PRE'].includes(season_type)
    ? season_type
    : item.weekNameAbbr
  const time_eastern = item.gameTimeEastern
  const week = nfl_week_from_week_type({ week: item.week, week_type })
  const season_year = item.season
  const score = item.score || {}
  const day = date
    ? getGameDayAbbreviation({ season_type, date, time_eastern, week_type })
    : null

  const datetime = dayjs(
    `${item.gameDate} ${item.gameTimeEastern}`,
    'DD/MM/YYYY HH:mm:ss'
  ).tz(item.time, 'America/New_York')

  return {
    esbid: item.gameId,
    gsis_game_id: item.gameKey,
    shield_game_id: item.smartId,
    ngs_game_id: item.gameId,

    season_year,
    week,
    date,
    time_eastern,
    day,
    kickoff_at: datetime.isValid() ? datetime.toDate() : null,

    away_nfl_team: fixTeam(item.visitorTeamAbbr),
    home_nfl_team: fixTeam(item.homeTeamAbbr),

    season_type,
    week_type,
    is_overtime: (score.phase || '').includes('OVERTIME'),

    home_score: (score.homeTeamScore || {}).pointTotal,
    away_score: (score.visitorTeamScore || {}).pointTotal,

    stadium_name: item.site.siteFullName,
    ngs_stadium_id: item.site.siteId,

    game_clock: score.time,
    status: score.phase
  }
}

/*
  Split the feed into rows we can write and rows we decline to.

  A feed item with no gameId has no esbid, and esbid is the conflict key
  upsert_game uses. nfl_games.esbid is NULLABLE and Postgres treats NULLs in a
  unique index as DISTINCT, so such a row would find nothing to conflict with on
  `esbid` and would fall through to violate idx_24707_game instead -- raising on
  a constraint the statement never named. Skipping it is what makes the conflict
  key sound, so the two are one change and not two.

  Exported because `run` fetches live and has no injection seam; this is where
  the skip can be tested.
*/
export const select_game_inserts = (data) => {
  const inserts = []
  let skipped_missing_esbid = 0
  let skipped_malformed = 0

  for (const item of data) {
    if (!item.gameId) {
      skipped_missing_esbid += 1
      log(`skipping feed item with no gameId (season ${item.season})`)
      continue
    }

    /*
      format() is inside the try for the same reason the write loop is: it
      DEREFERENCES the feed's shape (item.site.siteFullName among others), so an
      item missing a key raises a TypeError. Called outside a guard that
      TypeError propagates out of this function, `run` throws before writing
      anything, and the whole slate is lost with games_failed still reading 0 --
      which is precisely the whole-slate loss the row-by-row write loop exists
      to prevent, arriving one phase earlier and invisible to the same counter.

      Counted separately from the esbid skip because the two mean different
      things: one is a feed item we understand and decline, the other is one we
      could not parse.
    */
    try {
      inserts.push(format(item))
    } catch (error) {
      skipped_malformed += 1
      log(`skipping malformed feed item ${item.gameId}: ${error.message}`)
    }
  }

  return { inserts, skipped_missing_esbid, skipped_malformed }
}

/*
  Upsert one game, keyed on `esbid` rather than on the team pair.

  The team-pair key (away_nfl_team, home_nfl_team, week, season_year,
  season_type) cannot correct a changed abbreviation: once a franchise's stored
  token is conformed to its current form, a feed still supplying the era token
  no longer matches the stored row, so the upsert MINTS A DUPLICATE game rather
  than updating the existing one. esbid is the game's own identity and is stable
  across any relabelling.

  Exported for the same reason as select_game_inserts: this is the only seam a
  test can reach the conflict key through.
*/
export const upsert_game = (insert) =>
  db('nfl_games').insert(insert).onConflict('esbid').merge()
