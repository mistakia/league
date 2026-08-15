import express from 'express'

import { current_season } from '#constants'
import close_admission_vote from '#libs-server/close-admission-vote.mjs'
import get_admission_vote_totals from '#libs-server/get-admission-vote-totals.mjs'
import write_admission_vote_ballot from '#libs-server/write-admission-vote-ballot.mjs'
import {
  admission_vote_statuses,
  admission_vote_outcomes
} from '#libs-shared/constants/admission-vote-constants.mjs'

const router = express.Router()

// THE AMENDMENT XLIII ADMISSION VOTE, and the reason it is not mounted under
// /api/leagues.
//
// This router mounts AFTER the blanket auth guard in api/index.mjs, beside
// /api/me and /api/waitlist-submissions, so an anonymous caller is refused by
// the guard and never reaches a handler here. /api/leagues mounts ABOVE that
// guard and each of its routes carries its own predicate -- and the two live
// privacy holes in this repo were both a pre-guard route whose ownership
// predicate was inverted for callers with no token. Ballots are the most
// confidential rows in this schema, so they get the structural protection
// rather than another predicate to get right.
//
// CONFIDENTIALITY, Section 10(e). "He shall not disclose how a Team voted."
// What that forbids is disclosing a Team's ballot to OTHERS, so the rule here
// is ANOTHER Team's ranking, never any ranking at all: the only read onto the
// tally is get_admission_vote_totals, which selects from
// admission_vote_candidates alone, and the viewer block reports the caller's
// OWN ranking and nothing about any other Team -- never which Teams have voted
// and never what one of them ranked. Reaching another Team's ballot takes a
// deliberate query against the database.
//
// The caller's own ranking IS returned, keyed on a team_id derived from his own
// users_teams rows rather than from anything he sends, so a Manager replacing
// his ballot edits a rendered copy instead of re-ranking from scratch. This was
// absolute until 2026-08-15 -- no surface rendered an individual ballot for any
// caller -- which was a design property rather than a constitutional
// requirement, and the operator reversed it. The Commissioner gains nothing by
// it: he reaches his own ballot by the same path as anyone and no other.

/**
 * Who the caller is in this league, for the CURRENT season.
 *
 * Season-scoped deliberately: a Manager who left the league keeps his user
 * account and his historical users_teams rows, and voting on who joins is a
 * right of the sitting Managers. Same scoping as GET /api/me and
 * GET /api/waitlist-submissions.
 *
 * Row presence in users_teams cannot signal a seated Manager -- the table has
 * no role flag and the vacant Team carries rows like any other -- so this
 * answers only "may this caller read the vote", never "is this Team entitled to
 * a ballot". That second question is the eligibility snapshot's alone.
 */
const resolve_league_membership = async ({ db, league_id, user_id }) => {
  const league = await db('leagues').where({ uid: league_id }).first()

  if (!league) {
    return null
  }

  const teams = await db('teams')
    .join('users_teams', function () {
      this.on('users_teams.tid', '=', 'teams.uid')
      this.andOn('users_teams.season_year', '=', 'teams.season_year')
    })
    .where({
      'teams.lid': league_id,
      'teams.season_year': current_season.year,
      'users_teams.userid': user_id,
      'users_teams.season_year': current_season.year
    })
    .select('teams.uid as team_id')

  return {
    is_commissioner: league.commishid === user_id,
    team_ids: teams.map((team) => team.team_id)
  }
}

const get_league_id = (value) => {
  const league_id = Number(value)
  return Number.isInteger(league_id) && league_id > 0 ? league_id : null
}

// The most recent vote for a league. One at a time is the reality this models:
// a partial unique index already bounds a league to one OPEN vote per season,
// and a second Vacancy runs a second vote once the first has closed.
const get_latest_vote = ({ db, league_id }) =>
  db('admission_votes')
    .where({ league_id })
    .orderBy('opened_at', 'desc')
    .orderBy('admission_vote_id', 'desc')
    .first()

/**
 * Section 11(a): "where he does neither he is deemed to have passed."
 *
 * Derived, never stored. A deemed pass is the ABSENCE of an act, so nothing
 * writes it and no job has to run for a Vacancy to stop being stranded.
 */
const is_deemed_passed = (vote) =>
  Boolean(
    vote.closed_at &&
      !vote.decision_outcome &&
      vote.decision_due_at &&
      Date.now() > new Date(vote.decision_due_at).getTime()
  )

