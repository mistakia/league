import {
  default_description,
  default_og_type,
  default_title,
  indexable_robots,
  private_robots
} from './social-sharing.mjs'

// One table, read by BOTH the API's HTML renderer and the SPA's page-head
// effect, so the title a crawler sees and the title in the browser tab cannot
// drift apart. Every route in app/views/routes.js should have an entry here.
//
// Fields:
//   pattern        path with `:param` segments and an optional `*` tail
//   title          without the site name — format_page_title appends it
//   description    used for meta description, og:description, twitter:description
//   robots         defaults to indexable_robots when omitted
//   og_type        defaults to default_og_type when omitted
//   canonical_path fixed canonical when the route is not its own canonical URL
//   og_image       per-section social card; defaults to default_image_path
//   og_image_alt   alt for that card, describing what is depicted for a reader
//                  who cannot see it; defaults to default_image_alt
//
// Order matters: the first match wins, so an exact pattern must precede any
// `:param` pattern that would also match it.

// Cards shared by more than one route, so a card's path and alt are written
// once rather than restated per route. The league-surface card and the default
// card are applied in page-meta, not listed here.
const front_door_card = {
  og_image: '/static/images/social/league-front-door.png',
  og_image_alt:
    'GENESIS LEAGUE, a ten-team half-PPR superflex dynasty league with a salary cap, and its starting lineup of one quarterback, two running backs, two receivers, a tight end, a flex, a superflex and a defense'
}
const data_views_card = {
  og_image: '/static/images/social/data-views.png',
  og_image_alt:
    'A table of players sorted by yards per route, with position, team, targets and points columns'
}
const plays_card = {
  og_image: '/static/images/social/plays.png',
  og_image_alt:
    'A drive across a football field marked in ten-yard lines: a seven-yard rush, a twenty-four-yard pass, and a touchdown'
}

