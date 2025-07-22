import express from 'express'
const router = express.Router()

/**
 * @swagger
 * /sources:
 *   get:
 *     tags:
 *       - Projections
 *     summary: Get projection data sources
 *     description: |
 *       Retrieve list of available data sources for player projections and statistics.
 *       These sources are used for fantasy football projections and can be weighted
 *       differently by individual users to create personalized composite projections.
 *
 *       Common sources include:
 *       - Fantasy Sharks (uid: 1)
 *       - CBS Sports (uid: 2)
 *       - ESPN (uid: 3)
 *       - NFL.com (uid: 4)
 *       - Pro Football Focus (uid: 6)
 *       - 4for4 (uid: 16)
 *       - Average (uid: 18)
 *       - Sleeper (uid: 28)
 *     responses:
 *       200:
 *         description: List of available projection data sources
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/ProjectionSource'
 *             example:
 *               - uid: 16
 *                 name: "4for4"
 *                 url: "https://www.4for4.com/"
 *               - uid: 18
 *                 name: "Average"
 *                 url: null
 *               - uid: 28
 *                 name: "Sleeper"
 *                 url: "https://sleeper.app/"
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/?', async (req, res) => {
  const { db, logger } = req.app.locals
  try {
    const sources = await db('sources')
    res.send(sources)
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

/**
 * @swagger
 * /sources/{sourceid}:
 *   put:
 *     tags:
 *       - Projections
 *     summary: Update user source weighting
 *     description: |
 *       Update the weight assigned to a specific projection source for the authenticated user.
 *       This allows users to customize how different projection sources are weighted when
 *       creating composite projections.
 *
 *       **Weight Values:**
 *       - `1.0` - Default weight (removes custom weighting, uses system default)
 *       - `0.0` - Completely exclude this source from projections
 *       - `> 1.0` - Give this source more influence in composite projections
 *       - `< 1.0` (but > 0) - Give this source less influence in composite projections
 *
 *       **Behavior:**
 *       - If weight is exactly `1`, any existing custom weighting is removed
 *       - If weight is not `1`, the custom weighting is created or updated
 *       - Only affects projections for the authenticated user
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: sourceid
 *         in: path
 *         required: true
 *         description: The unique identifier of the projection source to update
 *         schema:
 *           type: integer
 *           enum: [1, 2, 3, 4, 5, 6, 9, 10, 11, 13, 16, 18, 19, 28]
 *         example: 16
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               weight:
 *                 type: number
 *                 format: float
 *                 minimum: 0
 *                 description: Weight to assign to this source (1.0 = default, 0.0 = exclude)
 *                 example: 1.5
 *             required:
 *               - weight
 *           examples:
 *             increase_weight:
 *               summary: Increase source weight
 *               description: Give this source 50% more influence in composite projections
 *               value:
 *                 weight: 1.5
 *             decrease_weight:
 *               summary: Decrease source weight
 *               description: Give this source 50% less influence in composite projections
 *               value:
 *                 weight: 0.5
 *             exclude_source:
 *               summary: Exclude source
 *               description: Completely exclude this source from projections
 *               value:
 *                 weight: 0.0
 *             reset_to_default:
 *               summary: Reset to default weight
 *               description: Remove custom weighting and use system default
 *               value:
 *                 weight: 1.0
 *     responses:
 *       200:
 *         description: Source weight updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 weight:
 *                   type: number
 *                   format: float
 *                   description: The weight that was applied to the source
 *                   example: 1.5
 *                 sourceid:
 *                   type: string
 *                   description: The source ID that was updated
 *                   example: "16"
 *               required:
 *                 - weight
 *                 - sourceid
 *             examples:
 *               weight_updated:
 *                 summary: Weight updated
 *                 value:
 *                   weight: 1.5
 *                   sourceid: "16"
 *               weight_reset:
 *                 summary: Weight reset to default
 *                 value:
 *                   weight: 1
 *                   sourceid: "16"
 *       400:
 *         description: Bad request - missing or invalid parameters
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             examples:
 *               missing_weight:
 *                 summary: Missing weight parameter
 *                 value:
 *                   error: "missing weight param"
 *               missing_sourceid:
 *                 summary: Missing source ID parameter
 *                 value:
 *                   error: "missing sourceid param"
 *       401:
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               error: "invalid userId"
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.put('/:sourceid', async (req, res) => {
  const { db, logger } = req.app.locals
  try {
    const weight = parseFloat(req.body.weight)
    const { sourceid } = req.params

    if (!req.auth || !req.auth.userId) {
      return res.status(401).send({ error: 'invalid userId' })
    }

    if (typeof weight === 'undefined') {
      return res.status(400).send({ error: 'missing weight param' })
    }

    if (!sourceid) {
      return res.status(400).send({ error: 'missing sourceid param' })
    }

    if (weight === 1) {
      await db('users_sources')
        .del()
        .where({ userid: req.auth.userId, sourceid })
    } else {
      const rows = await db('users_sources').where({
        userid: req.auth.userId,
        sourceid
      })
      if (rows.length) {
        await db('users_sources')
          .update({ weight })
          .where({ userid: req.auth.userId, sourceid })
      } else {
        await db('users_sources').insert({
          userid: req.auth.userId,
          sourceid,
          weight
        })
      }
    }

    res.send({ weight, sourceid })
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

export default router