/**
 * Validate a submitted ranking against the vote's own terms.
 *
 * The bound is enforced here so the scoring function never has to discard a
 * row: Section 10(b) says a Candidate ranked below the stated number scores
 * nothing, and a row that can never score is a row that should not have been
 * accepted.
 *
 * @returns {string|null} An error message, or null when the ranking is good.
 */
const validate_ranking = ({ ranked_candidate_ids, vote, candidate_ids }) => {
  if (!Array.isArray(ranked_candidate_ids) || !ranked_candidate_ids.length) {
    return 'a ballot must rank at least one candidate'
  }

  if (ranked_candidate_ids.length > vote.maximum_ranked_candidates) {
    return `a ballot may rank at most ${vote.maximum_ranked_candidates} candidate(s)`
  }

  const seen = new Set()
  for (const candidate_id of ranked_candidate_ids) {
    if (!Number.isInteger(candidate_id)) {
      return 'invalid candidate id'
    }
    if (seen.has(candidate_id)) {
      return 'a candidate may appear only once in a ranking'
    }
    if (!candidate_ids.has(candidate_id)) {
      return 'candidate is not standing in this admission vote'
    }
    seen.add(candidate_id)
  }

  return null
}

/**
 * @swagger
 * /admission-votes:
 *   get:
 *     summary: Read the current Amendment XLIII admission vote
 *     description: |
 *       Restricted to the league's sitting managers. Returns the Notice (every
 *       Candidate and his Sponsors), the caller's own ballot state including
 *       his own team's ranking, and — once the vote has closed — the
 *       per-Candidate point totals Section 10(e) discloses. Never returns
 *       another team's ranking to any caller, the commissioner included.
 *     tags:
 *       - Admission votes
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: league_id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: The vote, or a null vote where the league has never held one
 *       400:
 *         description: Missing or malformed league_id
 *       401:
 *         description: Authentication required
 *       403:
 *         description: The caller does not manage a team in this league
 */