export const page_routes = [
  {
    pattern: '/',
    title: default_title,
    description: default_description,
    ...front_door_card
  },

  // Documents. These are the pages a recruiting link points at, so they carry
  // real copy rather than a bare noun.
  {
    pattern: '/constitution',
    title: 'Genesis League Constitution',
    description:
      'The rules of the GENESIS LEAGUE, adopted in 2020, with every ratified amendment and the date it passed.',
    og_type: 'article',
    og_image: '/static/images/social/constitution.png',
    og_image_alt:
      'The opening of the Genesis League Constitution, originally adopted in 2020, showing Article I on the formation and duration of the constitution'
  },
  {
    // The landing page's primary call to action, but deliberately not indexed:
    // the league does not advertise that a seat is open.
    pattern: '/waitlist',
    title: 'Join the Waitlist',
    description:
      'The waiting list for the GENESIS LEAGUE: a ten-team, half-PPR, superflex dynasty league with a salary cap, running since 2020.',
    robots: private_robots,
    og_image: '/static/images/social/waitlist.png',
    og_image_alt:
      'The Genesis League in figures: ten teams, a two hundred dollar salary cap, founded in 2020, nine starters, seven bench and four practice squad places, and six playoff teams'
  },
  {
    pattern: '/glossary',
    title: 'Glossary',
    description:
      'Fantasy football terminology, statistics, and abbreviations used across xo.football.',
    og_type: 'article',
    og_image: '/static/images/social/glossary.png',
    og_image_alt:
      'Glossary entries for snap share, expected points added, and average draft position'
  },
  {
    pattern: '/resources',
    title: 'Resources',
    description:
      'Reference material and external resources for fantasy football research.',
    og_type: 'article',
    og_image: '/static/images/social/resources.png',
    og_image_alt:
      'The resource directory sections: stats and research, projections, rankings and ADP, premium content, forums, trade tools, libraries, blogs and NFL draft'
  },
  {
    pattern: '/guides/data-views',
    title: 'Data Views Guide',
    description:
      'How to build a custom data view: choosing columns, filtering, splitting by season or week, and saving a view.',
    og_type: 'article',
    ...data_views_card
  },
  {
    // The SPA redirects /about to the landing page, so the canonical is the
    // landing page rather than this path — otherwise the two compete as
    // duplicate content for the same copy.
    pattern: '/about',
    title: default_title,
    description: default_description,
    canonical_path: '/',
    ...front_door_card
  },

  // Public analytics surfaces.
  {
    pattern: '/data-views',
    title: 'Data Views',
    description:
      'Build custom NFL and fantasy football tables from projections, betting markets, play-by-play, and league data.',
    ...data_views_card
  },
  {
    // A saved view id resolves to a user-owned view with no public flag, so the
    // title stays generic — naming the view would leak private view names to
    // anyone who guessed an id.
    pattern: '/data-views/:view_id',
    title: 'Data Views',
    description:
      'Build custom NFL and fantasy football tables from projections, betting markets, play-by-play, and league data.',
    ...data_views_card
  },
  {
    pattern: '/plays',
    title: 'Plays',
    description:
      'Search and filter NFL play-by-play, with situational, personnel, and win-probability splits.',
    ...plays_card
  },
  {
    pattern: '/plays/:view_id',
    title: 'Plays',
    description:
      'Search and filter NFL play-by-play, with situational, personnel, and win-probability splits.',
    ...plays_card
  },
  {
    pattern: '/status',
    title: 'Status',
    description:
      'Operational status of the data imports, projections, and jobs behind xo.football.'
  },

  // League surfaces. The extractor prefixes the league name onto these titles
  // when it can resolve one; the copy here is the fallback.
  {
    pattern: '/leagues/:lid/players',
    title: 'Players',
    description: 'League player pool, salaries, and availability.'
  },
  {
    pattern: '/leagues/:lid/auction',
    title: 'Auction',
    description: 'Live free agency auction.'
  },
  {
    pattern: '/leagues/:lid/draft',
    title: 'Rookie Draft',
    description: 'Rookie draft board and pick clock.'
  },
  {
    pattern: '/leagues/:lid/matchups',
    title: 'Matchups',
    description: 'Weekly matchups and scoring.'
  },
  {
    pattern: '/leagues/:lid/matchups/*',
    title: 'Matchups',
    description: 'Weekly matchups and scoring.'
  },
  {
    pattern: '/leagues/:lid/standings',
    title: 'Standings',
    description: 'League standings, records, and playoff position.'
  },
  {
    pattern: '/leagues/:lid/stats',
    title: 'Stats',
    description: 'League and team statistics by season.'
  },
  {
    pattern: '/leagues/:lid/schedule',
    title: 'Schedule',
    description: 'League calendar, matchup schedule, and playoff weeks.'
  },
  {
    pattern: '/leagues/:lid/rosters',
    title: 'Rosters',
    description: 'Every roster in the league, by slot and salary.'
  },
  {
    pattern: '/leagues/:lid/transactions',
    title: 'Transactions',
    description: 'League transaction history.'
  },
  {
    pattern: '/leagues/:lid/waivers',
    title: 'Waivers',
    description: 'Waiver claims and FAAB bidding.'
  },
  {
    pattern: '/leagues/:lid/restricted-free-agency',
    title: 'Restricted Free Agency',
    description: 'Restricted free agency nominations, bids, and results.'
  },
  {
    pattern: '/leagues/:lid/restricted-free-agency/:season_year',
    title: 'Restricted Free Agency',
    description: 'Restricted free agency nominations, bids, and results.'
  },
  {
    pattern: '/leagues/:lid/trades',
    title: 'Trades',
    description: 'Completed trades with valuation at the time of the trade.'
  },
  {
    pattern: '/leagues/:lid/trades/:trade_id',
    title: 'Trades',
    description: 'Completed trades with valuation at the time of the trade.'
  },
  {
    pattern: '/leagues/:lid/teams',
    title: 'Teams',
    description: 'Team rosters, cap space, and draft picks.'
  },
  {
    pattern: '/leagues/:lid/teams/:tid',
    title: 'Team',
    description: 'Team roster, cap space, and draft picks.'
  },
  {
    // Candidate PII, so it stays out of an index regardless of the fact that
    // the API refuses anyone who does not manage a team in the league.
    pattern: '/leagues/:lid/waitlist-submissions',
    title: 'Waitlist Applications',
    description: 'Prospective manager applications.',
    robots: private_robots
  },
  {
    // Before the bare admission-vote pattern below it: first match wins, and a
    // `:param` pattern that also matched would take this page's title.
    pattern: '/leagues/:lid/admission-vote/commissioner',
    title: 'Admission Vote — Commissioner',
    description:
      'Open the admission vote, watch turnout, and admit the highest ranked candidate or pass.',
    robots: private_robots
  },
  {
    // Confidential ballots under Amendment XLIII Section 10(d), so private
    // robots for the same reason as the applications above.
    pattern: '/leagues/:lid/admission-vote',
    title: 'Admission Vote',
    description:
      'The confidential ranked ballot for admitting a manager, and its per-candidate point totals.',
    robots: private_robots
  },
  {
    pattern: '/leagues/:lid/settings',
    title: 'League Settings',
    description: 'League configuration.',
    robots: private_robots
  },
  {
    pattern: '/leagues/:lid/team-settings',
    title: 'Team Settings',
    description: 'Team configuration.',
    robots: private_robots
  },
  {
    pattern: '/leagues/:lid',
    title: 'Front Office',
    description:
      'League home: team values, upcoming deadlines, and recent transactions.'
  },

  // Authenticated or single-use surfaces. A crawler can render none of them and
  // several are a specific person's private state, so they stay out of an index.
  {
    pattern: '/login',
    title: 'Log In',
    description: 'Log in to xo.football.',
    robots: private_robots
  },
  {
    pattern: '/forgot-password',
    title: 'Reset Password',
    description: 'Request a password reset link.',
    robots: private_robots
  },
  {
    pattern: '/reset-password',
    title: 'Reset Password',
    description: 'Choose a new password.',
    robots: private_robots
  },
  {
    pattern: '/settings',
    title: 'Account Settings',
    description: 'Account settings.',
    robots: private_robots
  },
  {
    pattern: '/lineups',
    title: 'Lineups',
    description: 'Set your weekly starting lineup.',
    robots: private_robots
  },
  {
    pattern: '/trade',
    title: 'Trade',
    description: 'Propose and evaluate trades.',
    robots: private_robots
  },
  {
    pattern: '/u/:hash',
    title: 'Shared Link',
    description: 'Resolving a shared xo.football link.',
    robots: private_robots
  },
  {
    pattern: '/error-test',
    title: 'Error Test',
    description: 'Development error boundary test page.',
    robots: private_robots
  }
]

