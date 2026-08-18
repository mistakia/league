import express from 'express'

import grade_trades from '#libs-server/trade-review/grade-trades.mjs'
import {
  require_auth,
  validate_and_get_league,
  require_league_access,
  handle_error
} from './middleware.mjs'

const router = express.Router({ mergeParams: true })

// Retrospective review of accepted trades, all seasons, both perspectives.
//
// Separate from /leagues/:lid/trades, which serves the proposal page and is
// scoped to the current season. This namespace shares no fields with it.
//
// Grades are computed live per request rather than cached. The engine runs a
// handful of batched queries over 735 legs and a walk of ~2500 rows, and a
// correct cache key would have to span both the lineage refresh clock and the
// keeptradecut_valuations clock, which move independently.

const authorize = async (req, res) => {
  if (!require_auth(req, res)) return null
  const league = await validate_and_get_league(req.params.leagueId, res)
  if (!league) return null
  const { db } = req.app.locals
  const has_access = await require_league_access(
    league,
    req.auth.userId,
    req.params.leagueId,
    db,
    res
  )
  return has_access ? league : null
}

// The list omits per-asset lineage chains, which the detail route carries. A
// row needs the three net figures and the assets by name; the chains are an
// order of magnitude more data and nothing on the list renders them.
const without_chains = (trade) => ({
  ...trade,
  acquired_assets: trade.acquired_assets.map(({ chain, ...asset }) => asset),
  sent_assets: trade.sent_assets.map(({ chain, ...asset }) => asset)
})

/**
 * @swagger
 * /leagues/{leagueId}/trade-review:
 *   get:
 *     tags:
 *       - Leagues
 *     summary: Review every accepted trade in league history
 *     description: |
 *       Returns one record per team per accepted trade, across all seasons. The
 *       two records for a trade are sign-inverted mirrors of each other.
 *
 *       Three value figures per asset and per record, each a property of
 *       something different: `at_trade` belongs to the leg, `still_held` to the
 *       team and the asset, `proceeds` to the team and the trade. Asset lineage
 *       and team accounting are different traversals over one graph.
 *
 *       `net_value_at_trade` is `null` — never `0` — when any leg of the trade
 *       has no market value at the trade date. KeepTradeCut deletes a draft
 *       class once its draft has passed, so pick prices before 2023-09 are
 *       permanently unrecoverable, and a zero there would read as an even
 *       trade. Clients must render the absence explicitly.
 *
 *       Access is league commissioner or team owner in any season.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: leagueId
 *         required: true
 *         schema:
 *           type: integer
 *         description: League ID
 *       - in: query
 *         name: year
 *         schema:
 *           type: integer
 *         description: Limit to trades accepted in this calendar year
 *     responses:
 *       200:
 *         description: Trade review records
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/TradeReviewRecord'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         description: Not a commissioner or member of this league
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 *
 * components:
 *   schemas:
 *     TradeReviewRecord:
 *       type: object
 *       properties:
 *         trade_id:
 *           type: integer
 *         tid:
 *           type: integer
 *           description: The team this record is written from the view of
 *         counterparty_tid:
 *           type: integer
 *         occurred_at:
 *           type: string
 *           format: date-time
 *         net_value_at_trade:
 *           type: integer
 *           nullable: true
 *           description: >-
 *             Value received minus value given, priced at the trade date. Null
 *             when any leg was unpriced; never 0 for that reason.
 *         net_value_still_held:
 *           type: integer
 *           description: >-
 *             What this team still holds off what it received, minus what the
 *             counterparty still holds off what this team gave up, priced
 *             today. An asset either side traded onward counts nothing here.
 *         net_value_proceeds:
 *           type: integer
 *           nullable: true
 *           description: >-
 *             What each side's assets turned into FOR THAT TEAM, netted and
 *             priced today, following the consideration through every onward
 *             trade. MUST NOT be summed or averaged across a team's trades:
 *             the figure is transitively attributed, so the same value
 *             legitimately appears on every card along a conversion chain and
 *             adding them multiplies it. Null when the figure is withheld,
 *             which happens when an outgoing bundle is unpriced or short of the
 *             trade source tables and the attribution weight is therefore a
 *             division by an unknown. Never 0 for that reason.
 *         net_value_proceeds_change:
 *           type: integer
 *           nullable: true
 *           description: Proceeds minus at-trade. Null when either is null.
 *         unpriced_leg_count:
 *           type: integer
 *         realized_points_added_while_held:
 *           type: number
 *           description: >-
 *             Points added over replacement this team accrued on what it
 *             received and on everything those assets became, counted only for
 *             the stretches this team held them. A chain follows an asset past
 *             this team, so rows belonging to a later holder are excluded.
 *         salary_paid_while_held:
 *           type: integer
 *           description: Salary this team paid over those same holdings.
 *         acquired_assets:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/TradeReviewAsset'
 *         sent_assets:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/TradeReviewAsset'
 *     TradeReviewAsset:
 *       type: object
 *       properties:
 *         origin_holding_id:
 *           type: integer
 *         asset_type:
 *           type: integer
 *           description: 1 player, 2 pick
 *         player_id:
 *           type: string
 *           nullable: true
 *         pick_year:
 *           type: integer
 *           nullable: true
 *         pick_round:
 *           type: integer
 *           nullable: true
 *         pick_draft_overall_position:
 *           type: integer
 *           nullable: true
 *           description: >-
 *             Position across the whole draft, not within its round. Always
 *             null on the traded asset itself: view_trade_asset_flow does not
 *             select this column, so only the entries in resulting_assets,
 *             which are read from the holding rows, carry it.
 *         keeptradecut_value_at_trade:
 *           type: number
 *           nullable: true
 *           description: What this leg was worth on the day. A property of the leg.
 *         keeptradecut_value_still_held:
 *           type: number
 *           description: >-
 *             Today's value of what the RECEIVING team still holds off this
 *             asset. A property of the team and the asset, not of the asset
 *             line: holdings that have moved to another team count nothing.
 *         keeptradecut_value_proceeds:
 *           type: number
 *           nullable: true
 *           description: >-
 *             What this team's side of the trade turned into for it: what it
 *             still holds, plus the weighted value of what it received when it
 *             traded this asset onward, weighted by this asset's share of the
 *             at-trade value of the whole outgoing bundle. Stops at the team's
 *             first disposal. Null when withheld — see net_value_proceeds — and
 *             never 0 for that reason. Must not be summed across a team's
 *             trades.
 *         team_asset_state:
 *           type: string
 *           enum: [still_held, traded_onward, consumed]
 *           description: >-
 *             What the RECEIVING TEAM did with this asset, derived from the
 *             transformation type of that team's own termination edge.
 *             traded_onward and consumed both present as a zero still-held
 *             value and mean opposite things — the first converted the asset
 *             into the proceeds figure, the second got nothing back — so a
 *             client must render them distinctly and must not render either as
 *             a bare zero. traded_onward wins over still_held where a team
 *             disposed of a line and later reacquired it, because the proceeds
 *             figure stops at that disposal.
 *         hop_count:
 *           type: integer
 *           description: 0 when the asset never moved again after the trade
 *         resulting_assets:
 *           type: array
 *           description: Every still-open holding descended from this asset
 *           items:
 *             type: object
 */