router.get('/', async (req, res) => {
  const { db, logger } = req.app.locals
  try {
    const league_id = get_league_id(req.query.league_id)
    if (!league_id) {
      return res.status(400).send({ error: 'missing league_id' })
    }

    const membership = await resolve_league_membership({
      db,
      league_id,
      user_id: req.auth.userId
    })

    if (!membership) {
      return res.status(400).send({ error: 'invalid league_id' })
    }

    if (!membership.is_commissioner && !membership.team_ids.length) {
      return res
        .status(403)
        .send({ error: 'you do not manage a team in this league' })
    }

    // Team names, so the Commissioner can build the eligibility snapshot and
    // record Sponsors by name rather than by id. Not confidential: the Notice
    // names every Sponsor in terms, and nothing here says how a Team voted.
    const league_teams = await db('teams')
      .where({ lid: league_id, season_year: current_season.year })
      .orderBy('uid', 'asc')
      .select('uid as team_id', 'name as team_name')

    const vote = await get_latest_vote({ db, league_id })

    if (!vote) {
      return res.send({
        vote: null,
        candidates: [],
        totals: [],
        league_teams,
        viewer: { is_commissioner: membership.is_commissioner }
      })
    }

    const { admission_vote_id } = vote

    const candidates = await db('admission_vote_candidates')
      .where({ admission_vote_id })
      .orderBy('candidate_name', 'asc')

    const sponsors = await db('admission_vote_candidate_sponsors')
      .leftJoin('teams', function () {
        this.on('teams.uid', '=', 'admission_vote_candidate_sponsors.team_id')
        this.andOn('teams.season_year', '=', db.raw('?', [vote.season_year]))
      })
      .whereIn(
        'admission_vote_candidate_sponsors.admission_vote_candidate_id',
        candidates.map((candidate) => candidate.admission_vote_candidate_id)
      )
      .select(
        'admission_vote_candidate_sponsors.admission_vote_candidate_id',
        'admission_vote_candidate_sponsors.team_id',
        'teams.name as team_name'
      )

    const eligible_teams = await db('admission_vote_eligible_teams')
      .where({ admission_vote_id })
      .select('team_id')

    const eligible_team_ids = new Set(eligible_teams.map((row) => row.team_id))

    // Aggregates only. Turnout says how many Teams have voted, never which, and
    // says nothing at all about how any of them ranked.
    const [ballot_counts] = await db('admission_vote_ballots')
      .where({ admission_vote_id })
      .count('* as ballot_count')
      .count({
        commissioner_entered_ballot_count: 'commissioner_entered_reason'
      })

    const viewer_team_id =
      membership.team_ids.find((team_id) => eligible_team_ids.has(team_id)) ??
      membership.team_ids[0] ??
      null

    const viewer_ballot = viewer_team_id
      ? await db('admission_vote_ballots')
          .where({ admission_vote_id, team_id: viewer_team_id })
          .first('submitted_at', 'commissioner_entered_reason')
      : null

    // THE CALLER'S OWN RANKING, and his own Team's alone.
    //
    // Section 10(e) says "He shall not disclose how a Team voted." That binds
    // the Commissioner against disclosing a Team's ballot to OTHERS; it says
    // nothing about a Manager reading his own. The absolute reading -- no
    // surface renders an individual ballot for any caller -- was a design
    // property rather than a constitutional requirement, and it made replacing
    // a ballot mean re-ranking from scratch. The operator reversed it.
    //
    // The predicate is `viewer_team_id`, which is derived from the CALLER'S
    // OWN users_teams rows and never from a request parameter, so there is no
    // team_id an attacker could supply to read someone else's ranking. The
    // Commissioner reaches this by exactly the same path and so sees his own
    // ballot and no other -- being the Commissioner grants nothing extra here,
    // which is the property the confidentiality rule actually turns on.
    //
    // Not gated on the vote being open. It is not a disclosure, so the sealing
    // status check that governs the tally has nothing to say about it, and a
    // Manager reading back what he himself submitted after the close is the
    // same act it was before.
    const viewer_preferences = viewer_ballot
      ? await db('admission_vote_ballot_preferences')
          .where({ admission_vote_id, team_id: viewer_team_id })
          .orderBy('preference_rank', 'asc')
          .pluck('admission_vote_candidate_id')
      : []

    res.send({
      vote: {
        ...vote,
        is_deemed_passed: is_deemed_passed(vote)
      },
      candidates: candidates.map((candidate) => ({
        ...candidate,
        sponsors: sponsors
          .filter(
            (sponsor) =>
              sponsor.admission_vote_candidate_id ===
              candidate.admission_vote_candidate_id
          )
          .map(({ team_id, team_name }) => ({ team_id, team_name }))
      })),
      // Empty while the vote is open. Sealing is a status check inside the
      // totals read, not a permission check here.
      totals: await get_admission_vote_totals({ admission_vote_id }),
      league_teams,
      eligible_team_ids: [...eligible_team_ids],
      ballot_count: Number(ballot_counts.ballot_count),
      commissioner_entered_ballot_count: Number(
        ballot_counts.commissioner_entered_ballot_count
      ),
      viewer: {
        is_commissioner: membership.is_commissioner,
        team_id: viewer_team_id,
        is_eligible: Boolean(
          viewer_team_id && eligible_team_ids.has(viewer_team_id)
        ),
        has_submitted_ballot: Boolean(viewer_ballot),
        submitted_at: viewer_ballot ? viewer_ballot.submitted_at : null,
        // His own ranking, in preference order, so replacing a ballot is an
        // edit rather than a re-entry. Empty when he has not voted.
        ranked_candidate_ids: viewer_preferences,
        is_commissioner_entered: Boolean(
          viewer_ballot && viewer_ballot.commissioner_entered_reason
        )
      }
    })
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.message })
  }
})

/**
 * @swagger
 * /admission-votes/{admission_vote_id}/ballot:
 *   post:
 *     summary: Submit or replace the caller's own confidential ranked ballot
 *     description: |
 *       Bound to the caller's team, never to his userid, so a team with two
 *       userids gets one ballot. Replaces any prior ballot for that team in a
 *       single transaction. Refused for a team absent from the eligibility
 *       snapshot, which is Section 10(c) — "A Team without a Manager shall not
 *       vote."
 *     tags:
 *       - Admission votes
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: The ballot was recorded
 *       400:
 *         description: Malformed request or an invalid ranking
 *       401:
 *         description: Authentication required
 *       403:
 *         description: The caller's team is not entitled to a ballot
 *       409:
 *         description: The admission vote is no longer open
 */
