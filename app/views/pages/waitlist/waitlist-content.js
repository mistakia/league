// The questions, kept apart from the markup so editing the questionnaire is a
// content edit rather than a JSX edit.
//
// `name` matches the column in manager_waitlist_submissions and the field list
// in api/routes/waitlist.mjs exactly. All three have to agree; the API is what
// enforces `required`, and this list is what a candidate reads.
//
// LENGTH IS THE DESIGN CONSTRAINT. Completion is the scarce resource, and every
// question added costs some fraction of the people who would have finished.
// Nine questions plus contact details is the budget, and it holds the form
// under ten minutes. Adding one means removing one.

// THE CONTINUITY SENTENCE IS A CLAIM WITH AN EXPIRY, AND SEATING SOMEONE IS
// WHAT EXPIRES IT. Re-derived 2026-08-15 against league_production: six seasons
// played to a champion (2020-2025), fifteen people have ever managed a team,
// twelve are still here, and all fifteen were present in 2020 — which is what
// makes "never seated anyone from outside" true rather than merely unrecorded.
//
// The moment this round seats a manager the third sentence is FALSE, and it is
// false in the flattering direction, so nothing about the page will look wrong.
// Rewrite it as part of seating, not later. The SQL to re-derive all four
// numbers, plus the three schema traps that inflate them (co-managers, existing
// 2027 rows, and vacancy not being visible as a team without a manager), is in
// user:text/home-dynasty-league/league-operations/league-manager-continuity.md
//
// Note "twelve managers" is not "twelve teams" — the league plays ten, and
// users_teams carries co-managers. Do not reconcile the two numbers by editing
// one of them.
export const intro = [
  'The GENESIS LEAGUE has an open seat for 2026. This is the whole application — there is no second round of forms.',
  'Six seasons since 2020. Fifteen people have ever managed a team here, twelve are still in it, and every one of them has been here since the first year.',
  'We have never seated anyone from outside that group, so this process is as new to us as it is to you. It is also why the questions below are blunt.',
  'Answers go to the current managers, who rank candidates and vote. Write like you are talking to them, because you are. A short honest answer beats a long careful one.'
]

export const contact_fields = [
  {
    name: 'candidate_name',
    label: 'Name',
    required: true
  },
  {
    name: 'contact_email',
    label: 'Email',
    required: true,
    type: 'email'
  },
  {
    name: 'contact_handle',
    label: 'Discord, or wherever else you would rather be reached',
    required: false
  },
  {
    name: 'timezone_name',
    label: 'Where are you, roughly, and what hours do you keep?',
    required: true,
    // The pick window is the one hard scheduling fact about this league, so the
    // question says what the answer is for rather than making them guess.
    help: 'Draft picks run on a clock between 11am and 11pm Eastern. Knowing your timezone tells us whether that window works for you.'
  }
]

export const questions = [
  {
    name: 'commitment_intent',
    label: 'How many years are you looking to commit to?',
    help: 'This is a dynasty league — rosters carry over and the rebuild horizon is measured in seasons. An honest two is more useful than an optimistic ten.'
  },
  {
    name: 'dynasty_experience',
    label: 'What dynasty and salary-cap leagues have you played in?'
  },
  {
    name: 'salary_cap_experience',
    label: 'How comfortable are you managing a cap across multiple seasons?',
    help: 'Players extend automatically up a fixed ladder each offseason, so the recurring decision is who you let go rather than who you sign.'
  },
  {
    name: 'contract_mechanics_comfort',
    label:
      'Franchise tags, restricted free agency, rookie tags — how much of that have you done before?',
    help: 'No experience is a fine answer. We would rather know than find out in May.'
  },
  {
    name: 'offseason_activity',
    label: 'How active are you in an offseason?',
    help: 'The offseason here is most of the year: restricted free agency, a rookie draft on a pick clock, then an auction.'
  },
  {
    name: 'rules_tolerance',
    label: 'How do you feel about a league with a lot of written rules?',
    help: 'The constitution is seven years old and carries 42 amendments. Some people find that reassuring and some find it exhausting; both are real answers.'
  },
  {
    name: 'commissioner_disagreement',
    label:
      'A commissioner makes a ruling you think is wrong. What do you actually do?'
  },
  {
    name: 'prior_league_history',
    label:
      'What leagues have you been in before, and how did each of them end?',
    help: 'Leagues end for ordinary reasons. We ask because how a league ended says more about what it is like to play in one than anything else on this form.'
  }
]

export const seat_field = {
  name: 'requested_seat',
  label: 'Is there a particular team you are interested in?',
  required: false,
  help: 'Optional. One seat is confirmed open; if others come free we will come back to you.'
}

// A hidden input no person ever sees or fills. Its NAME is what makes it work —
// a form-filling bot populates every input it finds, and a field called
// something plausible is one it will fill. Keep it looking ordinary.
export const honeypot_field_name = 'league_website'
