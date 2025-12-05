import express from 'express'
import debug from 'debug'

import convert_to_csv from '#libs-shared/convert-to-csv.mjs'
import parse_standard_selection_id from '#libs-shared/parse-standard-selection-id.mjs'

const log = debug('api:selection-combinations')
const router = express.Router()

// Normalize data to ensure all rows have all columns
function normalize_results(results) {
  if (!results || !results.length) {
    return { fields: [], normalized_results: [] }
  }

  // Collect all unique fields from all rows while preserving order
  const fields = []
  const field_set = new Set()

  for (const row of results) {
    for (const field of Object.keys(row)) {
      if (!field_set.has(field)) {
        field_set.add(field)
        fields.push(field)
      }
    }
  }

  // Ensure all rows have all fields (with null for missing values)
  const normalized_results = results.map((row) => {
    const normalized_row = {}
    for (const field of fields) {
      normalized_row[field] = row[field] !== undefined ? row[field] : null
    }
    return normalized_row
  })

  return { fields, normalized_results }
}

function set_selection_fields({ result, selection_num, values = {} }) {
  const prefix = `selection_${selection_num}_`
  result[`${prefix}player_pff_id`] = values.player_pff_id ?? null
  result[`${prefix}player_gsis_it_id`] = values.player_gsis_it_id ?? null
  result[`${prefix}player_gsisid`] = values.player_gsisid ?? null
  result[`${prefix}player_position`] = values.player_position ?? null
  result[`${prefix}nfl_team`] = values.nfl_team ?? null
  result[`${prefix}first_name`] = values.first_name ?? null
  result[`${prefix}last_name`] = values.last_name ?? null
  result[`${prefix}market_type`] = values.market_type ?? null
  result[`${prefix}line`] = values.line ?? null
  result[`${prefix}selection_type`] = values.selection_type ?? null
}

/**
 * @swagger
 * /selection-combinations:
 *   get:
 *     tags:
 *       - Selection Combinations
 *     summary: Get combination odds
 *     description: Retrieve parlay/SGP odds for predefined selection combinations. Each combination defines a set of selections (player props, game lines) that form a parlay bet.
 *     parameters:
 *       - $ref: '#/components/parameters/week'
 *       - $ref: '#/components/parameters/year'
 *       - name: source_id
 *         in: query
 *         schema:
 *           type: string
 *         description: Filter by sportsbook source
 *         example: FANDUEL
 *       - name: combination_id
 *         in: query
 *         schema:
 *           type: integer
 *         description: Filter by specific combination definition ID
 *       - name: format
 *         in: query
 *         schema:
 *           type: string
 *           enum: [json, csv]
 *           default: json
 *         description: Response format
 *       - name: limit
 *         in: query
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 10000
 *           default: 1000
 *         description: Number of records to return
 *       - name: offset
 *         in: query
 *         schema:
 *           type: integer
 *           minimum: 0
 *           default: 0
 *         description: Number of records to skip
 *     responses:
 *       200:
 *         description: List of combination odds with player and selection details
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/CombinationOdds'
 *           text/csv:
 *             schema:
 *               type: string
 *               description: CSV formatted data
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */

function transform_combination_odds_row({ row, player_lookup_map }) {
  const result = {
    combination_name: row.combination_name,
    source_id: row.source_id,
    year: row.year,
    week: row.week,
    esbid: row.esbid,
    decimal_odds: row.decimal_odds,
    american_odds: row.american_odds,
    timestamp: row.timestamp
  }

  const selection_ids = row.selection_ids || []

  for (let i = 0; i < 4; i++) {
    const selection_num = i + 1
    const selection_id = selection_ids[i]

    if (!selection_id) {
      set_selection_fields({ result, selection_num })
      continue
    }

    try {
      const parsed = parse_standard_selection_id(selection_id)
      const player = parsed.pid ? player_lookup_map.get(parsed.pid) : null

      set_selection_fields({
        result,
        selection_num,
        values: {
          player_pff_id: player?.pff_id,
          player_gsis_it_id: player?.gsis_it_id,
          player_gsisid: player?.gsisid,
          player_position: player?.pos,
          nfl_team: player?.current_nfl_team,
          first_name: player?.fname,
          last_name: player?.lname,
          market_type: parsed.market_type,
          line: parsed.line,
          selection_type: parsed.selection_type
        }
      })
    } catch (error) {
      log(`Error parsing selection_id: ${selection_id}`, error)
      set_selection_fields({ result, selection_num })
    }
  }

  return result
}

