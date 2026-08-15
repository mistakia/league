// Copy and link targets for the landing page, kept apart from the markup so a
// document that becomes public later is a one-line edit rather than a JSX edit.
//
// Several league documents are written but not yet published. Each is listed
// here with `url: null` and is not rendered until it has one — a trust page
// that advertises a document it cannot show is worse than one that stays quiet
// about it.

export const league_documents = [
  {
    title: 'Constitution',
    description:
      'The rules themselves, plus every ratified amendment with the date it passed.',
    url: '/constitution'
  },
  {
    title: 'League summary',
    description:
      'What a manager decides across the year, in order, from extensions through the championship.',
    url: null
  },
  {
    title: 'Valuation primer',
    description:
      'How team and player value get computed, including what the numbers cannot tell you.',
    url: null
  },
  {
    title: 'Verifiable randomness method',
    description:
      'The full specification for how a draw is committed to and how anyone re-checks it.',
    url: null
  }
]

// The vetting questionnaire does not exist yet. Until it does, the funnel ends
// at Discord, which is where league conversation already happens.
export const questionnaire_url = null

export const league_format = [
  'Ten teams, half-PPR, superflex. Two divisions, redrawn every year by a public draw rather than by my preference.',
  'Dynasty with a salary cap. Players extend automatically up a fixed ladder each offseason, so the real decision is who you let go.',
  'One franchise tag, two restricted free agency nominations, and one rookie tag per year.',
  'Rookie draft on a pick clock, then a free agency auction for whoever is left. FAAB waivers run Wednesdays in season.',
  'Wildcard in Week 15, championship scored across Weeks 16 and 17.'
]

export const manager_expectations = [
  'Set a lineup every week. Missing them repeatedly is how a dynasty league dies, and the constitution treats it as abandonment.',
  'Be reachable during the rookie draft. Picks run on a four-hour clock and an unmade pick is forfeited.',
  'Rename your team every year. It is a real rule, it is in the constitution, and people take it seriously.',
  'Expect to be outvoted sometimes. Rules change by recorded vote and the history of those votes is public.'
]
