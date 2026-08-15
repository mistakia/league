import express from 'express'

import { current_season } from '#constants'
import get_admission_vote_totals from '#libs-server/get-admission-vote-totals.mjs'
import write_admission_vote_ballot from '#libs-server/write-admission-vote-ballot.mjs'
import { admission_vote_statuses } from '#libs-shared/constants/admission-vote-constants.mjs'

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
// Nothing here returns a per-Team ranking to anyone, the Commissioner included:
// the only read onto the tally is get_admission_vote_totals, which selects from
// admission_vote_candidates alone, and the viewer block reports only whether
// the CALLER'S OWN Team has a ballot -- never which Teams have voted and never
// what any Team ranked. Reaching an individual ballot takes a deliberate query
// against the database.
//
// A Manager replacing his own ballot re-ranks from scratch rather than editing
// a rendered copy of his prior one. That follows from the same rule stated
// absolutely -- no surface renders an individual ballot for any caller -- and
// costs him a re-entry rather than costing anyone confidentiality.

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
 *       Candidate and his Sponsors), the caller's own ballot state, and — once
 *       the vote has closed — the per-Candidate point totals Section 10(e)
 *       discloses. Never returns a per-Team ranking to any caller.
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

    const vote = await get_latest_vote({ db, league_id })

    if (!vote) {
      return res.send({ vote: null, candidates: [], totals: [] })
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
        // Whether, not what. The ranking itself is never rendered back.
        has_submitted_ballot: Boolean(viewer_ballot),
        submitted_at: viewer_ballot ? viewer_ballot.submitted_at : null,
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

export default router