router.get('/', async (req, res) => {
  const { db, logger } = req.app.locals
  try {
    const {
      format = 'json',
      year,
      week,
      source_id,
      combination_id,
      limit = 1000,
      offset = 0
    } = req.query

    const parsed_limit = Math.min(parseInt(limit, 10) || 1000, 10000)
    const parsed_offset = Math.max(parseInt(offset, 10) || 0, 0)

    // Build query
    let query = db('selection_combination_odds_index as scoi')
      .join(
        'selection_combination_definitions as scd',
        'scoi.combination_id',
        'scd.combination_id'
      )
      .select(
        'scd.combination_name',
        'scoi.source_id',
        'scoi.year',
        'scoi.week',
        'scoi.esbid',
        'scoi.decimal_odds',
        'scoi.american_odds',
        'scoi.timestamp',
        'scoi.selection_ids'
      )
      .orderBy('scoi.timestamp', 'desc')
      .limit(parsed_limit)
      .offset(parsed_offset)

    // Apply filters
    if (year) {
      query = query.where('scoi.year', parseInt(year, 10))
    }
    if (week) {
      query = query.where('scoi.week', parseInt(week, 10))
    }
    if (source_id) {
      query = query.where('scoi.source_id', source_id)
    }
    if (combination_id) {
      query = query.where('scoi.combination_id', parseInt(combination_id, 10))
    }

    const rows = await query

    if (!rows.length) {
      if (format === 'csv') {
        res.setHeader('Content-Type', 'text/csv')
        res.setHeader(
          'Content-Disposition',
          'attachment; filename="selection-combinations.csv"'
        )
        return res.send('')
      }
      return res.json([])
    }

    // Collect unique PIDs from all selection_ids
    const pid_set = new Set()
    for (const row of rows) {
      const selection_ids = row.selection_ids || []
      for (const selection_id of selection_ids) {
        try {
          const parsed = parse_standard_selection_id(selection_id)
          if (parsed.pid) {
            pid_set.add(parsed.pid)
          }
        } catch (error) {
          log(`Error parsing selection_id for PID extraction: ${selection_id}`)
        }
      }
    }

    // Query player table for all PIDs at once
    const player_lookup_map = new Map()
    if (pid_set.size > 0) {
      const pids = Array.from(pid_set)
      const players = await db('player')
        .select(
          'pid',
          'pff_id',
          'gsis_it_id',
          'gsisid',
          'pos',
          'current_nfl_team',
          'fname',
          'lname'
        )
        .whereIn('pid', pids)

      for (const player of players) {
        player_lookup_map.set(player.pid, player)
      }
    }

    // Transform rows to flat structure
    const transformed_results = rows.map((row) =>
      transform_combination_odds_row({ row, player_lookup_map })
    )

    // Normalize results to ensure consistent columns
    const { fields, normalized_results } =
      normalize_results(transformed_results)

    // Format output
    if (format === 'csv') {
      // Create header object with all fields
      const header = {}
      for (const field of fields) {
        header[field] = field
      }

      const csv_data = [header, ...normalized_results]
      const csv_output = convert_to_csv(csv_data)

      res.setHeader('Content-Type', 'text/csv')
      res.setHeader(
        'Content-Disposition',
        'attachment; filename="selection-combinations.csv"'
      )
      return res.send(csv_output)
    }

    // JSON format (default)
    res.setHeader('Content-Type', 'application/json')
    return res.json(normalized_results)
  } catch (error) {
    logger(error)
    log(error)
    return res.status(500).json({ error: error.message })
  }
})

export default router