router.post('/:admission_vote_id/ballot', async (req, res) => {
  const { db, logger } = req.app.locals
  try {
    const league_id = get_league_id(req.body.league_id)
    if (!league_id) {
      return res.status(400).send({ error: 'missing league_id' })
    }

    const membership = await resolve_league_membership({
      db,
      league_id,
      user_id: req.auth.userId
    })

    if (!membership) {
      return res.status(400).send({ error: 'invalid league_id' })
    }

    const vote = await db('admission_votes')
      .where({
        admission_vote_id: Number(req.params.admission_vote_id),
        league_id
      })
      .first()

    if (!vote) {
      return res.status(400).send({ error: 'invalid admission_vote_id' })
    }

    // Both halves matter. `vote_status` covers a manual close, and `closes_at`
    // covers the window elapsing before anyone pressed it.
    if (
      vote.vote_status !== admission_vote_statuses.OPEN ||
      Date.now() >= new Date(vote.closes_at).getTime()
    ) {
      return res.status(409).send({ error: 'the admission vote is closed' })
    }

    const eligible_teams = await db('admission_vote_eligible_teams')
      .where({ admission_vote_id: vote.admission_vote_id })
      .whereIn('team_id', membership.team_ids)
      .select('team_id')

    if (!eligible_teams.length) {
      return res
        .status(403)
        .send({ error: 'your team is not entitled to a ballot in this vote' })
    }

    // A user holding two eligible teams is not a case the amendment addresses,
    // and guessing which one he means would silently cast the wrong Team's
    // ballot. Refuse and say so.
    if (eligible_teams.length > 1) {
      return res.status(400).send({
        error: 'you hold more than one team entitled to a ballot in this vote'
      })
    }

    const team_id = eligible_teams[0].team_id

    const candidates = await db('admission_vote_candidates')
      .where({ admission_vote_id: vote.admission_vote_id })
      .select('admission_vote_candidate_id')

    const ranking_error = validate_ranking({
      ranked_candidate_ids: req.body.ranked_candidate_ids,
      vote,
      candidate_ids: new Set(
        candidates.map((candidate) => candidate.admission_vote_candidate_id)
      )
    })

    if (ranking_error) {
      return res.status(400).send({ error: ranking_error })
    }

    await write_admission_vote_ballot({
      admission_vote_id: vote.admission_vote_id,
      team_id,
      ranked_candidate_ids: req.body.ranked_candidate_ids,
      // Null: the Manager cast it himself. A Manager replacing a ballot the
      // Commissioner transcribed for him makes it his own act, which is what
      // clearing the reason records.
      commissioner_entered_reason: null,
      submitted_at: new Date()
    })

    // The response deliberately does not echo the ranking back.
    res.send({ admission_vote_id: vote.admission_vote_id, team_id })
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.message })
  }
})

/**
 * @swagger
 * /admission-votes/{admission_vote_id}/transcribed-ballot:
 *   post:
 *     summary: Record a ranking a Manager sent the Commissioner directly
 *     description: |
 *       Section 10 does not provide for a Manager who cannot reach the app, so
 *       the Commissioner transcribes a ranking sent to him. Three refusals make
 *       that safe: it is refused once `closes_at` has passed whether or not the
 *       vote has been closed, refused for a team that already has a ballot —
 *       replacement is the Manager's own act alone — and refused without a
 *       recorded reason.
 *     tags:
 *       - Admission votes
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: The transcribed ballot was recorded
 *       400:
 *         description: Malformed request, an invalid ranking, or no reason given
 *       401:
 *         description: Authentication required
 *       403:
 *         description: The caller is not the commissioner
 *       409:
 *         description: The window has passed, or the team already has a ballot
 */
