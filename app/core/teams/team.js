import { Record, List, Map } from 'immutable'
import { create_empty_fantasy_team_stats } from '#constants'

export const Team = new Record({
  team_id: null,
  division: null,
  name: null,
  image: null,
  abbreviation: null,
  lid: null,
  salary_cap: null,
  free_agent_acquisition_budget_balance: null,
  waiver_order: null,
  draft_order: null,
  primary_color: null,
  accent_color: null,
  picks: new List(),
  stats: new Map(create_empty_fantasy_team_stats()),

  playoff_odds: null,
  division_odds: null,
  bye_odds: null,
  championship_odds: null,
  playoff_odds_with_win: null,
  division_odds_with_win: null,
  bye_odds_with_win: null,
  championship_odds_with_win: null,
  playoff_odds_with_loss: null,
  division_odds_with_loss: null,
  bye_odds_with_loss: null,
  championship_odds_with_loss: null,

  championships: 0,
  is_defending_champion: false
})

export function createTeam({
  team_id,
  division,
  name,
  image,
  abbreviation,
  lid,
  salary_cap,
  free_agent_acquisition_budget_balance,
  waiver_order,
  primary_color,
  accent_color,

  picks = [],

  playoff_odds,
  division_odds,
  bye_odds,
  championship_odds,
  playoff_odds_with_win,
  division_odds_with_win,
  bye_odds_with_win,
  championship_odds_with_win,
  playoff_odds_with_loss,
  division_odds_with_loss,
  bye_odds_with_loss,
  championship_odds_with_loss,

  championships,
  is_defending_champion,

  stats,

  ...params
}) {
  return new Team({
    team_id,
    division,
    name,
    image,
    abbreviation,
    lid,
    salary_cap,
    free_agent_acquisition_budget_balance,
    waiver_order,
    draft_order: params.draft_order,
    primary_color,
    accent_color,
    picks: new List(picks),

    stats: Map.isMap(stats) ? stats : stats ? new Map(stats) : undefined,

    playoff_odds,
    division_odds,
    bye_odds,
    championship_odds,
    playoff_odds_with_win,
    division_odds_with_win,
    bye_odds_with_win,
    championship_odds_with_win,
    playoff_odds_with_loss,
    division_odds_with_loss,
    bye_odds_with_loss,
    championship_odds_with_loss,

    championships,
    is_defending_champion
  })
}
