/* global describe it before */
import MockDate from 'mockdate'
import debug from 'debug'

import { get_data_view_results_query } from '#libs-server'
import { constants } from '#libs-shared'
import { compare_queries } from './utils/index.mjs'

describe('LIBS SERVER get_data_view_results', () => {
  before(() => {
    MockDate.reset()
    debug.enable('data-views')
  })

  it('team series success rate from plays', () => {
    const { query } = get_data_view_results_query({
      columns: [
        {
          column_id: 'team_series_conversion_rate_from_plays',
          params: {
            year: [2024]
          }
        }
      ],
      sort: [
        {
          column_id: 'team_series_conversion_rate_from_plays',
          desc: true
        }
      ]
    })

    const expected_query = `with "t65417c18efcc4d13e54a67b3a260889e" as (select "nfl_plays"."off" as "nfl_team", "nfl_plays"."year", "nfl_plays"."week", COUNT(DISTINCT CASE WHEN series_result IN ('FIRST_DOWN', 'TOUCHDOWN') THEN CONCAT(esbid, '_', series_seq) END) as team_series_conversion_rate_from_plays_numerator, COUNT(DISTINCT CASE WHEN series_result NOT IN ('QB_KNEEL', 'END_OF_HALF') THEN CONCAT(esbid, '_', series_seq) END) as team_series_conversion_rate_from_plays_denominator from "nfl_plays" where not "play_type" = 'NOPL' and "nfl_plays"."seas_type" = 'REG' and "nfl_plays"."year" in (${constants.season.year}) group by "nfl_plays"."off", "nfl_plays"."year", "nfl_plays"."week"), "t65417c18efcc4d13e54a67b3a260889e_team_stats" as (select "t65417c18efcc4d13e54a67b3a260889e"."nfl_team", sum(t65417c18efcc4d13e54a67b3a260889e.team_series_conversion_rate_from_plays_numerator) / sum(t65417c18efcc4d13e54a67b3a260889e.team_series_conversion_rate_from_plays_denominator) as team_series_conversion_rate_from_plays from "t65417c18efcc4d13e54a67b3a260889e" where "t65417c18efcc4d13e54a67b3a260889e"."year" in (${constants.season.year}) group by "t65417c18efcc4d13e54a67b3a260889e"."nfl_team") select "player"."pid", "t65417c18efcc4d13e54a67b3a260889e_team_stats"."team_series_conversion_rate_from_plays" AS "team_series_conversion_rate_from_plays_0", "player"."pos" from "player" left join "t65417c18efcc4d13e54a67b3a260889e_team_stats" on "t65417c18efcc4d13e54a67b3a260889e_team_stats"."nfl_team" = "player"."current_nfl_team" group by "t65417c18efcc4d13e54a67b3a260889e_team_stats"."team_series_conversion_rate_from_plays", "player"."pid", "player"."lname", "player"."fname", "player"."pos" order by 2 DESC NULLS LAST, "player"."pid" asc limit 500`
    compare_queries(query.toString(), expected_query)
  })
})
