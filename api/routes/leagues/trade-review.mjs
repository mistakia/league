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
 *         trade_uid:
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
 *         net_value_realized:
 *           type: integer
 *           description: The same comparison priced today.
 *         net_value_change:
 *           type: integer
 *           nullable: true
 *         unpriced_leg_count:
 *           type: integer
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
 *           description: Position across the whole draft, not within its round
 *         market_value_at_trade:
 *           type: number
 *           nullable: true
 *         current_market_value:
 *           type: number
 *         lineage_state:
 *           type: string
 *           enum: [not_computed, no_longer_held, held]
 *           description: >-
 *             not_computed means the lineage graph has no row for this asset,
 *             which is distinct from no_longer_held. Both otherwise present as
 *             an empty result and a zero value.
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
 *       A chain of one row is an asset that never moved again — distinct from
 *       an asset with no chain at all, which reports
 *       `lineage_state: not_computed`.
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

    const trade_uid = Number(req.params.tradeId)
    if (!Number.isInteger(trade_uid)) {
      return res.status(400).send({ error: 'invalid tradeId' })
    }

    const results = await grade_trades({
      lid: Number(req.params.leagueId),
      trade_uid
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
