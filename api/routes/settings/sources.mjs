import express from 'express'
const router = express.Router()

/**
 * @swagger
 * /settings/sources/{sourceId}:
 *   put:
 *     tags:
 *       - Settings
 *     summary: Update user-specific projection source weighting
 *     description: |
 *       Update the weight assigned to a specific projection source for the authenticated user.
 *       This allows users to customize how different projection sources are weighted when
 *       creating composite projections for their fantasy football analysis.
 *
 *       **Weight Values:**
 *       - `1.0` - Default weight (removes custom weighting, uses system default)
 *       - `0.0` - Completely exclude this source from projections
 *       - `> 1.0` - Give this source more influence in composite projections
 *       - `< 1.0` (but > 0) - Give this source less influence in composite projections
 *
 *       **Behavior:**
 *       - If weight is exactly `1`, any existing custom weighting is removed from the database
 *       - If weight is not `1`, the custom weighting is created or updated in the users_sources table
 *       - Only affects projections for the authenticated user
 *       - Changes take effect immediately for subsequent projection calculations
 *
 *       **Database Operations:**
 *       - Weight = 1: DELETE from users_sources table (use system default)
 *       - Weight ≠ 1: INSERT or UPDATE users_sources table with custom weight
 *
 *       **Use Cases:**
 *       - Increase weight for more trusted sources (e.g., 1.5 for PFF if you trust their analysis)
 *       - Decrease weight for less trusted sources (e.g., 0.5 for volatile sources)
 *       - Exclude sources entirely (e.g., 0.0 for sources you don't want to use)
 *       - Reset to system defaults (e.g., 1.0 to remove all customization)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: sourceId
 *         in: path
 *         required: true
 *         description: |
 *           The unique identifier of the projection source to update.
 *           Must be a valid source ID from the sources table.
 *         schema:
 *           type: integer
 *           enum: [1, 2, 3, 4, 5, 6, 9, 10, 11, 13, 16, 18, 19, 28]
 *         example: 16
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SourceWeightUpdateRequest'
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
 *               $ref: '#/components/schemas/SourceWeightUpdateResponse'
 *             examples:
 *               weight_updated:
 *                 summary: Weight updated
 *                 value:
 *                   weight: 1.5
 *               weight_reset:
 *                 summary: Weight reset to default
 *                 value:
 *                   weight: 1.0
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
 *                   error: "missing weight"
 *               missing_sourceid:
 *                 summary: Missing source ID parameter
 *                 value:
 *                   error: "missing sourceId"
 *               invalid_weight:
 *                 summary: Invalid weight parameter
 *                 value:
 *                   error: "invalid weight"
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.put('/:sourceId', async (req, res) => {
  const { db, logger } = req.app.locals
  try {
    const { sourceId } = req.params
    let { weight } = req.body

    const { userId } = req.auth

    if (!sourceId) {
      return res.status(400).send({ error: 'missing sourceId' })
    }

    if (!weight) {
      return res.status(400).send({ error: 'missing weight' })
    }

    if (isNaN(weight)) {
      return res.status(400).send({ error: 'invalid weight' })
    }

    weight = parseFloat(weight)

    if (weight === 1) {
      await db('users_sources')
        .del()
        .where({ userid: userId, sourceid: sourceId })
    } else {
      const rows = await db('users_sources').where({
        userid: userId,
        sourceid: sourceId
      })
      if (!rows.length) {
        await db('users_sources').insert({
          userid: userId,
          sourceid: sourceId,
          weight
        })
      } else {
        await db('users_sources')
          .update({
            weight
          })
          .where({ userid: userId, sourceid: sourceId })
      }
    }

    res.send({ weight })
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

export default router
