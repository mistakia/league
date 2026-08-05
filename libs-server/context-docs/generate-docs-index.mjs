import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import yaml from 'js-yaml'

import {
  build_frontmatter,
  section,
  heading,
  markdown_table,
  doc_url,
  constitution_url,
  docs_index_url,
  docs_file_url,
  api_explorer_url,
  openapi_url
} from './markdown.mjs'

const DEFAULT_BASE_URL = 'https://xo.football'

const docs_dir = fileURLToPath(new URL('../../docs/', import.meta.url))

// Groups in render order. Anything in `docs/` that is not placed by
// `doc_groups` below lands in "Other documents", so a doc added to the
// repository surfaces here without anyone remembering to edit this file.
const groups = [
  {
    key: 'api',
    title: 'API',
    blurb:
      'The interactive explorer is a browser UI; fetch the OpenAPI document instead when reading programmatically.'
  },
  {
    key: 'league',
    title: 'League rules and terminology',
    blurb: null
  },
  {
    key: 'data_views',
    title: 'Data views',
    blurb:
      'Data views are the platform query surface: a saved view is a set of columns, filters, and a scope that resolves to SQL. Build a link with the workflow, validate it against the request schema.'
  },
  {
    key: 'reference',
    title: 'Data and schema reference',
    blurb: null
  },
  {
    key: 'internals',
    title: 'Platform internals',
    blurb:
      'Written for contributors to this repository rather than for league members.'
  },
  { key: 'other', title: 'Other documents', blurb: null }
]

// Placement and, where a file cannot describe itself (no frontmatter, no H1),
// an explicit label. Descriptions are always derived from the file.
const doc_groups = {
  'api-documentation.md': { group: 'api' },
  'constitution.md': {
    group: 'league',
    url: 'constitution',
    description:
      'Governance rules for the Genesis League: roster and contract rules, tags, extensions, trades, and the amendment history.'
  },
  'glossary.md': {
    group: 'league',
    title: 'Glossary',
    description:
      'Fantasy football terminology, stat abbreviations, and platform column vocabulary.'
  },
  'resources.md': {
    group: 'league',
    title: 'Resources',
    description:
      'External stats, research, and news sources used by the platform and its managers.'
  },
  'data-views-architecture.md': { group: 'data_views' },
  'data-views-system.md': { group: 'data_views' },
  'guides/data-views.md': {
    group: 'data_views',
    title: 'Data Views Guide',
    description:
      'How to build, save, and share a data view from the application.'
  },
  'workflow-create-data-view-link.md': { group: 'data_views' },
  'guideline-data-view-links.md': { group: 'data_views' },
  'data-view-request-schema.json': { group: 'data_views' },
  'data-view-specs/index.json': { group: 'data_views' },
  'query-builder-function-reference.md': { group: 'data_views' },
  'fantasy-points-column-definition.md': { group: 'data_views' },
  'create-data-view-test.md': { group: 'internals' },
  'canonical-data-schemas.md': { group: 'reference' },
  'nfl-gsis-stat-ids.md': { group: 'reference' },
  'named-formats.md': { group: 'reference' },
  'player-management.md': { group: 'reference' },
  'simulation-system.md': { group: 'reference' },
  'context-documents.md': { group: 'reference' },
  'adding-new-fantasy-statistics.md': { group: 'internals' },
  'database-index-naming.md': { group: 'internals' },
  'fixture-maintenance.md': { group: 'internals' }
}

// Files that live outside `docs/` or are not files at all. These carry their
// own URL rather than a `/docs/` path.
const external_entries = [
  {
    group: 'api',
    label: 'API explorer',
    url: api_explorer_url,
    format: 'html',
    description:
      'Interactive Swagger UI over every endpoint, with schemas and try-it-out requests.'
  },
  {
    group: 'api',
    label: 'OpenAPI document',
    url: openapi_url,
    format: 'json',
    description:
      'The same specification as a fetchable JSON document — the machine-readable form of the explorer.'
  }
]

const humanize = (file) =>
  path
    .basename(file, path.extname(file))
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')

const first_sentence = (text, limit = 240) => {
  const flat = text.replace(/\s+/g, ' ').trim()
  if (flat.length <= limit) {
    return flat
  }
  return `${flat.slice(0, limit).replace(/\s\S*$/, '')}…`
}

/**
 * Describe a documentation file from its own contents, so the index cannot
 * drift from what the file says. A markdown file describes itself through
 * entity frontmatter (`title`/`description`) or, failing that, its H1 and
 * opening paragraph; a JSON schema through its `title`/`description` keys.
 */
