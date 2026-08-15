-- STATUS: APPLIED 2026-08-15 against league_production
--
-- Amendment XLIII Admission Vote: a confidential ranked ballot bound to the
-- Team, a per-Candidate points tally, and the Commissioner's admit-or-pass
-- election recorded as an outcome on the vote row.
--
-- Six tables. The ballot is split across two of them because a ballot carries
-- facts about the (vote, Team) pair -- when it was submitted, and whether the
-- Commissioner transcribed it -- that must not be restated once per ranked
-- Candidate, where two rows of one ballot could disagree.
--
-- CONFIDENTIALITY. Section 10(e) makes ballots confidential and permits
-- disclosure of the per-Candidate point totals alone. league_reader belongs to
-- pg_read_all_data, so no per-table REVOKE narrows this and every read-only
-- session can reach the raw rows; /api/db/league/query is a second read path
-- that lands results in a synced, indexed thread timeline. Confidentiality
-- therefore rests on nobody querying the preference rows ad hoc, which is what
-- the table comments say in terms.

CREATE TABLE admission_votes (
  admission_vote_id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  league_id integer NOT NULL,
  season_year smallint NOT NULL,
  opened_at timestamptz NOT NULL,
  closes_at timestamptz NOT NULL,
  closed_at timestamptz,
  maximum_ranked_candidates smallint NOT NULL,
  vote_status text NOT NULL,
  decision_due_at timestamptz,
  decision_outcome text,
  decided_admission_vote_candidate_id integer,
  decided_at timestamptz,
  decision_reason text,

  CONSTRAINT admission_votes_status_vocabulary
    CHECK (vote_status IN ('open', 'closed')),

  -- Section 10: the stated number of Candidates a Team may rank "shall be not
  -- less than one (1)".
  CONSTRAINT admission_votes_maximum_ranked_candidates_floor
    CHECK (maximum_ranked_candidates >= 1),

  CONSTRAINT admission_votes_closes_after_opening
    CHECK (closes_at > opened_at),

  -- vote_status is not a decision state. A closed vote is exactly one that has
  -- been closed, so the row cannot claim a status its own timestamps deny.
  CONSTRAINT admission_votes_closed_status_matches_timestamp
    CHECK ((vote_status = 'closed') = (closed_at IS NOT NULL)),

  -- Section 11(a): the seven-day clock runs from the close of the Admission
  -- Vote, so the deadline and the tally are written by the same act.
  CONSTRAINT admission_votes_decision_due_at_set_on_close
    CHECK ((decision_due_at IS NOT NULL) = (closed_at IS NOT NULL)),

  -- Section 11(a) grants two elections and no third. There is deliberately no
  -- admit-someone-else outcome: the admitted Candidate is the highest ranked,
  -- and a tie is resolved by the Commissioner's ranking under Section 11(c)
  -- rather than by departing from the order.
  CONSTRAINT admission_votes_outcome_vocabulary
    CHECK (decision_outcome IN ('admitted', 'passed')),

  -- A decision is an act, so its outcome and its timestamp arrive together. A
  -- null outcome past decision_due_at is the Section 11(a) deemed pass, which
  -- is the absence of an act and so is derived rather than written -- nothing
  -- has to run for a Vacancy to stop being stranded.
  CONSTRAINT admission_votes_decision_recorded_together
    CHECK ((decision_outcome IS NULL) = (decided_at IS NULL)),

  CONSTRAINT admission_votes_decided_only_after_close
    CHECK (decided_at IS NULL OR closed_at IS NOT NULL),

  -- An admission names a Candidate; a pass names none.
  CONSTRAINT admission_votes_admitted_candidate_matches_outcome
    CHECK (
      (decided_admission_vote_candidate_id IS NOT NULL)
      = (decision_outcome = 'admitted')
    ),

  -- Section 11(b): on a pass the Commissioner "shall give Notice of the pass
  -- and of his reason for it".
  CONSTRAINT admission_votes_pass_states_a_reason
    CHECK (decision_outcome IS DISTINCT FROM 'passed' OR decision_reason IS NOT NULL)
);

-- A league runs one Admission Vote at a time. A second Vacancy runs a second
-- vote once the first has closed, so this bounds the open ones rather than the
-- total. A partial unique index rather than an EXCLUDE constraint, which for
-- integer equality would pull in btree_gist for nothing.
CREATE UNIQUE INDEX admission_votes_one_open_vote_per_league_season
  ON admission_votes (league_id, season_year)
  WHERE vote_status = 'open';

COMMENT ON TABLE admission_votes IS
  'Amendment XLIII Admission Vote. decision_outcome null past decision_due_at is the Section 11(a) deemed pass.';

-- Section 10(c): "A Team without a Manager shall not vote." Row presence in
-- users_teams cannot signal a seated Manager -- it has no role flag, every Team
-- carries a row including the vacant one, and two Teams carry two userids each
-- -- so eligibility is an explicit snapshot the Commissioner confirms when the
-- vote opens, never an inference. Frozen at open; a later change is a new row
-- superseding the old, both readable.
CREATE TABLE admission_vote_eligible_teams (
  admission_vote_id integer NOT NULL
    REFERENCES admission_votes (admission_vote_id) ON DELETE CASCADE,
  team_id integer NOT NULL,
  recorded_at timestamptz NOT NULL,
  recorded_reason text,

  PRIMARY KEY (admission_vote_id, team_id)
);

COMMENT ON TABLE admission_vote_eligible_teams IS
  'One row per Team entitled to a ballot, confirmed by the Commissioner at open. A Team with two userids gets one row.';

