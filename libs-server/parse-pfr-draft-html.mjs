import { JSDOM } from 'jsdom'

import { fixTeam } from '#libs-shared'
import { resolve_pfr_draft_team } from '#libs-server/resolve-pfr-draft-team.mjs'

/**
 * Parse PFR draft page HTML into draft player objects.
 * Mirrors the parsing logic in private/libs-server/pro-football-reference.mjs.
 *
 * Kept dependency-free of #db and #private so a spec can exercise the full
 * parse surface in CI, where the private submodule is not initialized.
 */
export const parse_draft_html = (html, year) => {
  const dom = new JSDOM(html)
  const doc = dom.window.document
  const draft_players = []
  const rows = doc.querySelectorAll('#drafts tbody tr:not(.thead)')

  for (const row of rows) {
    const round_el = row.querySelector('[data-stat="draft_round"]')
    const pick_el = row.querySelector('[data-stat="draft_pick"]')
    const team_el = row.querySelector('[data-stat="team"] a')
    const player_el = row.querySelector('[data-stat="player"] a')
    const pos_el = row.querySelector('[data-stat="pos"]')

    if (!round_el || !pick_el) continue

    const round = Number(round_el.textContent)
    const overall_pick = Number(pick_el.textContent)
    if (!round || !overall_pick) continue

    // PFR spells HOU as both the Oilers (1990-96) and the Texans (2002+); the
    // draft year disambiguates. fixTeam's global HOU = Texans mapping stays for
    // its other callers, so the Oilers era resolves here.
    const parsed_team = team_el ? fixTeam(team_el.textContent) : null
    const team = resolve_pfr_draft_team(parsed_team, year)
    const player_name = player_el
      ? player_el.textContent
      : row.querySelector('[data-stat="player"]')?.textContent || ''
    const pfr_id = player_el
      ? player_el.getAttribute('href').split('/').pop().replace('.htm', '')
      : null
    const draft_position = pos_el?.textContent || null

    const all_pro_first_team_selections = Number(
      row.querySelector('[data-stat="all_pros_first_team"]')?.textContent || 0
    )
    const pro_bowl_selections = Number(
      row.querySelector('[data-stat="pro_bowls"]')?.textContent || 0
    )
    const years_as_primary_starter = Number(
      row.querySelector('[data-stat="years_as_primary_starter"]')
        ?.textContent || 0
    )
    const pfr_weighted_career_approximate_value = Number(
      row.querySelector('[data-stat="career_av"]')?.textContent || 0
    )
    const pfr_weighted_career_approximate_value_drafted_team = Number(
      row.querySelector('[data-stat="draft_av"]')?.textContent || 0
    )
    const college_link = row.querySelector('[data-stat="college_id"] a')
    const college_team = college_link ? college_link.textContent : null

    draft_players.push({
      round,
      overall_pick,
      team,
      player_name,
      pfr_id,
      draft_position,
      all_pro_first_team_selections,
      pro_bowl_selections,
      years_as_primary_starter,
      pfr_weighted_career_approximate_value,
      pfr_weighted_career_approximate_value_drafted_team,
      college_team
    })
  }

  return draft_players
}