router.post('/:admission_vote_id/transcribed-ballot', async (req, res) => {
  const { db, logger } = req.app.locals
  try {
    const league_id = get_league_id(req.body.league_id)
    if (!league_id) {
      return res.status(400).send({ error: 'missing league_id' })
    }

    const membership = await resolve_league_membership({
      db,
      league_id,
      user_id: req.auth.userId
    })

    if (!membership) {
      return res.status(400).send({ error: 'invalid league_id' })
    }

    if (!membership.is_commissioner) {
      return res
        .status(403)
        .send({ error: 'only the commissioner can transcribe a ballot' })
    }

    const commissioner_entered_reason =
      typeof req.body.commissioner_entered_reason === 'string'
        ? req.body.commissioner_entered_reason.trim()
        : ''

    // One column rather than a flag plus a reason, so a transcription cannot be
    // made without recording why it was made.
    if (!commissioner_entered_reason) {
      return res
        .status(400)
        .send({ error: 'a transcribed ballot requires a recorded reason' })
    }

    const team_id = Number(req.body.team_id)
    if (!Number.isInteger(team_id)) {
      return res.status(400).send({ error: 'missing team_id' })
    }

    const vote = await db('admission_votes')
      .where({
        admission_vote_id: Number(req.params.admission_vote_id),
        league_id
      })
      .first()

    if (!vote) {
      return res.status(400).send({ error: 'invalid admission_vote_id' })
    }

    // Keyed on `closes_at`, NOT on the Commissioner having pressed close. An
    // earlier draft let a manual close widen this window, which meant the one
    // person who can see every ballot could keep writing them after the ballot
    // period the Notice announced had ended.
    if (
      vote.vote_status !== admission_vote_statuses.OPEN ||
      Date.now() >= new Date(vote.closes_at).getTime()
    ) {
      return res.status(409).send({
        error: 'the ballot period has ended and no ballot may be transcribed'
      })
    }

    const eligible_team = await db('admission_vote_eligible_teams')
      .where({ admission_vote_id: vote.admission_vote_id, team_id })
      .first()

    if (!eligible_team) {
      return res
        .status(403)
        .send({ error: 'that team is not entitled to a ballot in this vote' })
    }

    const existing_ballot = await db('admission_vote_ballots')
      .where({ admission_vote_id: vote.admission_vote_id, team_id })
      .first()

    // The refusal that matters most. Without it the Commissioner could REPLACE
    // a Team's ballot after seeing how the vote was going.
    if (existing_ballot) {
      return res.status(409).send({
        error:
          'that team already has a ballot; replacing it is the manager’s own act'
      })
    }

    const candidates = await db('admission_vote_candidates')
      .where({ admission_vote_id: vote.admission_vote_id })
      .select('admission_vote_candidate_id')

    const ranking_error = validate_ranking({
      ranked_candidate_ids: req.body.ranked_candidate_ids,
      vote,
      candidate_ids: new Set(
        candidates.map((candidate) => candidate.admission_vote_candidate_id)
      )
    })

    if (ranking_error) {
      return res.status(400).send({ error: ranking_error })
    }

    await write_admission_vote_ballot({
      admission_vote_id: vote.admission_vote_id,
      team_id,
      ranked_candidate_ids: req.body.ranked_candidate_ids,
      commissioner_entered_reason,
      submitted_at: new Date()
    })

    res.send({ admission_vote_id: vote.admission_vote_id, team_id })
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.message })
  }
})

/**
 * @swagger
 * /admission-votes:
 *   post:
 *     summary: Open an admission vote
 *     description: |
 *       Section 10. The commissioner gives Notice of every Candidate and his
 *       Sponsors and of the number of Candidates a Team may rank, then holds
 *       the vote open. The eligibility snapshot is written here and frozen:
 *       row presence in users_teams cannot signal a seated manager, so the
 *       teams entitled to a ballot are stated rather than inferred.
 *     tags:
 *       - Admission votes
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: The vote was opened
 *       400:
 *         description: Malformed request
 *       401:
 *         description: Authentication required
 *       403:
 *         description: The caller is not the commissioner
 *       409:
 *         description: The league already has an open admission vote
 */