CREATE TABLE admission_vote_candidates (
  admission_vote_candidate_id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  admission_vote_id integer NOT NULL
    REFERENCES admission_votes (admission_vote_id) ON DELETE CASCADE,
  candidate_name text NOT NULL,

  -- The waitlist is the pool Candidates are drawn from, never a nomination
  -- channel, so a Candidate named on the Boards with no submission is ordinary
  -- rather than exceptional. Restricted so a submission cannot be deleted out
  -- from under a vote record that cites it.
  submission_id bigint
    REFERENCES manager_waitlist_submissions (submission_id) ON DELETE RESTRICT,

  -- Written at close. Derivable from the retained preferences, but pinning it
  -- fixes what the decision was actually made on, so a later scoring change
  -- cannot rewrite history.
  points_total integer,

  CONSTRAINT admission_vote_candidates_points_total_not_negative
    CHECK (points_total IS NULL OR points_total >= 0),

  CONSTRAINT admission_vote_candidates_name_unique_per_vote
    UNIQUE (admission_vote_id, candidate_name)
);

COMMENT ON COLUMN admission_vote_candidates.points_total IS
  'Section 10(e) discloses this figure for each Candidate to any Manager on request. Written at close.';

-- Section 9(c): "An individual nominated by more than one (1) Manager is one
-- (1) Candidate, and each Manager who nominated him is a Sponsor." The key
-- stops a Team sponsoring the same Candidate twice and inflating the Notice.
CREATE TABLE admission_vote_candidate_sponsors (
  admission_vote_candidate_id integer NOT NULL
    REFERENCES admission_vote_candidates (admission_vote_candidate_id) ON DELETE CASCADE,
  team_id integer NOT NULL,

  PRIMARY KEY (admission_vote_candidate_id, team_id)
);

-- One row per (vote, Team) that has voted. The foreign key to the eligibility
-- snapshot makes "a Team without a Manager shall not vote" a database
-- invariant rather than an application test, and keying on team_id rather than
-- userid gives a Team with two userids one ballot.
CREATE TABLE admission_vote_ballots (
  admission_vote_id integer NOT NULL,
  team_id integer NOT NULL,
  submitted_at timestamptz NOT NULL,

  -- Section 10 does not provide for a Manager who cannot reach the app, so the
  -- Commissioner transcribes a ranking sent to him directly. Null means the
  -- Manager cast it himself; non-null states why it was transcribed, so a
  -- transcription cannot be made without a recorded reason. It is one column
  -- rather than a flag plus a reason because the two could otherwise disagree.
  --
  -- Two rules the application enforces and this table cannot: a transcribed
  -- ballot is refused once closes_at has passed, whether or not the
  -- Commissioner has pressed close, and it is refused for a Team that already
  -- has a ballot. Replacement is the Manager's own act alone, so no ballot can
  -- be written or overwritten by anyone who has seen the tally.
  commissioner_entered_reason text,

  PRIMARY KEY (admission_vote_id, team_id),
  FOREIGN KEY (admission_vote_id, team_id)
    REFERENCES admission_vote_eligible_teams (admission_vote_id, team_id) ON DELETE CASCADE
);

COMMENT ON TABLE admission_vote_ballots IS
  'Confidential under Section 10(e). Do not query this table or its preferences ad hoc: only the per-Candidate totals may be disclosed, and /api/db/league/query lands results in a synced, indexed timeline.';

CREATE TABLE admission_vote_ballot_preferences (
  admission_vote_id integer NOT NULL,
  team_id integer NOT NULL,
  admission_vote_candidate_id integer NOT NULL
    REFERENCES admission_vote_candidates (admission_vote_candidate_id) ON DELETE CASCADE,

  -- Section 10(b) scores from the Commissioner's stated maximum, never from
  -- ballot length, so a Team ranking two does not give its favourite less
  -- weight than a Team ranking six. The bound is enforced at submit against
  -- admission_votes.maximum_ranked_candidates, so the scoring function never
  -- discards a row.
  preference_rank smallint NOT NULL,

  PRIMARY KEY (admission_vote_id, team_id, admission_vote_candidate_id),
  FOREIGN KEY (admission_vote_id, team_id)
    REFERENCES admission_vote_ballots (admission_vote_id, team_id) ON DELETE CASCADE,

  CONSTRAINT admission_vote_ballot_preferences_rank_floor
    CHECK (preference_rank >= 1),

  -- A Team cannot rank two Candidates at the same preference.
  CONSTRAINT admission_vote_ballot_preferences_rank_unique_per_ballot
    UNIQUE (admission_vote_id, team_id, preference_rank)
);

COMMENT ON TABLE admission_vote_ballot_preferences IS
  'Confidential under Section 10(e). Reaching an individual ballot takes a deliberate query; no UI renders one, for any caller including the Commissioner.';

GRANT SELECT, INSERT, UPDATE, DELETE ON admission_votes TO league_writer;
GRANT SELECT, INSERT, UPDATE, DELETE ON admission_vote_eligible_teams TO league_writer;
GRANT SELECT, INSERT, UPDATE, DELETE ON admission_vote_candidates TO league_writer;
GRANT SELECT, INSERT, UPDATE, DELETE ON admission_vote_candidate_sponsors TO league_writer;
GRANT SELECT, INSERT, UPDATE, DELETE ON admission_vote_ballots TO league_writer;
GRANT SELECT, INSERT, UPDATE, DELETE ON admission_vote_ballot_preferences TO league_writer;
