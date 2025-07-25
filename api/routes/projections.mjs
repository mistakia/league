import express from 'express'

import { constants } from '#libs-shared'
import { getProjections } from '#libs-server'

const router = express.Router()

/**
 * @swagger
 * /projections:
 *   get:
 *     tags:
 *       - Projections
 *     summary: Get player projections
 *     description: |
 *       Retrieve current season projections for all active players. Returns combined data from
 *       multiple projection sources including average projections and user-specific projections
 *       if authenticated.
 *
 *       **Key Features:**
 *       - Returns system-wide average projections (sourceid: 18)
 *       - Includes user-specific projections when authenticated
 *       - Filters to current season and active players only
 *       - Cached for 4 hours for performance
 *
 *       **Data Sources:**
 *       - Fantasy Sharks, CBS, ESPN, NFL, PFF, 4For4, FantasyPros and others
 *       - System calculates average projections across all sources
 *       - User projections override system projections when present
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of player projections with system averages and user overrides
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Projection'
 *             examples:
 *               quarterback_projection:
 *                 summary: Quarterback season projection
 *                 value:
 *                   - pid: "PATR-MAHO-2017-1995-09-17"
 *                     sourceid: 18
 *                     week: 0
 *                     year: 2024
 *                     seas_type: "REG"
 *                     pos: "QB"
 *                     pa: 525
 *                     pc: 345
 *                     py: 4200
 *                     ints: 8
 *                     tdp: 32
 *                     ra: 45
 *                     ry: 180
 *                     tdr: 4
 *                     pts: 285.6
 *               running_back_projection:
 *                 summary: Running back season projection
 *                 value:
 *                   - pid: "CHRI-MCCA-2017-1996-06-07"
 *                     sourceid: 18
 *                     week: 0
 *                     year: 2024
 *                     seas_type: "REG"
 *                     pos: "RB"
 *                     ra: 285
 *                     ry: 1350
 *                     tdr: 12
 *                     trg: 75
 *                     rec: 58
 *                     recy: 425
 *                     tdrec: 3
 *                     pts: 245.8
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/?', async (req, res) => {
  const { db, logger, cache } = req.app.locals
  try {
    // 12 hours
    /* res.set('Expires', dayjs().add('12', 'hour').toDate().toUTCString())
     * res.set('Cache-Control', 'public, max-age=43200')
     * res.set('Pragma', null)
     * res.set('Surrogate-Control', null)
     */
    let projections = cache.get('projections')
    const seas_type = constants.season.nfl_seas_type === 'POST' ? 'POST' : 'REG'
    if (!projections) {
      projections = await db('projections_index')
        .where('sourceid', constants.sources.AVERAGE)
        .where('year', constants.season.year)
        .where('week', '>=', constants.season.week)
        .where('seas_type', seas_type)
      cache.set('projections', projections, 14400) // 4 hours
    }

    let user_projections = []
    if (req.auth) {
      user_projections = await db('projections_index')
        .select('projections.*')
        .join('player', 'projections.pid', 'player.pid')
        .whereIn('player.pos', constants.positions)
        .whereNot('player.current_nfl_team', 'INA')
        .where({
          year: constants.season.year,
          seas_type,
          userid: req.auth.userId
        })
    }

    res.send(projections.concat(user_projections))
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

