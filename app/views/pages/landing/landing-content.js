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

// Base, the system the agent sessions that build this platform run on. THE
// ROOT AND NOT A SESSION: an individual thread is readable only to an account
// that owns it, and an anonymous visitor gets the page with its body masked —
// measured at 11,202 of 13,342 characters replaced by block glyphs, which
// reads as a leak wall rather than as work in the open. The root renders in
// the clear and is the only target here that does.
export const base_url = 'https://base.tint.space'

// THE DECK QUALIFIES THE HEADLINE RATHER THAN RESTATING IT, and that is why it
// is page copy instead of `site_tagline`. The tagline is a STANDALONE sentence
// — it is the meta description, the README's opening line and the GitHub repo
// description, all places where it is read with no headline above it, so it has
// to name the platform itself: "An open-source platform for managing fantasy
// football leagues…". Directly under an h1 that already says "an open-source
// fantasy football platform", that opening clause is the same sentence twice.
//
// So the tagline keeps its three jobs untouched and the deck stops being a copy
// of it. What the headline cannot carry is what the site actually holds, which
// is what this says: the two halves, leagues and research, in that order.
//
// NO COUNTS OR SEASON NUMBERS HERE. test/libs-shared.social-meta-copy.spec.mjs
// scans the landing copy for a hardcoded season count, since a number typed
// into a sentence goes stale in September and nothing reports it.
// LEADS WITH THE DATA AND NOT WITH THE HOSTED LEAGUE. The league this was
// built for is one of the things the platform runs, not the subject — a
// visitor arriving cold is doing NFL research far more often than he is
// shopping for a league to join, and a deck that opens on a dynasty league
// speaks to the rarer of the two.
//
// It NAMES the sources rather than characterising them. "Comprehensive data"
// is a claim a reader cannot check; three named sources and the two things
// he can do with them are the same statement in a form he can go verify, in
// one click, from the entry directly below.
export const hero_deck =
  'Projections, betting markets and play-by-play, in tables you build and save. Agent-built views and league import are next.'

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
    // THE AVAILABILITY LIVES HERE, ON THE ACCOUNT, NOT ON EACH FEATURE. It was
    // a per-entry `on request` note beside Agent-built views, which stated a
    // property of the ACCOUNT as though it were a property of that one
    // capability — and would have to be repeated on the next gated thing. An
    // account is invite only and everything an account unlocks inherits that,
    // so the section says it once and the entries below say what they are.
    blurb: 'An account saves your work. Invite only, and by request.',
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
        // POINTS AT WHERE THE FEATURE LIVES, like Saved views above it. The
        // control is rendered inside data views for an account carrying
        // `users.data_view_generation_is_enabled`, so that is its destination —
        // it never had a page of its own, which is the only reason it was a
        // bare entry. The entitlement is not restated here: the section blurb
        // says an account is invite only and by request, and this is one of the
        // things an account unlocks.
        label: 'Agent-built views',
        to: '/data-views',
        description:
          'Describe a table; an agent builds everything else — columns, filters, splits — and shows you what it ran.'
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
    // NAMES WHAT THE SOFTWARE DOES, NOT WHAT THE OPERATOR HOSTS. This said
    // "The platform hosts dynasty leagues — …", which made the section an
    // offer of a service and put the one league that exists at the centre of
    // the front door. The same list of mechanisms reads as a feature set
    // instead, and every one of them is checkable in the live league linked
    // below — which is the point of naming them rather than calling the
    // ruleset deep.
    blurb:
      'Auctions, rookie drafts, waivers, restricted free agency, franchise tags and a salary cap.',
    links: [
      // THE SOFTWARE FIRST, THE ONE LEAGUE SECOND. These were the other way
      // round, which put the hosted league at the top of the section and made
      // the front office read as a detail of it. The front office is the
      // functionality; Genesis is one league running on it, and the reason it
      // stays on the page at all is that it is the thing a reader can open to
      // check that any of the above is real.
      {
        label: 'League front office',
        to: '/leagues/1',
        description:
          'Rosters, standings, matchups, trades and the live auction, as a manager sees them.'
      },
      {
        label: 'Genesis League',
        to: '/genesis-league',
        description:
          'The dynasty league this was built for. Published constitution, public transaction record.'
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
          'The whole platform — the app, the API, the data pipeline and the rules it enforces.'
      },
      {
        label: 'About',
        to: '/about',
        description: 'What it does today, and how to contribute.'
      },
      {
        label: 'Built with Base',
        href: base_url,
        description:
          'The platform is developed with agent sessions running on Base, the system that directs and records them.'
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
