// The manager vetting questionnaire, defined ONCE for every consumer: the
// public form renders from it, the API validates against it, and the managers'
// reading page labels stored answers with it.
//
// WHY IT IS ISOMORPHIC AND NOT A DATABASE SCHEMA. The first version of this
// gave every question its own typed column, which made rewording a prompt a
// content edit but made ADDING, REMOVING or REORDERING one a production
// migration plus a schema export plus a fixture change. A questionnaire is
// exactly the kind of thing that gets edited between rounds -- two questions
// were cut and one rewritten before it had taken a single response -- so the
// answers live in a jsonb column keyed by the `id` below and this file is the
// only place the question set exists.
//
// The rule that keeps that honest: an `id` here is a STORED KEY. Reword a
// `label` freely; changing an `id` orphans every answer already recorded under
// the old one. If you must, bump the version and map it at read time.
//
// WHAT STAYS A REAL COLUMN. Contact details, the timezone and the commitment
// affirmation are not questionnaire content -- they are how the Commissioner
// reaches someone and what the league needs on record -- so they keep typed
// columns and are absent from `questions`.

// Bump when the question set changes in a way that makes two rounds' answers
// non-comparable. Stored per row so a mixed table stays readable.
export const manager_waitlist_questionnaire_version = 2

export const MAX_SHORT_ANSWER_LENGTH = 200
export const MAX_LONG_ANSWER_LENGTH = 4000

// THE COMMITMENT, stated up front and affirmed with a checkbox rather than
// asked as a question. Asking "how many years are you looking to commit to?"
// invites the answer the reader thinks we want and tells us nothing; stating
// what the league actually expects and requiring an explicit yes is both
// shorter and harder to fake.
export const commitment_terms = [
  'This is a dynasty league. Rosters carry over every year, so a manager who leaves mid-rebuild takes the value of somebody else’s trade with them. Joining means planning to be here for several seasons, not one.',
  'The offseason is most of the year and is not optional. Restricted free agency runs about two weeks in May or June, the rookie draft follows on a pick clock and takes a month or more, and the free agency auction is in the days before the season starts.'
]

// The other half of the same disclosure, and deliberately a SEPARATE list. The
// section above is what the league requires — it is what the checkbox affirms,
// and it has to stay short enough that affirming it means something. This one
// is what the league is hoping for, which nobody can promise and which should
// not be folded into a binding statement.
//
// Note what is NOT here: anything about being easy to get along with. That is a
// deliberate omission — the league is filling a seat, and every item below is
// about engagement rather than temperament.
export const what_we_look_for = [
  'Someone who is actually around. The league moves most in the months when nothing is on television, and the people who enjoy it are the ones who are there for that part.',
  'Someone who likes the machinery. Contracts, the cap, restricted free agency, a constitution with 42 amendments — if that reads as the fun part rather than as homework, you will fit here.',
  'A real dynasty interest. Not just who is good this year, but who you want to still own in three years and what you would give up to get them.',
  'Someone who trades and talks. A quiet team that sets a lineup and disappears is worse for the league than a bad one.'
]

export const commitment_affirmation_label =
  'I have read the above and I am up for it.'

// Typed columns, not questionnaire content. `column` is the physical column.
export const contact_fields = [
  {
    column: 'candidate_name',
    label: 'Name',
    help: 'Or a nickname — whatever you want to be called.',
    required: true,
    max: MAX_SHORT_ANSWER_LENGTH
  },
  {
    column: 'contact_email',
    label: 'Email',
    required: true,
    type: 'email',
    max: MAX_SHORT_ANSWER_LENGTH
  },
  {
    column: 'contact_handle',
    label: 'Discord, or wherever else you would rather be reached',
    required: false,
    max: MAX_SHORT_ANSWER_LENGTH
  },
  {
    column: 'timezone_name',
    label: 'Where are you, roughly, and what hours do you keep?',
    help: 'Draft picks run on a clock during waking hours Eastern, so this is really a question about whether that works for you.',
    required: true,
    max: MAX_SHORT_ANSWER_LENGTH
  },
  {
    column: 'requested_seat',
    label: 'Is there a particular team you are interested in?',
    help: 'Optional. One seat is confirmed open; if others come free we will come back to you.',
    required: false,
    max: MAX_SHORT_ANSWER_LENGTH
  }
]

