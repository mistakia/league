// Amendment XLIII Admission Vote vocabulary.
//
// The server writes only these codes; the client owns every human-readable
// label. Both sets are also CHECK constraints on `admission_votes`, so a value
// absent from here cannot be stored.
export const admission_vote_statuses = {
  // accepting ballots
  OPEN: 'open',
  // the tally is pinned and the decision window is running
  CLOSED: 'closed'
}

// Section 11(a) grants the Commissioner two elections and no third. There is
// deliberately no admit-someone-else outcome: the admitted Candidate is the
// highest ranked, and a tie is resolved by his ranking WITHIN the tie under
// Section 11(c) rather than by departing from the order.
export const admission_vote_outcomes = {
  // the highest ranked Candidate was admitted
  ADMITTED: 'admitted',
  // the Commissioner passed, with his reason recorded per Section 11(b)
  PASSED: 'passed'
}

// Section 11(a): "He shall admit or pass within seven (7) days of the close of
// the Admission Vote, and where he does neither he is deemed to have passed."
// Pinned onto the vote row at close as `decision_due_at`, so a later change to
// this number cannot retroactively re-judge a past vote.
export const admission_vote_decision_period_days = 7
