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
    blurb: 'Public, and usable without an account.',
    links: [
      {
        label: 'Data views',
        to: '/data-views',
        description:
          'Tables built from projections, betting markets, play-by-play and league data, then filtered, split and saved.'
      },
      {
        label: 'Plays',
        to: '/plays',
        description:
          'NFL play-by-play, searchable by situation, personnel and win probability.'
      },
      {
        label: 'Data views guide',
        to: '/guides/data-views',
        description: 'How to build, split and save one.'
      },
      {
        label: 'Glossary',
        to: '/glossary',
        description: 'Every statistic and abbreviation used on the site.'
      },
      {
        label: 'Resources',
        to: '/resources',
        description:
          'Research, projections, rankings and trade tools elsewhere.'
      }
    ]
  },
  {
    // NEITHER OF THE TWO LINKLESS ENTRIES CAN BECOME A LINK by choosing a
    // better path: /login and /settings both carry private_robots, and
    // test/app.landing-links.spec.mjs fails on a landing entry naming one.
    // Their `note` is what says so to a reader.
    title: 'Accounts',
    blurb: 'An account saves your work.',
    links: [
      {
        // NOT "a saved view gets a link" — a share link is generated for any
        // view, account or not, and can be kept by hand. Keeping the view
        // itself is the whole of what the account adds.
        label: 'Saved views',
        to: '/data-views',
        description:
          'Build and share views without an account. An account is what keeps them.'
      },
      {
        // The entitlement is `users.data_view_generation_is_enabled`, NOT NULL
        // DEFAULT false, and the control is hidden outright for an account
        // without it — so "on request" is the literal mechanism rather than a
        // softer word for unavailable.
        label: 'Agent-built views',
        description:
          'Describe a table; an agent builds everything else — columns, filters, splits — and shows you what it ran.',
        note: 'on request'
      },
      {
        // MOVED HERE FROM `Leagues`, AND DELIBERATELY REFRAMED. The previous
        // copy — "in development and not yet enabled" — described a door that
        // is shut, which is the register of a private beta. The adapters are
        // real and what does not exist is a connect flow a visitor can drive
        // alone, so the sentence names the missing work rather than a gate.
        // The `in development` note already carries the availability, so the
        // description does not restate it — it says what the thing IS.
        label: 'League import',
        description:
          'View and manage a league hosted on Sleeper, ESPN or elsewhere.',
        note: 'in development'
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
          'The dynasty league this was built for. Published constitution, public transaction record.'
      },
      {
        label: 'League front office',
        to: '/leagues/1',
        description:
          'Rosters, standings, matchups, trades and the live auction, as a manager sees them.'
      }
      // League import used to sit here. It moved to `Accounts` above, where it
      // belongs beside the other capability that runs work on a reader's
      // behalf — this section is about the leagues the platform HOSTS.
    ]
  },
  {
    title: 'The project',
    blurb: 'Open source, and looking for people to build and test it.',
    links: [
      {
        label: 'Source on GitHub',
        href: github_url,
        description:
          'The transaction rules, the cap arithmetic and the scoring, all readable.'
      },
      {
        label: 'About',
        to: '/about',
        description: 'What it does today, and how to contribute.'
      },
      // NO `/status` ENTRY, by operator ruling. The route exists and is
      // indexable, so the link gate would have accepted it — this is a decision
      // about what the front door promotes, not a constraint.
      {
        label: 'Discord',
        href: discord_url,
        description: 'Questions, and where contributors coordinate.'
      }
    ]
  }
]
