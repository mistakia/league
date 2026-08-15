// Copy and link targets for the landing page, kept apart from the markup so a
// change of fact or of contact route is a one-line edit rather than a JSX edit.

// The vetting questionnaire, and the page's primary call to action. It is an
// in-site route rather than an external form: the argument this page makes is
// that the league runs on software I wrote and publishes what it does, and
// handing the reader off to a third-party form immediately after making that
// argument spends it rather than compounding it.
export const questionnaire_path = '/waitlist'

// The live league. It is publicly readable without an account, which is most of
// the argument this page is making — a prospect can go look rather than take my
// word for any of it.
export const league_url = '/leagues/1'

// Every claim here is checkable against the constitution. The offseason
// calendar is commissioner-set rather than fixed in the constitution, so the
// months are what a normal year looks like, not a rule.
export const league_format = [
  {
    title: 'Format',
    items: [
      'Ten teams, half-PPR, superflex.',
      'Dynasty with a salary cap. Players extend automatically up a fixed ladder each offseason, so the decision each year is who you let go.',
      'One franchise tag, two restricted free agency nominations, and one rookie tag per year.'
    ]
  },
  {
    title: 'Offseason',
    items: [
      'The offseason normally opens in May or June with restricted free agency, which runs about two weeks.',
      'The rookie draft follows on a pick clock and takes a month or more.',
      'The free agency auction comes last, in the days before the regular season, and FAAB waivers run Wednesdays from there on.'
    ]
  },
  {
    title: 'Postseason',
    items: [
      'Fourteen weeks of regular season decide six postseason places. The top two by all-play win percentage — how you would have done against every team every week — go straight to the championship round.',
      'The wildcard is Week 15 alone. Four teams play it, and the two highest scoring advance.',
      'The championship runs Weeks 16 and 17 across four teams, and the highest combined score over both weeks wins.'
    ]
  }
]
