// === PROMPT TEMPLATE (do not edit without re-running C4 dry-run) ===
//
// SYSTEM PROMPT (cached — sent once per batch):
// -----------------------------------------------
// You generate short descriptor tags for saved NFL fantasy football data views.
//
// Output rules:
// - Return a JSON array of 1 to 4 tag strings, nothing else.
// - Each tag must be kebab-case: lowercase letters, digits, and hyphens only. Example: "red-zone", "game-situation".
// - Tags must be 1-64 characters long.
// - Tags must NOT appear in the EXCLUDED VOCABULARY list below — those are reserved for a deterministic auto-tagger.
// - Tags should capture an axis the auto-tagger cannot: fantasy context, game situation, research theme, dynasty context, matchup type, scoring format nuance, etc.
// - Aim for 2-3 tags that would help a user find this view in a filtered list.
//
// EXCLUDED VOCABULARY (do not produce any of these):
// player-stats, team-stats, defense-stats, qb, rb, wr, te, multi-position, team-level,
// opportunity, efficiency, betting-markets, projections, trade-values, play-by-play,
// current-week, season-to-date, multi-season, historical
//
// Examples:
//   View "Dynasty Trade Value Rankings" → ["dynasty", "trade-value", "keeper"]
//   View "1st Quarter Alt Passing Markets (DraftKings)" → ["dfs", "alt-lines", "first-quarter"]
//   View "Playoff Rushing Matchup Preview" → ["playoff", "matchup-preview", "game-script"]
//   View "RB Breakout Candidate Research" → ["research", "breakout", "dynasty"]
//   View "Weekly PPR Scoring Summary" → ["ppr", "fantasy-scoring", "weekly-recap"]
//   View "Cover 1 Defense Tendencies by Week" → ["coverage-scheme", "game-situation", "weekly-split"]
//   View "WOPR by Week" → ["usage-share", "weekly-split"]
//   View "Airyards.com First Read" → ["research", "route-concept", "air-yards-share"]
//
// USER MESSAGE (per-view, not cached):
// -----------------------------------------------
// Generate descriptor tags for this saved data view.
//
// Name: {view_name}
// Description: {view_description}
// Top columns (by frequency): {column_ids}
// Where filters: {where_filters}
// Row axes: {row_axes}
// User tags (anchors — mirror these if applicable): {user_tags}
//
// Return only a JSON array of 1-4 kebab-case descriptor tags.
// === END PROMPT TEMPLATE ===

import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import Anthropic from '@anthropic-ai/sdk'

import db from '#db'
import { is_main } from '#libs-server'
import { system_view_ids_set } from '#libs-shared/view-organization/system-data-view-ids.mjs'
import { AUTO_TAG_VOCABULARY_SET } from '#libs-shared/view-organization/auto-tag-vocabulary.mjs'

const log = debug('generate-data-view-llm-tags')
debug.enable('generate-data-view-llm-tags')

const KEBAB_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/
const MAX_TAG_LENGTH = 64
const MODEL = 'claude-haiku-4-5-20251001'
const MAX_TOKENS = 200
const MAX_COLUMNS = 20

// ── Prompt builders ───────────────────────────────────────────────────────────

const AUTO_TAG_EXCLUSION_LIST = [...AUTO_TAG_VOCABULARY_SET].join(', ')

const SYSTEM_PROMPT = `You generate short descriptor tags for saved NFL fantasy football data views.

Output rules:
- Return a JSON array of 1 to 4 tag strings, nothing else.
- Each tag must be kebab-case: lowercase letters, digits, and hyphens only. Example: "red-zone", "game-situation".
- Tags must be 1-64 characters long.
- Tags must NOT appear in the EXCLUDED VOCABULARY list below — those are reserved for a deterministic auto-tagger.
- Tags should capture an axis the auto-tagger cannot: fantasy context, game situation, research theme, dynasty context, matchup type, scoring format nuance, etc.
- Aim for 2-3 tags that would help a user find this view in a filtered list.

EXCLUDED VOCABULARY (do not produce any of these):
${AUTO_TAG_EXCLUSION_LIST}

Examples:
  View "Dynasty Trade Value Rankings" → ["dynasty", "trade-value", "keeper"]
  View "1st Quarter Alt Passing Markets (DraftKings)" → ["dfs", "alt-lines", "first-quarter"]
  View "Playoff Rushing Matchup Preview" → ["playoff", "matchup-preview", "game-script"]
  View "RB Breakout Candidate Research" → ["research", "breakout", "dynasty"]
  View "Weekly PPR Scoring Summary" → ["ppr", "fantasy-scoring", "weekly-recap"]
  View "Cover 1 Defense Tendencies by Week" → ["coverage-scheme", "game-situation", "weekly-split"]
  View "WOPR by Week" → ["usage-share", "weekly-split"]
  View "Airyards.com First Read" → ["research", "route-concept", "air-yards-share"]`