router.post('/', async (req, res) => {
  const { db, logger } = req.app.locals
  try {
    const league_id = get_league_id(req.body.league_id)
    if (!league_id) {
      return res.status(400).send({ error: 'missing league_id' })
    }

    const membership = await resolve_league_membership({
      db,
      league_id,
      user_id: req.auth.userId
    })

    if (!membership) {
      return res.status(400).send({ error: 'invalid league_id' })
    }

    if (!membership.is_commissioner) {
      return res
        .status(403)
        .send({ error: 'only the commissioner can open an admission vote' })
    }

    const maximum_ranked_candidates = Number(req.body.maximum_ranked_candidates)
    // Section 10: the stated number "shall be not less than one (1)". A stated
    // maximum of zero would score every Candidate at zero and hand the whole
    // ranking to the Commissioner under a parameter he alone sets.
    if (
      !Number.isInteger(maximum_ranked_candidates) ||
      maximum_ranked_candidates < 1
    ) {
      return res
        .status(400)
        .send({ error: 'maximum_ranked_candidates must be at least 1' })
    }

    const opened_at = new Date()
    const closes_at = new Date(req.body.closes_at)
    if (Number.isNaN(closes_at.getTime()) || closes_at <= opened_at) {
      return res.status(400).send({ error: 'closes_at must be in the future' })
    }

    const candidates = Array.isArray(req.body.candidates)
      ? req.body.candidates
      : []
    if (!candidates.length) {
      return res
        .status(400)
        .send({ error: 'an admission vote needs at least one candidate' })
    }

    const league_team_ids = new Set(
      (
        await db('teams')
          .where({ lid: league_id, season_year: current_season.year })
          .select('uid')
      ).map((team) => team.uid)
    )

    const eligible_teams = Array.isArray(req.body.eligible_teams)
      ? req.body.eligible_teams
      : []
    if (!eligible_teams.length) {
      return res
        .status(400)
        .send({ error: 'at least one team must be entitled to a ballot' })
    }

    for (const eligible_team of eligible_teams) {
      if (!league_team_ids.has(Number(eligible_team.team_id))) {
        return res
          .status(400)
          .send({ error: 'eligible team is not a team in this league' })
      }
    }

    // A Candidate always has a NAME. The submission is optional and always was:
    // the waiting list is the pool Candidates are drawn from rather than a
    // nomination channel, so a Candidate named on the Boards with no
    // application on file is the ordinary case, not a degraded one.
    const submission_ids = []

    for (const candidate of candidates) {
      if (
        typeof candidate.candidate_name !== 'string' ||
        !candidate.candidate_name.trim()
      ) {
        return res.status(400).send({ error: 'every candidate needs a name' })
      }
      for (const team_id of candidate.sponsor_team_ids || []) {
        if (!league_team_ids.has(Number(team_id))) {
          return res
            .status(400)
            .send({ error: 'sponsor is not a team in this league' })
        }
      }
      if (
        candidate.submission_id !== null &&
        candidate.submission_id !== undefined
      ) {
        const submission_id = Number(candidate.submission_id)
        if (!Number.isInteger(submission_id)) {
          return res.status(400).send({ error: 'invalid submission_id' })
        }
        submission_ids.push(submission_id)
      }
    }

    if (submission_ids.length) {
      // Checked here so a stale pick is a readable refusal. The foreign key
      // would otherwise reject it as a 500 naming a constraint, which tells the
      // Commissioner nothing about what to do next -- and the pick CAN go
      // stale, since the submissions are deleted when a recruiting round
      // closes and this page holds the list it loaded on mount.
      const found = await db('manager_waitlist_submissions')
        .whereIn('submission_id', submission_ids)
        .pluck('submission_id')

      if (found.length !== new Set(submission_ids).size) {
        return res.status(400).send({
          error: 'no waiting-list application with that submission_id'
        })
      }

      // One application is one person, so two Candidates cannot cite it. The
      // schema does not forbid this -- submission_id carries no unique index,
      // deliberately, since a person may stand in more than one Admission Vote
      // over time -- so the rule that holds WITHIN a vote is enforced here.
      if (new Set(submission_ids).size !== submission_ids.length) {
        return res.status(400).send({
          error: 'two candidates cannot share one waiting-list application'
        })
      }
    }

    // A partial unique index already bounds a league to one OPEN vote per
    // season, so this is the readable refusal rather than the enforcement.
    const open_vote = await db('admission_votes')
      .where({
        league_id,
        season_year: current_season.year,
        vote_status: admission_vote_statuses.OPEN
      })
      .first()

    if (open_vote) {
      return res
        .status(409)
        .send({ error: 'this league already has an open admission vote' })
    }

    let admission_vote_id

    // One transaction. A vote whose eligibility snapshot or candidate list only
    // half landed would be open and unvotable, and the ballot route's foreign
    // key to the snapshot would refuse every Team that fell in the gap.
    await db.transaction(async (trx) => {
      const [inserted] = await trx('admission_votes')
        .insert({
          league_id,
          season_year: current_season.year,
          opened_at,
          closes_at,
          maximum_ranked_candidates,
          vote_status: admission_vote_statuses.OPEN
        })
        .returning('admission_vote_id')

      admission_vote_id = inserted.admission_vote_id

      await trx('admission_vote_eligible_teams').insert(
        eligible_teams.map((eligible_team) => ({
          admission_vote_id,
          team_id: Number(eligible_team.team_id),
          recorded_at: opened_at,
          recorded_reason: eligible_team.recorded_reason || null
        }))
      )

      for (const candidate of candidates) {
        const [inserted_candidate] = await trx('admission_vote_candidates')
          .insert({
            admission_vote_id,
            candidate_name: candidate.candidate_name.trim(),
            submission_id:
              candidate.submission_id === null ||
              candidate.submission_id === undefined
                ? null
                : Number(candidate.submission_id)
          })
          .returning('admission_vote_candidate_id')

        const sponsor_team_ids = [
          ...new Set((candidate.sponsor_team_ids || []).map(Number))
        ]

        if (sponsor_team_ids.length) {
          await trx('admission_vote_candidate_sponsors').insert(
            sponsor_team_ids.map((team_id) => ({
              admission_vote_candidate_id:
                inserted_candidate.admission_vote_candidate_id,
              team_id
            }))
          )
        }
      }
    })

    res.send({ admission_vote_id })
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.message })
  }
})

