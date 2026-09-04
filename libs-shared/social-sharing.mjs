// Copy and defaults for page metadata. Isomorphic on purpose: the API fills
// the served HTML from these values and the SPA re-applies them on client-side
// navigation, so a tab title and a link preview cannot disagree.
//
// This module is the single source for the reusable facts about the site and
// the league — team count, founding year, season number, the site tagline.
// Any surface that states one of those facts imports it from here instead of
// writing its own copy; test/libs-shared.social-meta-copy.spec.mjs keeps the
// copy attached to this source.

import { current_season } from './constants/season-constants.mjs'

export const site_name = 'xo.football'

// The platform voice, for paths that are not about any one league — the
// landing page, the default social card, /status, shared links. README.md
// carries the same sentence; the copy gate keeps the two in agreement.
export const site_tagline =
  'An open-source platform for managing fantasy football leagues, exploring analytics, and participating in betting markets.'

// THE SITE DEFAULTS ARE THE PLATFORM'S VOICE, NOT THE GENESIS LEAGUE'S. These
// two are both the copy for `/` AND the fallback for any route the table does
// not name, so a league-flavoured default was wrong on both counts: it made
// the site's front door and every unnamed path describe one tenant of the
// platform rather than the platform. The Genesis League's own copy now lives
// on its own route, /genesis-league.
export const default_title =
  'xo.football — fantasy football league management and NFL analytics'

// Deliberately the tagline itself rather than a second sentence saying the
// same thing differently. One platform sentence, gated against README.md, used
// wherever the site describes itself.
export const default_description = site_tagline

// Card paths and alts. The default card is what a route with no card of its
// own shows; the league-surface card is what every /leagues/:lid/* route
// shows. Per-section cards live on the route entries in page-routes.mjs. Alt
// text describes what is depicted, for a reader who cannot see it.
export const default_image_path = '/static/images/social/default.png'
export const default_image_alt =
  'The xo.football wordmark above links to data views, plays, the constitution, the glossary and resources'
export const league_surface_image_path =
  '/static/images/social/league-surface.png'
export const league_surface_image_alt =
  'A fantasy football front office: a salary cap bar and a starting lineup of quarterback, running back and receiver with their salaries'

export const twitter_card_type = 'summary_large_image'

export const default_og_type = 'website'

export const indexable_robots = 'index, follow'

// Anything behind a login, anything a crawler cannot render, and anything whose
// content is another page's. Kept as one constant so a route only has to decide
// whether it is public, not remember the spelling.
export const private_robots = 'noindex, nofollow'

// Reusable league facts. Every surface states these from here, so a change of
// fact is one edit, and the season number rolls over by itself.
export const league_name = 'Genesis League'
export const league_team_count = 10
export const league_founding_year = 2020
export const league_format_short =
  'ten-team, half-PPR, superflex dynasty league with a salary cap'

// The league's season number, derived from the founding year (2020 was season
// 1) so it never needs a manual bump at rollover.
export const league_season_number =
  current_season.year - league_founding_year + 1

const ordinals = [
  'first',
  'second',
  'third',
  'fourth',
  'fifth',
  'sixth',
  'seventh',
  'eighth',
  'ninth',
  'tenth',
  'eleventh',
  'twelfth',
  'thirteenth',
  'fourteenth',
  'fifteenth',
  'sixteenth'
]

const ordinal_word = (n) => ordinals[n - 1] || `${n}th`

// "its seventh season" — the phrase the landing page and the front-door card
// use.
export const league_season_phrase = `its ${ordinal_word(league_season_number)} season`

export const league_last_season_count = league_season_number - 1
export const league_this_season_ordinal = ordinal_word(league_season_number)

// Appends the site name once. Without the guard the home page title, which
// already names the site, would render as "xo.football — ... - xo.football".
export const format_page_title = (title) => {
  if (!title) return default_title
  if (title.includes(site_name)) return title
  return `${title} - ${site_name}`
}

export const absolute_url = (origin, path_or_url) => {
  if (!path_or_url) return origin
  if (path_or_url.startsWith('http://') || path_or_url.startsWith('https://')) {
    return path_or_url
  }
  return `${origin.replace(/\/$/, '')}${path_or_url}`
}