async function describe_file(relative_path) {
  const contents = await fs.readFile(
    path.join(docs_dir, relative_path),
    'utf-8'
  )

  if (relative_path.endsWith('.json')) {
    try {
      const parsed = JSON.parse(contents)
      return {
        title: parsed.title || null,
        description: parsed.description || null
      }
    } catch {
      return { title: null, description: null }
    }
  }

  const frontmatter_match = contents.match(/^---\n([\s\S]*?)\n---\n/)
  if (frontmatter_match) {
    try {
      const parsed = yaml.load(frontmatter_match[1]) || {}
      if (parsed.title || parsed.description) {
        return {
          title: parsed.title || null,
          description: parsed.description || null
        }
      }
    } catch {
      // fall through to the heading/paragraph reading below
    }
  }

  const body = contents.replace(/^---\n[\s\S]*?\n---\n/, '')
  const heading_match = body.match(/^#\s+(.+)$/m)
  const after_heading = heading_match
    ? body.slice(body.indexOf(heading_match[0]) + heading_match[0].length)
    : body
  const paragraph = after_heading
    .split('\n\n')
    .map((block) => block.trim())
    .find(
      (block) =>
        block &&
        !block.startsWith('#') &&
        !block.startsWith('<') &&
        !block.startsWith('|') &&
        !block.startsWith('_')
    )

  return {
    title: heading_match ? heading_match[1].trim() : null,
    description: paragraph ? first_sentence(paragraph) : null
  }
}

/**
 * Enumerate the published documentation: every markdown and JSON file at the
 * top of `docs/`, plus the nested files named in `doc_groups`.
 */
async function list_doc_files() {
  const entries = await fs.readdir(docs_dir, { withFileTypes: true })
  const top_level = entries
    .filter(
      (entry) =>
        entry.isFile() &&
        (entry.name.endsWith('.md') || entry.name.endsWith('.json'))
    )
    .map((entry) => entry.name)

  const nested = Object.keys(doc_groups).filter((file) => file.includes('/'))

  return [...new Set([...top_level, ...nested])].sort()
}

/**
 * The documentation index: one fetch that tells an agent what reference
 * material exists, what each document covers, and where to fetch it. It is the
 * platform-wide sibling of the per-league context docs — league state lives in
 * `/leagues/:lid.md`, the reference material that explains that state lives
 * here.
 */
export default async function generate_docs_index({
  base_url = DEFAULT_BASE_URL
} = {}) {
  const files = await list_doc_files()

  const described = await Promise.all(
    files.map(async (file) => {
      const placement = doc_groups[file] || {}
      const described_file = await describe_file(file)
      return {
        group: placement.group || 'other',
        label: placement.title || described_file.title || humanize(file),
        description: placement.description || described_file.description || '',
        url:
          placement.url === 'constitution'
            ? constitution_url(base_url)
            : docs_file_url(base_url, file),
        format: file.endsWith('.json') ? 'json' : 'markdown'
      }
    })
  )

  const all_entries = [
    ...described,
    ...external_entries.map((entry) => ({
      group: entry.group,
      label: entry.label,
      description: entry.description,
      url: entry.url(base_url),
      format: entry.format
    }))
  ]

  const frontmatter = build_frontmatter({
    type: 'docs_index',
    fields: {
      canonical_url: docs_index_url(base_url),
      num_documents: all_entries.length
    },
    related: {
      related: [openapi_url(base_url), constitution_url(base_url)]
    }
  })

  const identity = [
    heading(1, 'xo.football — Documentation Index'),
    'Every published reference document for the platform, with what it covers and where to fetch it. League state (standings, rosters, cap, calendar) lives in the per-league context documents; this index covers the material that explains how that state is produced and how to query it.'
  ].join('\n\n')

  // An agent that lands here needs the shape of the league doc set, not one
  // league's URLs — every league on the platform publishes the same paths.
  const league_docs_section = section('League context documents', [
    markdown_table(
      ['Document', 'Covers'],
      [
        [
          `\`${doc_url('', { lid: ':lid' })}\``,
          'League index: standings, current phase, recent transactions'
        ],
        [
          `\`${doc_url('', { lid: ':lid', view: 'rules' })}\``,
          'Format, scoring, cap, extensions, franchise tags, restricted free agency'
        ],
        [
          `\`${doc_url('', { lid: ':lid', view: 'schedule' })}\``,
          'League calendar, playoff structure, matchups'
        ],
        [
          `\`${doc_url('', { lid: ':lid', view: 'rosters' })}\``,
          'Cap summary and every roster in the league (CSV sibling at `rosters.csv`)'
        ],
        [
          `\`${doc_url('', { lid: ':lid', tid: ':tid' })}\``,
          'One team: record, cap space, roster, draft picks, schedule, transactions'
        ]
      ]
    ),
    `Each is served at the human path plus a format suffix and needs no token. How the set fits together is described in [Context Documents](${docs_file_url(
      base_url,
      'context-documents.md'
    )}).`
  ])

  const group_sections = groups
    .map((group) => {
      const rows = all_entries
        .filter((entry) => entry.group === group.key)
        .sort((a, b) => a.label.localeCompare(b.label))
      if (!rows.length) {
        return null
      }

      return section(group.title, [
        group.blurb,
        markdown_table(
          ['Document', 'Format', 'Covers'],
          rows.map((row) => [
            `[${row.label}](${row.url})`,
            row.format,
            row.description || '—'
          ])
        )
      ])
    })
    .filter(Boolean)

  return [frontmatter, identity, ...group_sections, league_docs_section].join(
    '\n\n'
  )
}
