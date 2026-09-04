// The site's front door, kept apart from the markup so a change of copy or of
// destination is a one-line edit rather than a JSX edit.
//
// THIS PAGE SPEAKS FOR THE PLATFORM, NOT FOR ANY ONE LEAGUE. The Genesis
// League has its own page at /genesis-league and is linked from here as one of
// the things the platform runs — it is not the subject. The median reader
// arriving cold is doing NFL research or looking for somewhere to run a
// league, and the page is ordered for him.
//
// EVERY `to` BELOW MUST BE A ROUTE THAT EXISTS AND IS INDEXABLE.
// test/app.landing-links.spec.mjs resolves each one against
// libs-shared/page-routes.mjs and fails on a path that matches nothing or that
// carries private_robots — a dead link on the front door is the one link on
// the site nobody can afford, and a private route listed here would advertise
// a surface the table deliberately keeps out of an index.

export const github_url = 'https://github.com/mistakia/league'
export const discord_url = 'https://discord.com/invite/azSX97Qj9Z'

// The hero's two actions. The primary is the strongest thing the platform
// ships and the one that needs no account; the secondary is the claim the
// whole page rests on, which is checkable rather than assertable.
export const primary_action = { label: 'Explore the data', to: '/data-views' }
export const secondary_action = { label: 'Read the source', href: github_url }

// The site graph. Three groups in the order the median reader wants them, each
// entry a destination and one line saying what is there. Deliberately a short
// curated list rather than a projection of page-routes.mjs: that table's
// descriptions are written as search snippets and read as boilerplate stacked
// twelve deep, and half its entries are `:param` variants of a page already
// named here.
export const landing_sections = [
  {
    title: 'Research',
    blurb:
      'Public, and usable without an account. This is most of what the site is.',
    links: [
      {
        label: 'Data views',
        to: '/data-views',
        description:
          'Build a table from projections, betting markets, play-by-play and league data, then filter, split and save it.'
      },
      {
        label: 'Plays',
        to: '/plays',
        description:
          'Search NFL play-by-play with situational, personnel and win-probability splits.'
      },
      {
        label: 'Data views guide',
        to: '/guides/data-views',
        description:
          'How to choose columns, filter, split by season or week, and save a view.'
      },
      {
        label: 'Glossary',
        to: '/glossary',
        description:
          'The statistics and abbreviations used across the site, defined.'
      },
      {
        label: 'Resources',
        to: '/resources',
        description:
          'Where else to look: stats and research, projections, rankings, and trade tools.'
      }
    ]
  },
  {
    title: 'Leagues',
    blurb:
      'The platform hosts dynasty leagues — auctions, rookie drafts, waivers, restricted free agency and a salary cap.',
    links: [
      {
        label: 'Genesis League',
        to: '/genesis-league',
        description:
          'The dynasty league this was built for, and the reason any of it works. Published constitution, public transaction record.'
      },
      {
        label: 'A league front office',
        to: '/leagues/1',
        description:
          'The league surfaces as a manager sees them: rosters, standings, matchups, trades and the live auction.'
      },
      {
        // NO LINK, DELIBERATELY. The adapters for Sleeper and ESPN exist and
        // are drivable by an operator, but there is no connect flow a visitor
        // can reach and the settings surface says so out loud. Naming it with
        // a link would send a reader to a dead end; naming it without one is
        // the honest version, and the operator's call — the feature is weeks
        // out, and the page will outlive the gap.
        label: 'Importing an existing league',
        description:
          'Bringing a Sleeper or ESPN league across is in development and not yet enabled.',
        note: 'in development'
      }
    ]
  },
  {
    title: 'The project',
    blurb:
      'Open source, actively developed, and looking for people to build and test it.',
    links: [
      {
        label: 'Source on GitHub',
        href: github_url,
        description:
          'The transaction rules, the cap arithmetic and the scoring are all readable before you rely on any of them.'
      },
      {
        label: 'About',
        to: '/about',
        description:
          'What the project is, what it does today, and how to contribute.'
      },
      {
        label: 'Status',
        to: '/status',
        description:
          'Whether the imports, projections and jobs behind the site are running.'
      },
      {
        label: 'Discord',
        href: discord_url,
        description: 'Questions, discussion, and where contributors coordinate.'
      }
    ]
  }
]