// The questionnaire proper. Every answer is stored under `id` in the
// `responses` jsonb column.
// A question carrying `options` is a CLOSED VOCABULARY: the form renders a
// select and the API refuses any value not in the list, so these answers are
// comparable across candidates in a way prose never is. That is the whole
// reason the two questions below are ranges rather than text — "how active are
// you?" invites an adjective, while a range is a number someone has to pick.
export const questions = [
  {
    // The call's phrasing, kept: a range is a commitment, an adjective is not.
    // This replaces the cut "how active are you in an offseason?", which asked
    // a candidate to self-report a trait the page had already said it required.
    id: 'weekly_time_commitment',
    label: 'How much time a week do you expect to give this league?',
    help: 'Averaged over a year, offseason included. Nobody is held to it — we ask because the honest answers cluster, and a league that expects more than someone has is how people quietly stop showing up.',
    options: [
      'Under an hour',
      '1 to 2 hours',
      '2 to 4 hours',
      '4 to 8 hours',
      'More than 8 hours'
    ],
    required: true
  },
  {
    // Counts what they are ALREADY carrying, which is the constraint the answer
    // above is spent against. Someone in ten leagues giving four hours a week
    // is telling you something different from someone in one.
    id: 'active_league_count',
    label: 'How many fantasy leagues are you in right now?',
    options: [
      'This would be my first',
      '1 or 2',
      '3 to 5',
      '6 to 9',
      '10 or more'
    ],
    required: true
  },
  // THE TWO SCREENING QUESTIONS, and the only ones on the form that are tests
  // rather than disclosures. They sit here — after the two instant ranges and
  // before the credentials — on purpose: a candidate who cannot answer them is
  // the candidate the form exists to filter, and it is better for everyone that
  // they find that out on question three than after ten minutes of writing.
  //
  // They measure different things and neither substitutes for the other. The
  // first is a KNOWLEDGE FLOOR: naming players past ADP 100 is trivial for
  // someone who follows closely and effectively impossible for someone who
  // drafts off a printed cheat sheet. The second is REASONING: anyone can look
  // up a deep sleeper list, but saying which way the market is wrong and why
  // exposes whether there is a process behind the names.
  //
  // Both are deliberately un-gradeable by the software. There is no answer key,
  // because the point is not whether the managers AGREE — a candidate who is
  // confidently wrong in an interesting way is a better sign than one who is
  // vaguely right — and because these are the answers the managers will most
  // want to read before the ranking vote.
  {
    id: 'deep_player_targets',
    label:
      'Name two or three players going outside the top 100 (ADP 100+) that you want, and say why.',
    help: 'This is the question on the form that is hardest to answer if you do not follow closely, which is exactly why it is here. We are not checking whether we agree with you — we are reading the reasoning.',
    required: true,
    max: MAX_LONG_ANSWER_LENGTH
  },
  {
    id: 'market_disagreement',
    label: 'Name a player the market has wrong, and say which way.',
    help: 'Over or under, dynasty or redraft, your call. The interesting part is what you think everyone else is missing.',
    required: true,
    max: MAX_LONG_ANSWER_LENGTH
  },
  {
    id: 'dynasty_experience',
    label: 'What leagues have you played in, and where can we see them?',
    // Asked this way because the previous phrasing ("what dynasty and
    // salary-cap leagues have you played in?") reliably produced "a few,
    // mostly dynasty", which cannot be checked or compared. Naming the three
    // things we want gets three things.
    help: 'Name them, say which platform each is on (Sleeper, MFL, Fleaflicker, ESPN, here), and how many years you were in each. If a league has a public page, paste the link — it is the fastest way for us to see you have done this before. If none of them are public, say so and tell us who could vouch for you.',
    required: true,
    max: MAX_LONG_ANSWER_LENGTH
  },
  {
    // Was "how did each of those leagues end, if they ended?", which had three
    // problems: it asked about OTHER PEOPLE's leagues dying, which a candidate
    // often does not truly know the reason for and which nobody can check; the
    // "if they ended" clause handed over a complete non-answer ("none of them,
    // still in all of them"); and it scaled with the previous question, so
    // someone who listed five leagues faced five paragraphs at the point they
    // are most likely to quit the form.
    //
    // Attrition is the thing being predicted, and the honest instrument for it
    // is the candidate's OWN leaving rather than a league's ending. This
    // version is about them, is answerable in a sentence, and has no polite
    // way to decline.
    id: 'prior_departures',
    label:
      'Have you ever left a league, or stopped playing one out? What happened?',
    help: 'Everyone has. The answer we are wary of is not "yes" — it is "no, never" from someone who has been in nine leagues.',
    required: true,
    max: MAX_LONG_ANSWER_LENGTH
  },
  {
    id: 'commissioner_disagreement',
    label:
      'A commissioner makes a ruling you think is wrong. What do you actually do?',
    required: true,
    max: MAX_LONG_ANSWER_LENGTH
  }
]

// A hidden input no person ever sees or fills. Its NAME is what makes it work --
// a form-filling bot populates every input it finds, and a field called
// something plausible is one it will fill. Keep it looking ordinary.
export const honeypot_field_name = 'league_website'
