import express from 'express'

const router = express.Router()

/**
 * @swagger
 * /percentiles/{percentile_key}:
 *   get:
 *     summary: Get percentile data by key
 *     description: |
 *       Retrieves percentile data for a specific percentile key. Percentiles provide
 *       statistical information about player performance relative to their peers.
 *
 *       **Usage**: Commonly used for comparing player performance across different
 *       statistical categories and time periods.
 *
 *       **Data Source**: Calculated from historical player performance data.
 *     tags:
 *       - Stats
 *     parameters:
 *       - name: percentile_key
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: Unique identifier for the percentile data set
 *         example: 'passing_yards_2024_reg'
 *     responses:
 *       '200':
 *         description: Successfully retrieved percentile data
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   percentile_key:
 *                     type: string
 *                     description: Identifier for the percentile data set
 *                     example: 'passing_yards_2024_reg'
 *                   value:
 *                     type: number
 *                     description: Statistical value at this percentile
 *                     example: 285.5
 *                   percentile:
 *                     type: number
 *                     description: Percentile rank (0-100)
 *                     example: 75
 *                   count:
 *                     type: integer
 *                     description: Number of data points at or below this percentile
 *                     example: 150
 *             examples:
 *               passing_yards_percentiles:
 *                 summary: Passing yards percentile data
 *                 value:
 *                   - percentile_key: 'passing_yards_2024_reg'
 *                     value: 250.0
 *                     percentile: 50
 *                     count: 100
 *                   - percentile_key: 'passing_yards_2024_reg'
 *                     value: 285.5
 *                     percentile: 75
 *                     count: 150
 *                   - percentile_key: 'passing_yards_2024_reg'
 *                     value: 325.0
 *                     percentile: 90
 *                     count: 180
 *       '400':
 *         $ref: '#/components/responses/BadRequestError'
 *       '404':
 *         description: Percentile key not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               error: 'Percentile data not found for key: invalid_key'
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/:percentile_key', async (req, res) => {
  const { db, logger } = req.app.locals
  try {
    const { percentile_key } = req.params
    const percentiles = await db('percentiles').where({ percentile_key })
    res.send(percentiles)
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

export default router