/**
 * @swagger
 * /admission-votes/{admission_vote_id}/close:
 *   post:
 *     summary: Close the admission vote and pin its tally
 *     description: |
 *       Writes each Candidate's point total and starts the Section 11(a)
 *       seven-day decision clock. Closing early is permitted and widens
 *       nothing: the transcription refusal keys on `closes_at`, not on this.
 *     tags:
 *       - Admission votes
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: The vote was closed
 *       401:
 *         description: Authentication required
 *       403:
 *         description: The caller is not the commissioner
 *       409:
 *         description: The vote is already closed
 */
router.post('/:admission_vote_id/close', async (req, res) => {
  const { db, logger } = req.app.locals
  try {
    const league_id = get_league_id(req.body.league_id)
    if (!league_id) {
      return res.status(400).send({ error: 'missing league_id' })
    }

    const membership = await resolve_league_membership({
      db,
      league_id,
      user_id: req.auth.userId
    })

    if (!membership) {
      return res.status(400).send({ error: 'invalid league_id' })
    }

    if (!membership.is_commissioner) {
      return res
        .status(403)
        .send({ error: 'only the commissioner can close an admission vote' })
    }

    const vote = await db('admission_votes')
      .where({
        admission_vote_id: Number(req.params.admission_vote_id),
        league_id
      })
      .first()

    if (!vote) {
      return res.status(400).send({ error: 'invalid admission_vote_id' })
    }

    if (vote.vote_status !== admission_vote_statuses.OPEN) {
      return res
        .status(409)
        .send({ error: 'the admission vote is already closed' })
    }

    const { decision_due_at } = await close_admission_vote({
      admission_vote_id: vote.admission_vote_id
    })

    res.send({ admission_vote_id: vote.admission_vote_id, decision_due_at })
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.message })
  }
})

/**
 * @swagger
 * /admission-votes/{admission_vote_id}/decision:
 *   post:
 *     summary: Admit the highest ranked candidate, or pass
 *     description: |
 *       Section 11(a) grants the commissioner two elections and no third. There
 *       is deliberately no admit-someone-else action, with or without a
 *       recorded reason: a candidate below the top of the ranking is refused.
 *       Where candidates are tied on points, Section 11(c) puts the ranking
 *       within the tie in the commissioner's exclusive discretion, so any of
 *       the tied top-scorers may be admitted and the admitted candidate is
 *       still the highest ranked. A pass requires a reason, per Section 11(b).
 *       The action is refused once `decision_due_at` has passed, at which point
 *       he is deemed to have passed.
 *     tags:
 *       - Admission votes
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: The decision was recorded
 *       400:
 *         description: Malformed request, or an admission of a candidate who is not highest ranked
 *       401:
 *         description: Authentication required
 *       403:
 *         description: The caller is not the commissioner
 *       409:
 *         description: The vote is still open, already decided, or past its deadline
 */
