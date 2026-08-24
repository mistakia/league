import { asyncBufferFromFile } from 'hyparquet'

import { formatHeight } from '#libs-shared'
import {
  download_players_file,
  read_parquet_rows
} from '#scripts/import-players-nflverse.mjs'
import { download_weekly_roster_csv } from '#scripts/backfill-players-from-nflverse-weekly-rosters.mjs'
import readCSV from '#libs-server/read-csv.mjs'
import * as nfl_pro from '#private/libs-server/nfl-pro.mjs'

/*
  The gsis-keyed biographical sources, normalized to one record shape.

  Both sources here are keyed on the gsis id we already hold, which is the
  filter every candidate source has to pass: a source searchable only by name
  cannot serve identity repair, because name matching is precisely the
  deduplication hazard we are trying to avoid.

  What matters as much as the biography is that BOTH sources also carry the
  person's OTHER identifiers. That is what makes an attach decidable without
  ever comparing a name -- see player-identity-collision-oracle.mjs.

  Excluded, and not for lack of trying: Sleeper is gsis-keyed and enumerable but
  every one of the 3,888 players it keys already has a `player` row. ESPN search
  and PFR are name-only. No database table offers a usable gsis-plus-position
  pairing.
*/

/*
  NFL Pro's `nflId` is NOT `player.nfl_player_id`. It equals the row's own
  `gsisItId` and belongs in `gsis_it_player_id`; `player.nfl_player_id` holds a
  different and much larger id space (2,564,145 against 38,532). Mapping it by
  name would write a wrong id into a column an attach then matches on, which is
  the worst available failure here.
*/
const from_nfl_pro_row = (row) => ({
  gsis_player_id: row.gsisId,
  esb_id: row.esbId || null,
  pfr_id: null,
  smart_id: row.smartId || null,
  gsis_it_id: row.gsisItId ? String(row.gsisItId) : null,
  // footballName, never firstName. They disagree on 7-18% of rows depending on
  // the season, and since create-player builds short_name from the first
  // initial, firstName writes `J.Berry` for the player every other source calls
  // `E.Berry` -- corrupting the exact column a name comparison reads.
  first_name: row.footballName || row.firstName || null,
  legal_first_name: row.firstName || null,
  last_name: row.lastName || null,
  position: row.position || row.positionGroup || null,
  height_inches: formatHeight(row.height),
  weight_pounds: row.weight || null,
  // NFL Pro dates are MM/DD/YYYY; every other consumer here expects ISO.
  date_of_birth: row.birthDate
    ? row.birthDate.replace(/^(\d{2})\/(\d{2})\/(\d{4})$/, '$3-$1-$2')
    : null,
  college: row.collegeName || null,
  source: 'nfl_pro'
})

const from_nflverse_row = (row) => ({
  gsis_player_id: row.gsis_id,
  esb_id: row.esb_id || null,
  pfr_id: row.pfr_id || null,
  smart_id: row.smart_id || null,
  gsis_it_id: row.gsis_it_id ? String(row.gsis_it_id) : null,
  first_name: row.football_name || row.first_name || null,
  legal_first_name: row.first_name || null,
  last_name: row.last_name || null,
  position: row.position || row.position_group || null,
  height_inches: formatHeight(row.height),
  weight_pounds: row.weight || null,
  date_of_birth: row.birth_date || null,
  // nflverse concatenates transfers with a semicolon (`Walsh; Illinois`); the
  // first is the one every other source names.
  college: row.college_name ? row.college_name.split(';')[0].trim() : null,
  source: 'nflverse'
})

