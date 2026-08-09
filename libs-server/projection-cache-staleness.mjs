import { external_data_sources } from '#constants'

// Which precomputed projection slices are missing for a season.
//
// scoring_format_player_projection_points and
// league_format_player_projection_values are caches keyed on an OPAQUE format
// id. Format ids are find-or-create over the whole config tuple, so changing
// any scoring or roster setting does not update a row -- it resolves to a
// DIFFERENT id, and that id's slice is empty until something derives it. The
// emptiness IS the staleness signal, which is why nothing here needs a dirty
// flag, a queue table, or an enqueue call at the write site: the condition is
// derivable from the data at any time, by anyone, and it is equally true of a
// slice that was never built, one a failed run left empty, and one whose
// writer has not been deployed yet.
//
// Two guards keep this from reporting work that cannot succeed, which matters
// because the caller is a loop: a format whose slice stays empty after a
// refill would otherwise be rediscovered on every pass forever.

// A slice is legitimately empty when there is nothing to derive it FROM. The
// scoring cache is built from the AVERAGE rows in projections_index, so with
// no source rows for the year every scoring format is correctly empty and none
// of them is stale.
export const has_projection_source_for_year = async ({ db, year }) => {
  const row = await db('projections_index')
    .where({
      season_year: year,
      season_type: 'REG',
      sourceid: external_data_sources.AVERAGE
    })
    .first('pid')
  return Boolean(row)
}

// Scoring formats a season row references whose points slice is empty.
// Anchored on `seasons` rather than on league_scoring_formats: find-or-create
// leaves behind every intermediate config anyone ever saved, and a format no
// season references is not a cache anybody reads.
export const find_stale_scoring_format_ids = async ({ db, year }) => {
  if (!(await has_projection_source_for_year({ db, year }))) {
    return []
  }

  const rows = await db('seasons')
    .distinct('seasons.scoring_format_id')
    .where('seasons.season_year', year)
    .whereNotNull('seasons.scoring_format_id')
    .whereNotExists(function () {
      this.select(1)
        .from('scoring_format_player_projection_points')
        .whereRaw(
          'scoring_format_player_projection_points.scoring_format_id = seasons.scoring_format_id'
        )
        .andWhere('scoring_format_player_projection_points.season_year', year)
    })

  return rows.map((row) => row.scoring_format_id)
}

// League formats a season row references whose values slice is empty AND whose
// upstream scoring slice is populated. The upstream condition is what makes the
// two stages ordered rather than racing: league values are derived FROM scoring
// points, so a league format whose scoring format is itself still empty is not
// yet workable and must not be reported.
export const find_stale_league_format_ids = async ({ db, year }) => {
  const rows = await db('seasons')
    .distinct('seasons.league_format_id')
    .where('seasons.season_year', year)
    .whereNotNull('seasons.league_format_id')
    .whereExists(function () {
      this.select(1)
        .from('scoring_format_player_projection_points')
        .whereRaw(
          'scoring_format_player_projection_points.scoring_format_id = seasons.scoring_format_id'
        )
        .andWhere('scoring_format_player_projection_points.season_year', year)
    })
    .whereNotExists(function () {
      this.select(1)
        .from('league_format_player_projection_values')
        .whereRaw(
          'league_format_player_projection_values.league_format_id = seasons.league_format_id'
        )
        .andWhere('league_format_player_projection_values.season_year', year)
    })

  return rows.map((row) => row.league_format_id)
}

export const find_stale_projection_formats = async ({ db, year }) => {
  const scoring_format_ids = await find_stale_scoring_format_ids({ db, year })
  const league_format_ids = await find_stale_league_format_ids({ db, year })
  return { scoring_format_ids, league_format_ids }
}

// Single-league form, for a route that wants to tell a commissioner their
// projections are still being rebuilt rather than rendering an empty slice as
// if the numbers were real.
export const is_league_projection_cache_stale = async ({ db, lid, year }) => {
  const season = await db('seasons')
    .where({ lid, season_year: year })
    .first('scoring_format_id', 'league_format_id')

  if (!season) {
    return false
  }

  if (!(await has_projection_source_for_year({ db, year }))) {
    return false
  }

  const scoring_row = season.scoring_format_id
    ? await db('scoring_format_player_projection_points')
        .where({
          scoring_format_id: season.scoring_format_id,
          season_year: year
        })
        .first('pid')
    : null

  if (season.scoring_format_id && !scoring_row) {
    return true
  }

  // The league slice is only meaningfully absent once its upstream exists.
  if (!season.league_format_id || !scoring_row) {
    return false
  }

  const league_row = await db('league_format_player_projection_values')
    .where({
      league_format_id: season.league_format_id,
      season_year: year
    })
    .first('pid')

  return !league_row
}