router.post('/:admission_vote_id/decision', async (req, res) => {
  const { db, logger } = req.app.locals
  try {
    const league_id = get_league_id(req.body.league_id)
    if (!league_id) {
      return res.status(400).send({ error: 'missing league_id' })
    }

    const membership = await resolve_league_membership({
      db,
      league_id,
      user_id: req.auth.userId
    })

    if (!membership) {
      return res.status(400).send({ error: 'invalid league_id' })
    }

    if (!membership.is_commissioner) {
      return res
        .status(403)
        .send({ error: 'only the commissioner can decide an admission vote' })
    }

    const vote = await db('admission_votes')
      .where({
        admission_vote_id: Number(req.params.admission_vote_id),
        league_id
      })
      .first()

    if (!vote) {
      return res.status(400).send({ error: 'invalid admission_vote_id' })
    }

    if (vote.vote_status !== admission_vote_statuses.CLOSED) {
      return res
        .status(409)
        .send({ error: 'the admission vote has not closed yet' })
    }

    if (vote.decision_outcome) {
      return res
        .status(409)
        .send({ error: 'this admission vote has already been decided' })
    }

    // Section 11(a): "He shall admit or pass within seven (7) days of the close
    // of the Admission Vote, and where he does neither he is deemed to have
    // passed." Once that has happened the deemed pass has taken effect, so
    // there is no decision left to make and writing one would overwrite it.
    if (Date.now() > new Date(vote.decision_due_at).getTime()) {
      return res.status(409).send({
        error:
          'the seven-day period has passed and the commissioner is deemed to have passed'
      })
    }

    const { decision_outcome } = req.body
    if (
      decision_outcome !== admission_vote_outcomes.ADMITTED &&
      decision_outcome !== admission_vote_outcomes.PASSED
    ) {
      return res
        .status(400)
        .send({ error: 'decision_outcome must be admitted or passed' })
    }

    const decision_reason =
      typeof req.body.decision_reason === 'string'
        ? req.body.decision_reason.trim()
        : ''

    if (decision_outcome === admission_vote_outcomes.PASSED) {
      // Section 11(b): he "shall give Notice of the pass and of his reason
      // for it".
      if (!decision_reason) {
        return res.status(400).send({ error: 'a pass requires a reason' })
      }

      await db('admission_votes')
        .where({ admission_vote_id: vote.admission_vote_id })
        .update({
          decision_outcome: admission_vote_outcomes.PASSED,
          decided_at: new Date(),
          decision_reason
        })

      return res.send({
        admission_vote_id: vote.admission_vote_id,
        decision_outcome
      })
    }

    const admission_vote_candidate_id = Number(
      req.body.admission_vote_candidate_id
    )
    if (!Number.isInteger(admission_vote_candidate_id)) {
      return res
        .status(400)
        .send({ error: 'missing admission_vote_candidate_id' })
    }

    // The ranking is computed here rather than stored, so there is no field a
    // commissioner could reorder before "accepting the vote". An earlier draft
    // carried a freely editable rank that the decision was staged from, which
    // is exactly that bypass.
    const totals = await get_admission_vote_totals({
      admission_vote_id: vote.admission_vote_id
    })

    const highest_points = totals.length ? totals[0].points_total : null
    const candidate = totals.find(
      (row) => row.admission_vote_candidate_id === admission_vote_candidate_id
    )

    if (!candidate) {
      return res
        .status(400)
        .send({ error: 'candidate is not standing in this admission vote' })
    }

    // Section 11(a) grants admission of "the highest ranked Candidate" and
    // nothing else. Equality rather than identity is what makes the Section
    // 11(c) tie work: among candidates tied at the top the commissioner ranks
    // them himself, so any of them IS the highest ranked once he has.
    if (candidate.points_total !== highest_points) {
      return res.status(400).send({
        error:
          'only the highest ranked candidate may be admitted; the other election is to pass'
      })
    }

    await db('admission_votes')
      .where({ admission_vote_id: vote.admission_vote_id })
      .update({
        decision_outcome: admission_vote_outcomes.ADMITTED,
        decided_at: new Date(),
        decided_admission_vote_candidate_id: admission_vote_candidate_id,
        decision_reason: decision_reason || null
      })

    res.send({
      admission_vote_id: vote.admission_vote_id,
      decision_outcome,
      admission_vote_candidate_id
    })
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.message })
  }
})

export default router