const build_user_message = ({
  view_name,
  view_description,
  table_state,
  user_tags
}) => {
  // Extract top columns by occurrence
  const columns = table_state?.columns || []
  const column_id_counts = {}
  for (const col of columns) {
    const cid = col?.column_id
    if (cid) column_id_counts[cid] = (column_id_counts[cid] || 0) + 1
  }
  const top_columns = Object.entries(column_id_counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_COLUMNS)
    .map(([id]) => id)

  // Extract where filters
  const where = table_state?.where || []
  const where_parts = where.map((w) => {
    const vals = Array.isArray(w.value) ? w.value.join(', ') : w.value
    return `${w.column_id}=${vals}`
  })

  // Extract row_axes
  const row_axes = table_state?.row_axes || []

  const user_tag_names = user_tags.map((t) => t.tag_name).join(', ') || 'none'

  return `Generate descriptor tags for this saved data view.

Name: ${view_name}
Description: ${view_description || 'none'}
Top columns (by frequency): ${top_columns.length ? top_columns.join(', ') : 'none'}
Where filters: ${where_parts.length ? where_parts.join('; ') : 'none'}
Row axes: ${row_axes.length ? row_axes.join(', ') : 'none'}
User tags (anchors — mirror these if applicable): ${user_tag_names}

Return only a JSON array of 1-4 kebab-case descriptor tags.`
}

// ── Validation ────────────────────────────────────────────────────────────────

const validate_tags = (raw) => {
  let parsed
  try {
    parsed = JSON.parse(raw.trim())
  } catch {
    throw new Error(`Response is not valid JSON: ${raw.slice(0, 200)}`)
  }

  if (!Array.isArray(parsed)) {
    throw new Error(`Response is not a JSON array: ${raw.slice(0, 200)}`)
  }

  if (parsed.length < 1 || parsed.length > 4) {
    throw new Error(
      `Expected 1-4 tags, got ${parsed.length}: ${JSON.stringify(parsed)}`
    )
  }

  const validated = []
  for (const tag of parsed) {
    if (typeof tag !== 'string')
      throw new Error(`Non-string tag: ${JSON.stringify(tag)}`)

    const t = tag.trim().toLowerCase()

    if (!KEBAB_RE.test(t)) {
      throw new Error(`Tag fails kebab-case validation: "${t}"`)
    }

    if (t.length > MAX_TAG_LENGTH) {
      throw new Error(`Tag exceeds ${MAX_TAG_LENGTH} chars: "${t}"`)
    }

    if (AUTO_TAG_VOCABULARY_SET.has(t)) {
      throw new Error(`Tag collides with auto-tag vocabulary: "${t}"`)
    }

    validated.push(t)
  }

  return validated
}

// ── CLI ───────────────────────────────────────────────────────────────────────

const initialize_cli = () =>
  yargs(hideBin(process.argv))
    .option('view-id', {
      describe: 'Refresh a single view by ID',
      type: 'string'
    })
    .option('user-id', {
      describe: "Scope to one user's views",
      type: 'number'
    })
    .option('dry-run', {
      describe: 'Call Claude and validate but do not write to DB',
      type: 'boolean',
      default: false
    })
    .option('limit', {
      describe: 'Cap the number of views to process (for testing)',
      type: 'number'
    }).argv

// ── Main ─────────────────────────────────────────────────────────────────────