/*
  The weekly rosters carry the same column vocabulary as the players parquet, so
  this mapper differs from `from_nflverse_row` only in the college field: the
  weekly CSV names it `college` and records ONE school, where the parquet's
  `college_name` semicolon-concatenates transfers.

  Why a second nflverse rung is worth having at all. The parquet is a
  players-master snapshot and the weekly rosters are a per-week record, so a
  player the master never picked up can still appear in a week's roster. Against
  the 1,951 ids left after the first three rungs it reaches 272, and it carries
  `esb_id` on every one of them -- which is what makes those decidable by
  identifier rather than by name.
*/
export const from_weekly_roster_row = (row) => ({
  gsis_player_id: row.gsis_id,
  esb_id: row.esb_id || null,
  pfr_id: row.pfr_id || null,
  smart_id: row.smart_id || null,
  gsis_it_id: row.gsis_it_id ? String(row.gsis_it_id) : null,
  first_name: row.football_name || row.first_name || null,
  legal_first_name: row.first_name || null,
  last_name: row.last_name || null,
  position: row.position || row.ngs_position || null,
  /*
    Numeric, and zero collapsed to null -- neither is cosmetic.

    The CSV yields strings where the parquet and the NFL Pro JSON yield numbers,
    and `merge_record` fills field by field, so an uncoerced string reaches the
    same record shape as a number. Worse, a completeness check reads truthiness:
    `'0'` is truthy and `0` is not, so the string form mints a row asserting a
    zero weight rather than reporting the measurement as missing. Measured
    against production 2026-08-24, `00-0037599` carries weight `'0'` and moves
    from `mint_new` to `residue_incomplete_source` on exactly this.

    Zero collapses to null rather than staying 0 because absence is spelled null
    everywhere else in this record shape, and a zero measurement is an absence.
  */
  height_inches: formatHeight(row.height) || null,
  weight_pounds: Number(row.weight) || null,
  date_of_birth: row.birth_date || null,
  college: row.college || null,
  source: 'nflverse_weekly_rosters'
})

/*
  The seasons `roster_weekly_{year}.csv` is published for. It carries no
  preseason at all -- `game_type` is REG/WC/DIV/CON/SB only -- which is exactly
  why it cannot reach the 2002-2012 camp bodies that form the bulk of the
  residue, and why adding it does not collapse that residue the way its raw id
  count might suggest.
*/
const WEEKLY_ROSTER_FIRST_SEASON = 2002

/*
  nflverse is the spine and NFL Pro fills in behind it, field by field rather
  than record by record. The ladder is not a preference between the sources so
  much as a statement about their reach: nflverse runs back to 1974 and covers
  1,045 of the missing ids, while NFL Pro returns an EMPTY roster array for
  every season through 2015 -- confirmed twice, against a 2024 control through
  the identical code path and the same team ids, so the empties are genuine
  absence rather than a bad team id.

  Never issue an NFL Pro request for a season before 2016.
*/
const NFL_PRO_FIRST_SEASON = 2016

const merge_record = (base, incoming) => {
  const merged = { ...base }
  for (const [key, value] of Object.entries(incoming)) {
    if (key === 'source') continue
    if (merged[key] === null || merged[key] === undefined) merged[key] = value
  }
  merged.sources = [
    ...new Set([...(base.sources || [base.source]), incoming.source])
  ]
  return merged
}

export const load_source_records = async ({
  nfl_pro_last_season,
  include_nfl_pro = true,
  include_weekly_rosters = true,
  weekly_roster_last_season,
  force_download = false
} = {}) => {
  const records = new Map()

  const parquet_rows = await read_parquet_rows(
    await asyncBufferFromFile(await download_players_file({ force_download }))
  )
  for (const row of parquet_rows) {
    if (!row.gsis_id) continue
    const record = from_nflverse_row(row)
    record.sources = ['nflverse']
    records.set(row.gsis_id, record)
  }

  /*
    Ordered between the parquet and NFL Pro deliberately. `merge_record` fills
    only the fields the base left null, so position in this sequence IS field
    precedence: the parquet stays the spine, the weekly rosters fill the deep
    history behind it, and NFL Pro -- which carries no `pfr_id` at all -- fills
    last rather than pre-empting a source that does.
  */
  if (include_weekly_rosters) {
    const last_season = weekly_roster_last_season ?? nfl_pro_last_season
    for (
      let season = WEEKLY_ROSTER_FIRST_SEASON;
      season <= last_season;
      season++
    ) {
      const csv_path = await download_weekly_roster_csv({
        year: season,
        force_download
      })
      const rows = await readCSV(csv_path)
      if (rows instanceof Error) throw rows

      for (const row of rows) {
        if (!row.gsis_id) continue
        const record = from_weekly_roster_row(row)
        const existing = records.get(row.gsis_id)
        records.set(
          row.gsis_id,
          existing
            ? merge_record(existing, record)
            : { ...record, sources: ['nflverse_weekly_rosters'] }
        )
      }
    }
  }

  if (!include_nfl_pro) return records

  for (
    let season = NFL_PRO_FIRST_SEASON;
    season <= nfl_pro_last_season;
    season++
  ) {
    const roster = await nfl_pro.get_teams_roster({ season })
    for (const row of roster) {
      if (!row.gsisId) continue
      const record = from_nfl_pro_row(row)
      const existing = records.get(row.gsisId)
      records.set(
        row.gsisId,
        existing
          ? merge_record(existing, record)
          : { ...record, sources: ['nfl_pro'] }
      )
    }
  }

  return records
}
