/* global describe it */

import { get_players_table_view_results } from '#libs-server'
import { compare_queries } from './utils/index.mjs'

describe('LIBS SERVER get_players_table_view_results', () => {
  it('player contract with no params', () => {
    const query = get_players_table_view_results({
      columns: [
        {
          column_id: 'player_contract_base_salary'
        }
      ],
      sort: [
        {
          column_id: 'player_contract_base_salary',
          desc: true
        }
      ]
    })

    const expected_query = `select "player"."pid", "tb75ca4f410cdaf4b86f84af5464987dd"."base_salary" AS "base_salary_0", "player"."pos" from "player" left join "player_contracts" as "tb75ca4f410cdaf4b86f84af5464987dd" on "tb75ca4f410cdaf4b86f84af5464987dd"."pid" = "player"."pid" and tb75ca4f410cdaf4b86f84af5464987dd.year = '2024' group by "tb75ca4f410cdaf4b86f84af5464987dd"."base_salary", "player"."pid", "player"."lname", "player"."fname", "player"."pos" order by 2 DESC NULLS LAST, "player"."pid" asc limit 500`
    compare_queries(query.toString(), expected_query)
  })

  it('player contract with year', () => {
    const query = get_players_table_view_results({
      columns: [
        {
          column_id: 'player_contract_base_salary',
          params: {
            contract_year: 2022
          }
        },
        {
          column_id: 'player_contract_base_salary',
          params: {
            contract_year: 'TOTAL'
          }
        }
      ],
      sort: [
        {
          column_id: 'player_contract_base_salary',
          desc: true
        }
      ]
    })
    const expected_query = `select "player"."pid", "ta51741002ab8f03ebbd01303bdd3cf2a"."base_salary" AS "base_salary_0", "tb8130d7f4a3233d1b3579e919af8b79b"."base_salary" AS "base_salary_1", "player"."pos" from "player" left join "player_contracts" as "ta51741002ab8f03ebbd01303bdd3cf2a" on "ta51741002ab8f03ebbd01303bdd3cf2a"."pid" = "player"."pid" and ta51741002ab8f03ebbd01303bdd3cf2a.year = '2022' left join "player_contracts" as "tb8130d7f4a3233d1b3579e919af8b79b" on "tb8130d7f4a3233d1b3579e919af8b79b"."pid" = "player"."pid" and tb8130d7f4a3233d1b3579e919af8b79b.year = 'Total' group by "ta51741002ab8f03ebbd01303bdd3cf2a"."base_salary", "tb8130d7f4a3233d1b3579e919af8b79b"."base_salary", "player"."pid", "player"."lname", "player"."fname", "player"."pos" order by 2 DESC NULLS LAST, "player"."pid" asc limit 500`
    compare_queries(query.toString(), expected_query)
  })

  it('player contract years remaining', () => {
    const query = get_players_table_view_results({
      columns: [
        {
          column_id: 'player_contract_years_remaining'
        }
      ],
      where: [
        {
          column_id: 'player_contract_years_remaining',
          operator: '=',
          value: 1
        }
      ],
      sort: [
        {
          column_id: 'player_contract_years_remaining',
          desc: true
        }
      ]
    })
    const expected_query = `select "player"."pid", CASE WHEN player.contract_year_signed IS NULL THEN NULL ELSE player.contract_years - (EXTRACT(YEAR FROM CURRENT_DATE) - player.contract_year_signed) END as contract_years_remaining_0, "player"."pos" from "player" where CASE WHEN player.contract_year_signed IS NULL THEN NULL ELSE player.contract_years - (EXTRACT(YEAR FROM CURRENT_DATE) - player.contract_year_signed) END = '1' group by "player"."pid", "player"."lname", "player"."fname", "player"."pos" order by "player"."pid" asc limit 500`
    compare_queries(query.toString(), expected_query)
  })
})
