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
//
// Two facts, no argument for them. An applicant deciding whether to spend ten
// minutes on the form needs the shape of the obligation, not a case for why it
// is reasonable -- and the checkbox binds to these, so anything a reader has to
// interpret is something they cannot meaningfully affirm.
//
// NO NUMBER OF YEARS, DELIBERATELY. An earlier draft said "several seasons",
// which is unaffirmable, and the obvious fix looked like picking a figure. It
// is not: no manager commitment term exists anywhere -- not in the
// constitution, whose only stated term is the Commissioner's own two-year
// minimum, and not in the recruiting material. Writing "three seasons" beside a
// constitution reference would read as a rule the constitution does not
// contain, which is worse than vague: a commitment nobody can hold anyone to,
// presented as one they can. The ask is binary instead -- intending to stay
// rather than to try it -- which is both honest and something a checkbox can
// bind to.
//
// The eight months are May through December: restricted free agency opens in
// May or June, the rookie draft runs a month or more after it, the auction is
// in the days before kickoff, and the season plays out through Week 17 in late
// December. January to April is the only genuinely quiet stretch.
export const commitment_terms = [
  'This is a dynasty league. Joining means planning to stay.',
  'It is active about eight months a year, May through December. January to April is the only quiet stretch.'
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
  'Someone who is actually around. The league moves most in the months when nothing is on television.',
  'Someone who likes the machinery. Contracts, the cap, restricted free agency, a constitution with 42 amendments, verifiable draws, a platform built for this league and nothing else — if all of that reads as the fun part rather than as homework, you will fit here.',
  'Someone competitive who is good at this. A league is only as interesting as its hardest matchup, and there is nothing better than someone who runs their mouth and then backs it up.',
  'Someone who trades and talks.'
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
    help: 'Optional. If a seat comes free we will come back to you.',
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
    // Plural and open-ended on purpose. "Name a player" caps the answer at one
    // and reads as a quota to satisfy; someone with real opinions has several,
    // and how many they volunteer is itself a signal, so nothing here should
    // discourage them from emptying the list out.
    id: 'market_disagreement',
    label: 'Which players does the market have wrong, and which way?',
    help: 'As many as you like — one or a dozen. Over or under, dynasty or redraft, your call. The interesting part is what you think everyone else is missing.',
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
    // ATTRITION, ASKED AS A CHECKABLE FACT RATHER THAN A CONFESSION.
    //
    // This replaces "have you ever left a league, or stopped playing one out?
    // What happened?", which could not work: it asked a motivated applicant to
    // self-report the single thing most likely to cost them the seat. Its help
    // text made it worse by naming what we were wary of, so it told the reader
    // precisely what to write. Nobody was going to answer it honestly, and an
    // answer nobody gives honestly is worse than no question -- it consumes
    // form length and returns noise that reads like signal.
    //
    // Tenure is the same signal with the sign flipped. It is a thing people
    // are pleased to report, it is a number rather than a narrative, and --
    // unlike a departure -- it is VERIFIABLE: a league someone has been in for
    // six years has a page, a commissioner, and other members. The last
    // sentence of the help says we check, which deters inflation better than
    // any phrasing of the negative question could.
    //
    // The rest of the attrition read comes from evidence rather than claims:
    // the league list and links above, whoever will vouch, and the bad-season
    // scenario below, which asks about behaviour in the situation that
    // actually causes people to leave.
    id: 'longest_league_tenure',
    label:
      'What is the longest you have stayed in one league, and is it still going?',
    help: 'Link it if it is public, and name whoever runs it if they would vouch for you. This is the claim on the form we can most easily check, which is why it is the one worth making carefully.',
    required: true,
    max: MAX_LONG_ANSWER_LENGTH
  },
  {
    // The forward-looking half of the attrition pair above. `prior_departures`
    // asks what they have already done; this asks about the situation that
    // causes it, which in a dynasty league is almost always a lost season
    // rather than a lost interest.
    //
    // Deliberately a SCENARIO rather than "how do you handle a bad year?".
    // The general form invites a slogan -- nobody writes "badly" -- while a
    // concrete standing forces a description of what they would actually do,
    // and in dynasty that answer doubles as a skill signal: selling into a lost
    // season is the correct move and not everyone knows it.
    id: 'bad_season_response',
    label:
      'You are 2-8, you have lost two starters to injury, and you are getting the worst of every close game. What does the rest of your season look like?',
    help: 'This is the situation that ends most dynasty tenures, so it is worth being straight about it.',
    required: true,
    max: MAX_LONG_ANSWER_LENGTH
  },
  {
    id: 'commissioner_disagreement',
    label:
      'A commissioner makes a ruling you think is wrong. What do you actually do?',
    required: true,
    max: MAX_LONG_ANSWER_LENGTH
  },
  // THE LAST TWO ARE THE CANDIDATE'S, NOT OURS. Everything above is a question
  // the league chose; these two are the only places the candidate decides what
  // the managers read about him. They sit at the end because a candidate who
  // has just written five prose answers has already said most of it, and
  // whatever is still missing at that point is exactly what belongs here.
  //
  // BOTH OPTIONAL, AND THAT IS NOT A SOFTENING. A required letter is a sixth
  // long-form answer on a form whose scarce resource is completion. A required
  // video is worse: it filters on having a camera, somewhere to host the file,
  // and the willingness to be on it -- which is a screen on presentation, and
  // this form's whole design says personality is NOT a criterion. Left
  // optional, both are volunteered, and who volunteers them is itself a
  // reading the managers get for free.
  {
    id: 'admission_letter',
    label: 'Anything else you want the managers to know?',
    help: 'The managers read these and vote, so this is the one part of the form where you decide what they see. Make whatever case you want to make — or skip it.',
    required: false,
    max: MAX_LONG_ANSWER_LENGTH
  },
  {
    // `type` renders a single-line url input rather than the textarea every
    // other free-text question gets, and hands the format check to the browser.
    // There is deliberately no server-side url pattern: this is a link a
    // Manager clicks by hand, so a wrong one costs a click, while a regex
    // strict enough to be worth having rejects real urls on a form that cannot
    // afford to refuse a completed submission.
    //
    // A HOSTED LINK, BECAUSE THERE IS NO ALTERNATIVE. This repo has no upload
    // infrastructure of any kind, so the only shape a video can take here is
    // somewhere it already lives.
    id: 'intro_video_url',
    label: 'A link to a short video of yourself, if you want to record one.',
    help: 'Unlisted YouTube, Drive, Loom, whatever is easiest — just make sure the link opens for someone who is not you. A couple of minutes is plenty. Nobody is being judged on production values.',
    type: 'url',
    required: false,
    max: MAX_SHORT_ANSWER_LENGTH
  }
]

// A hidden input no person ever sees or fills. Its NAME is what makes it work --
// a form-filling bot populates every input it finds, and a field called
// something plausible is one it will fill. Keep it looking ordinary.
export const honeypot_field_name = 'league_website'