const split_segments = (path) =>
  path
    .split('/')
    .filter(Boolean)
    .map((segment) => decodeURIComponent(segment))

const pattern_matches = (pattern, segments) => {
  const pattern_segments = pattern.split('/').filter(Boolean)
  const params = {}

  for (let index = 0; index < pattern_segments.length; index++) {
    const pattern_segment = pattern_segments[index]

    // A `*` tail matches the rest of the path, however deep.
    if (pattern_segment === '*') return { params }

    const segment = segments[index]
    if (segment === undefined) return null

    if (pattern_segment.startsWith(':')) {
      params[pattern_segment.slice(1)] = segment
      continue
    }

    if (pattern_segment !== segment) return null
  }

  if (segments.length !== pattern_segments.length) return null

  return { params }
}

// Returns the matching route entry plus its extracted params, or null. Query
// strings and fragments are stripped first — a shared link routinely carries
// both and neither changes which page it is.
export const match_page_route = (url_path) => {
  if (!url_path) return null

  const path_only = url_path.split(/[?#]/)[0]
  const segments = split_segments(path_only)

  if (!segments.length) {
    const home = page_routes.find((route) => route.pattern === '/')
    return home ? { route: home, params: {} } : null
  }

  for (const route of page_routes) {
    if (route.pattern === '/') continue
    const match = pattern_matches(route.pattern, segments)
    if (match) return { route, params: match.params }
  }

  return null
}

export const route_robots = (route) =>
  (route && route.robots) || indexable_robots

export const route_og_type = (route) =>
  (route && route.og_type) || default_og_type