const main = async () => {
  const argv = initialize_cli()
  const api_key = process.env.ANTHROPIC_API_KEY
  if (!api_key) {
    console.error(
      'Error: ANTHROPIC_API_KEY environment variable is not set.\n' +
        'Export it before running: export ANTHROPIC_API_KEY=sk-ant-...'
    )
    process.exit(1)
  }

  const client = new Anthropic({ apiKey: api_key })

  // ── Build view selection query ─────────────────────────────────────────────
  let query = db('user_data_views').select(
    'view_id',
    'user_id',
    'view_name',
    'view_description',
    'table_state',
    'llm_tags_generated_at',
    'updated_at'
  )

  if (argv['view-id']) {
    query = query.where('view_id', argv['view-id'])
  } else if (argv['user-id']) {
    query = query.where('user_id', argv['user-id']).where(function () {
      this.whereNull('llm_tags_generated_at').orWhereRaw(
        'updated_at > llm_tags_generated_at'
      )
    })
  } else {
    query = query.where(function () {
      this.whereNull('llm_tags_generated_at').orWhereRaw(
        'updated_at > llm_tags_generated_at'
      )
    })
  }

  if (argv.limit) query = query.limit(argv.limit)

  const views = await query

  // Filter out system views
  const user_views = views.filter((v) => !system_view_ids_set.has(v.view_id))

  log(
    `Processing ${user_views.length} views (${views.length - user_views.length} system views skipped)`
  )

  if (user_views.length === 0) {
    console.log('No views to process.')
    process.exit(0)
  }

  // Fetch user tags for all selected views in one query
  const view_ids = user_views.map((v) => v.view_id)
  const user_ids_set = [...new Set(user_views.map((v) => v.user_id))]
  const existing_user_tags = await db('user_data_view_tags')
    .whereIn('view_id', view_ids)
    .whereIn('user_id', user_ids_set)
    .where('source', 'user')
    .select('user_id', 'view_id', 'tag_name')

  const user_tags_map = {}
  for (const row of existing_user_tags) {
    const key = `${row.user_id}:${row.view_id}`
    if (!user_tags_map[key]) user_tags_map[key] = []
    user_tags_map[key].push({ tag_name: row.tag_name })
  }

  // ── Process each view ──────────────────────────────────────────────────────
  let any_failed = false

  for (const view of user_views) {
    const { view_id, user_id, view_name, view_description, table_state } = view
    const user_tags = user_tags_map[`${user_id}:${view_id}`] || []
    const start_ms = Date.now()

    try {
      const user_message = build_user_message({
        view_name,
        view_description,
        table_state,
        user_tags
      })

      const response = await client.messages.create({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system: [
          {
            type: 'text',
            text: SYSTEM_PROMPT,
            cache_control: { type: 'ephemeral' }
          }
        ],
        messages: [{ role: 'user', content: user_message }]
      })

      const raw_text = response.content[0]?.text || ''
      const tags = validate_tags(raw_text)
      const duration_ms = Date.now() - start_ms

      if (argv['dry-run']) {
        console.log(
          JSON.stringify({
            view_id,
            user_id,
            view_name,
            tags,
            duration_ms,
            status: 'dry-run'
          })
        )
      } else {
        await db.transaction(async (trx) => {
          // Delete prior llm rows for this (user_id, view_id)
          await trx('user_data_view_tags')
            .where({ user_id, view_id, source: 'llm' })
            .del()

          // Insert validated tags — ON CONFLICT DO NOTHING preserves any existing user row
          if (tags.length > 0) {
            const inserts = tags.map((tag_name) => ({
              user_id,
              view_id,
              tag_name,
              source: 'llm'
            }))
            await trx('user_data_view_tags')
              .insert(inserts)
              .onConflict(['user_id', 'view_id', 'tag_name'])
              .ignore()
          }

          // Update freshness timestamp
          await trx('user_data_views')
            .where({ view_id, user_id })
            .update({ llm_tags_generated_at: db.fn.now() })
        })

        console.log(
          JSON.stringify({
            view_id,
            user_id,
            view_name,
            tags,
            duration_ms,
            status: 'ok'
          })
        )
      }
    } catch (err) {
      any_failed = true
      const duration_ms = Date.now() - start_ms
      console.error(
        JSON.stringify({
          view_id,
          user_id,
          view_name,
          error: err.message,
          duration_ms,
          status: 'failed'
        })
      )
    }
  }

  await db.destroy()
  process.exit(any_failed ? 1 : 0)
}

if (is_main(import.meta.url)) {
  main()
}