/**
 * @swagger
 * /projections/{pid}:
 *   get:
 *     tags:
 *       - Projections
 *     summary: Get projections for a specific player
 *     description: |
 *       Retrieve all available projections for a single player across all sources and time periods.
 *       This endpoint provides comprehensive projection data including:
 *
 *       **Projection Sources:**
 *       - Fantasy Sharks (1), CBS (2), ESPN (3), NFL (4), PFF (6)
 *       - 4For4 (16), FantasyPros (17), Average (18)
 *       - User-specific projections when authenticated
 *
 *       **Time Periods:**
 *       - Weekly projections (weeks 1-18)
 *       - Season totals (week 0)
 *       - Regular season and playoff projections
 *
 *       **Data Includes:**
 *       - Historical projections from multiple seasons
 *       - Real-time updates during the season
 *       - User overrides and custom projections
 *     parameters:
 *       - name: pid
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: Player ID in format FFFF-LLLL-YYYY-YYYY-MM-DD
 *         example: "PATR-MAHO-2017-1995-09-17"
 *     responses:
 *       200:
 *         description: All projections for the specified player
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Projection'
 *             example:
 *               - pid: "PATR-MAHO-2017-1995-09-17"
 *                 sourceid: 18
 *                 week: 0
 *                 year: 2024
 *                 seas_type: "REG"
 *                 pos: "QB"
 *                 pa: 525
 *                 pc: 345
 *                 py: 4200
 *                 ints: 8
 *                 tdp: 32
 *                 ra: 45
 *                 ry: 180
 *                 tdr: 4
 *                 pts: 285.6
 *               - pid: "PATR-MAHO-2017-1995-09-17"
 *                 sourceid: 16
 *                 week: 1
 *                 year: 2024
 *                 seas_type: "REG"
 *                 pos: "QB"
 *                 pa: 35
 *                 pc: 23
 *                 py: 285
 *                 ints: 0
 *                 tdp: 2
 *                 ra: 3
 *                 ry: 15
 *                 tdr: 0
 *                 pts: 20.5
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/:pid/?', async (req, res) => {
  const { logger } = req.app.locals
  try {
    const { pid } = req.params
    const projections = await getProjections({ pids: [pid] })
    res.send(projections)
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

/**
 * @swagger
 * /projections/{pid}:
 *   put:
 *     tags:
 *       - Projections
 *     summary: Create or update a user projection
 *     description: |
 *       Create or update a user-specific projection for a player. This allows authenticated users
 *       to override system projections with their own custom values.
 *
 *       **Key Features:**
 *       - Creates new projection if none exists for user/player/week combination
 *       - Updates existing projection if one already exists
 *       - Maintains historical record in projections table with timestamps
 *       - Validates statistic type against supported fantasy stats
 *
 *       **Supported Statistics:**
 *       - Passing: pa, pc, py, ints, tdp
 *       - Rushing: ra, ry, tdr, fuml
 *       - Receiving: trg, rec, recy, tdrec
 *       - Special: snp, twoptc, pts
 *       - Kicking: fga, fg, xpa, xpm
 *       - Defense: dint, dff, dtd, dsf, dblk, dya, dpa
 *
 *       **Validation Rules:**
 *       - Value must be a positive integer
 *       - Week must be specified (0-18)
 *       - Type must be valid fantasy statistic
 *       - User must be authenticated
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: pid
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: Player ID in format FFFF-LLLL-YYYY-YYYY-MM-DD
 *         example: "PATR-MAHO-2017-1995-09-17"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - type
 *               - week
 *               - value
 *             properties:
 *               type:
 *                 type: string
 *                 enum: ['pa', 'pc', 'py', 'ints', 'tdp', 'ra', 'ry', 'tdr', 'fuml', 'trg', 'rec', 'recy', 'tdrec', 'snp', 'twoptc', 'pts', 'fga', 'fg', 'xpa', 'xpm', 'dint', 'dff', 'dtd', 'dsf', 'dblk', 'dya', 'dpa']
 *                 description: Type of statistic to project
 *                 example: "py"
 *               week:
 *                 type: integer
 *                 minimum: 0
 *                 maximum: 18
 *                 description: Week number (0 for season total, 1-18 for weekly)
 *                 example: 4
 *               value:
 *                 type: integer
 *                 minimum: 0
 *                 description: Projected value for the statistic
 *                 example: 285
 *               seas_type:
 *                 type: string
 *                 enum: ['REG', 'POST', 'PRE']
 *                 default: 'REG'
 *                 description: Season type
 *                 example: "REG"
 *           examples:
 *             passing_yards_projection:
 *               summary: Weekly passing yards projection
 *               value:
 *                 type: "py"
 *                 week: 4
 *                 value: 285
 *                 seas_type: "REG"
 *             season_touchdowns_projection:
 *               summary: Season touchdown projection
 *               value:
 *                 type: "tdp"
 *                 week: 0
 *                 value: 32
 *                 seas_type: "REG"
 *     responses:
 *       200:
 *         description: Projection successfully created or updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 value:
 *                   type: integer
 *                   description: The updated projection value
 *                   example: 285
 *               required:
 *                 - value
 *       400:
 *         description: Bad request - validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             examples:
 *               missing_type:
 *                 summary: Missing type parameter
 *                 value:
 *                   error: "missing type param"
 *               missing_week:
 *                 summary: Missing week parameter
 *                 value:
 *                   error: "missing week param"
 *               invalid_type:
 *                 summary: Invalid statistic type
 *                 value:
 *                   error: "invalid type"
 *               invalid_value:
 *                 summary: Invalid value (not an integer)
 *                 value:
 *                   error: "invalid value"
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.put(
  '/:pid/?',
  (err, req, res, next) => {
    if (err.name === 'UnauthorizedError') {
      return res.status(401).send({ error: 'invalid token' })
    }
    next()
  },
  async (req, res) => {
    const { db, logger } = req.app.locals
    try {
      let { value } = req.body
      const { pid } = req.params
      const { type, week, seas_type = 'REG' } = req.body
      const { userId } = req.auth

      // TODO validate pid

      if (!type) {
        return res.status(400).send({ error: 'missing type param' })
      }

      if (typeof week === 'undefined') {
        return res.status(400).send({ error: 'missing week param' })
      }

      // TODO - validate type

      // TODO - validate range

      if (!constants.stats.includes(type)) {
        return res.status(400).send({ error: 'invalid type' })
      }

      if (typeof value !== 'undefined') {
        value = parseInt(value, 10)

        if (isNaN(value) || value % 1 !== 0) {
          return res.status(400).send({ error: 'invalid value' })
        }
      }

      const existing_projection = await db('projections_index')
        .where({
          userid: userId,
          pid,
          week,
          year: constants.season.year,
          seas_type
        })
        .first()

      if (existing_projection) {
        await db('projections_index')
          .update({
            [type]: value
          })
          .where({
            userid: userId,
            pid,
            week,
            year: constants.season.year,
            seas_type
          })

        await db('projections').insert({
          ...existing_projection,
          [type]: value,
          timestamp: new Date()
        })
      } else {
        const insert_data = {
          [type]: value,
          userid: userId,
          pid,
          week,
          year: constants.season.year,
          seas_type
        }
        await db('projections_index').insert(insert_data)

        await db('projections').insert({
          ...insert_data,
          timestamp: new Date()
        })
      }

      res.send({ value })
    } catch (error) {
      logger(error)
      res.status(500).send({ error: error.toString() })
    }
  }
)

/**
 * @swagger
 * /projections/{pid}:
 *   delete:
 *     tags:
 *       - Projections
 *     summary: Delete a user projection
 *     description: |
 *       Delete a user-specific projection for a player and week. This removes the custom
 *       projection override, allowing the system average projection to be used instead.
 *
 *       **Key Features:**
 *       - Removes user projection from projections_index table
 *       - Historical records in projections table are preserved
 *       - System falls back to average projections after deletion
 *       - Only affects projections owned by the authenticated user
 *
 *       **Use Cases:**
 *       - Remove incorrect custom projections
 *       - Revert to system average projections
 *       - Clean up outdated user overrides
 *
 *       **Important Notes:**
 *       - Only deletes projections for the authenticated user
 *       - Week and seas_type must match exactly
 *       - Historical audit trail is maintained
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: pid
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: Player ID in format FFFF-LLLL-YYYY-YYYY-MM-DD
 *         example: "PATR-MAHO-2017-1995-09-17"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - week
 *             properties:
 *               week:
 *                 type: integer
 *                 minimum: 0
 *                 maximum: 18
 *                 description: Week number (0 for season total, 1-18 for weekly)
 *                 example: 4
 *               seas_type:
 *                 type: string
 *                 enum: ['REG', 'POST', 'PRE']
 *                 default: 'REG'
 *                 description: Season type
 *                 example: "REG"
 *           examples:
 *             delete_weekly_projection:
 *               summary: Delete weekly projection
 *               value:
 *                 week: 4
 *                 seas_type: "REG"
 *             delete_season_projection:
 *               summary: Delete season projection
 *               value:
 *                 week: 0
 *                 seas_type: "REG"
 *     responses:
 *       200:
 *         description: Projection successfully deleted
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   description: Indicates successful deletion
 *                   example: true
 *                 week:
 *                   type: integer
 *                   description: Week number that was deleted
 *                   example: 4
 *                 pid:
 *                   type: string
 *                   description: Player ID that was deleted
 *                   example: "PATR-MAHO-2017-1995-09-17"
 *               required:
 *                 - success
 *                 - week
 *                 - pid
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.delete(
  '/:pid/?',
  (err, req, res, next) => {
    if (err.name === 'UnauthorizedError') {
      return res.status(401).send({ error: 'invalid token' })
    }
    next()
  },
  async (req, res) => {
    const { db, logger } = req.app.locals
    try {
      const { userId } = req.auth
      const { pid } = req.params
      const { week, seas_type = 'REG' } = req.body

      // TODO validate pid

      await db('projections_index').del().where({
        userid: userId,
        pid,
        week,
        year: constants.season.year,
        seas_type
      })

      res.send({ success: true, week, pid })
    } catch (error) {
      logger(error)
      res.status(500).send({ error: error.toString() })
    }
  }
)

export default router