router.get('/?', async (req, res) => {
  const { logger } = req.app.locals
  try {
    const league = await authorize(req, res)
    if (!league) return

    const { year } = req.query
    const results = await grade_trades({
      lid: Number(req.params.leagueId),
      year: year ? Number(year) : null
    })

    res.send(results.map(without_chains))
  } catch (err) {
    handle_error(err, logger, res)
  }
})

/**
 * @swagger
 * /leagues/{leagueId}/trade-review/{tradeId}:
 *   get:
 *     tags:
 *       - Leagues
 *     summary: Review one trade with the full forward lineage of every asset
 *     description: |
 *       As the list route, plus a `chain` on every asset: each holding the
 *       asset reached, ordered by depth, carrying the transformation that
 *       created it and that holding's production, usage, cost and termination.
 *
 *       A chain of one row is an asset that never moved again. Every leg has a
 *       chain of at least that one row: the walk emits a depth-zero row for
 *       every holding, and a leg only exists when its target holding does.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: leagueId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: path
 *         name: tradeId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Both perspectives on one trade, with lineage chains
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         description: Not a commissioner or member of this league
 *       404:
 *         description: No accepted trade with this id in this league
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/:tradeId', async (req, res) => {
  const { logger } = req.app.locals
  try {
    const league = await authorize(req, res)
    if (!league) return

    const trade_id = Number(req.params.tradeId)
    if (!Number.isInteger(trade_id)) {
      return res.status(400).send({ error: 'invalid tradeId' })
    }

    const results = await grade_trades({
      lid: Number(req.params.leagueId),
      trade_id
    })
    if (!results.length) {
      return res.status(404).send({ error: 'trade not found' })
    }

    res.send(results)
  } catch (err) {
    handle_error(err, logger, res)
  }
})

export default router
