import express from 'express'

import sources from './sources.mjs'

/**
 * @swagger
 * tags:
 *   name: Settings
 *   description: |
 *     User settings and configuration endpoints for personalizing the fantasy football experience.
 *
 *     **Settings Categories:**
 *     - **Sources** - Customize projection source weights for personalized composite projections
 *     - **Preferences** - User interface and display preferences (future endpoints)
 *     - **Notifications** - Alert and notification settings (future endpoints)
 *
 *     **Authentication:**
 *     All settings endpoints require authentication as they modify user-specific data.
 *
 *     **Data Persistence:**
 *     Settings are stored in the database and persist across user sessions.
 *     Changes take effect immediately for the authenticated user.
 */

const router = express.Router()

/**
 * Settings subroutes:
 * - /sources - Projection source weight management
 */
router.use('/sources', sources)

export default router
