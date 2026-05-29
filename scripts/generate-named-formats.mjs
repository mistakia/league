#!/usr/bin/env node

import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'

import {
  scoring_formats,
  league_formats
} from '#libs-shared/league-format-definitions.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const project_root = path.join(__dirname, '..')

const validate_slug = (name) => /^[a-z0-9_]+$/.test(name)

const stable_stringify = (value) => {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) {
    return '[' + value.map(stable_stringify).join(',') + ']'
  }
  const keys = Object.keys(value).sort()
  return (
    '{' +
    keys.map((k) => JSON.stringify(k) + ':' + stable_stringify(value[k])).join(',') +
    '}'
  )
}

// Group entries by deep-equality on the DB's unique-constraint tuple and pick
// the alphabetical-first slug as the canonical id for the group. All source
// keys in the group emit id = canonical. The unique tuple is supplied by the
// caller because it differs between scoring_formats (config only) and
// league_formats (config + scoring_format + pricing_model -- a roster config
// with two different scorings is two distinct DB rows).
const build_canonical_id_map = (formats, build_unique_tuple) => {
  const groups = new Map()
  for (const name of Object.keys(formats).sort()) {
    const tuple = build_unique_tuple(formats[name])
    if (tuple === null) continue
    const key = stable_stringify(tuple)
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(name)
  }
  const canonical_by_source = {}
  for (const members of groups.values()) {
    const sorted = members.slice().sort()
    const canonical = sorted[0]
    for (const member of sorted) canonical_by_source[member] = canonical
  }
  return canonical_by_source
}

const process_scoring_formats = () => {
  const errors = []
  const canonical_by_source = build_canonical_id_map(
    scoring_formats,
    (entry) => entry.config || null
  )
  const processed = {}

  for (const [name, format] of Object.entries(scoring_formats)) {
    if (!validate_slug(name)) {
      errors.push(`Invalid scoring format slug: "${name}" - must be snake_case`)
      continue
    }
    if (!format.label) {
      errors.push(`Missing label for scoring format: "${name}"`)
      continue
    }
    if (!format.config) {
      errors.push(`Scoring format "${name}" must have a 'config' field`)
      continue
    }
    processed[name] = {
      id: canonical_by_source[name],
      label: format.label,
      description: format.description || ''
    }
  }

  return { processed, errors, canonical_by_source }
}

const process_league_formats = (scoring_canonical_by_source, scoring_processed) => {
  const errors = []
  const canonical_by_source = build_canonical_id_map(league_formats, (entry) => {
    if (!entry.config) return null
    const scoring_id =
      entry.scoring_format && scoring_canonical_by_source[entry.scoring_format]
    if (!scoring_id) return null
    return {
      config: entry.config,
      scoring_format_id: scoring_id,
      pricing_model: entry.pricing_model || 'auction'
    }
  })
  const processed = {}

  for (const [name, format] of Object.entries(league_formats)) {
    if (!validate_slug(name)) {
      errors.push(`Invalid league format slug: "${name}" - must be snake_case`)
      continue
    }
    if (!format.label) {
      errors.push(`Missing label for league format: "${name}"`)
      continue
    }
    if (!format.config) {
      errors.push(`League format "${name}" must have a 'config' field`)
      continue
    }
    if (!format.scoring_format) {
      errors.push(`League format "${name}" must specify scoring_format`)
      continue
    }
    if (!scoring_processed[format.scoring_format]) {
      errors.push(
        `Invalid scoring_format reference "${format.scoring_format}" for league format "${name}"`
      )
      continue
    }

    const pricing_model = format.pricing_model || 'auction'
    if (pricing_model !== 'auction' && pricing_model !== 'dfs_fixed') {
      errors.push(
        `Invalid pricing_model "${pricing_model}" for league format "${name}" - must be 'auction' or 'dfs_fixed'`
      )
      continue
    }

    processed[name] = {
      id: canonical_by_source[name],
      label: format.label,
      description: format.description || '',
      scoring_format: scoring_canonical_by_source[format.scoring_format],
      pricing_model
    }
  }

  return { processed, errors }
}

const emit_catalog_object = (entries, indent, extra_fields) => {
  const sorted = Object.entries(entries).sort((a, b) => a[0].localeCompare(b[0]))
  let out = ''
  for (const [name, entry] of sorted) {
    out += `${indent}${name}: {\n`
    out += `${indent}  id: '${entry.id}',\n`
    out += `${indent}  label: ${JSON.stringify(entry.label)},\n`
    out += `${indent}  description: ${JSON.stringify(entry.description)}`
    for (const field of extra_fields) {
      if (entry[field] !== undefined && entry[field] !== null) {
        out += `,\n${indent}  ${field}: '${entry[field]}'`
      }
    }
    out += `\n${indent}},\n`
  }
  return out.slice(0, -2) + '\n'
}

const generate_catalog_content = (scoring, league) => {
  const timestamp = new Date().toISOString()
  let content = `// Auto-generated named format catalog
// Generated at: ${timestamp}
// DO NOT EDIT THIS FILE MANUALLY
// To make changes, edit libs-shared/league-format-definitions.mjs and run: yarn generate:formats

export const named_scoring_formats = {
`
  content += emit_catalog_object(scoring, '  ', [])
  content += `}

export const named_league_formats = {
`
  content += emit_catalog_object(league, '  ', ['scoring_format', 'pricing_model'])
  content += `}\n`
  return content
}

const group_by_id = (entries) => {
  const groups = new Map()
  for (const [name, entry] of Object.entries(entries)) {
    if (!groups.has(entry.id)) groups.set(entry.id, [])
    groups.get(entry.id).push(name)
  }
  return groups
}

const generate_markdown_documentation = (scoring_processed, league_processed) => {
  const timestamp = new Date().toISOString()
  let content = `# Named Scoring and League Formats

*Generated at: ${timestamp}*

This document shows the configuration for each named format in the system. Identities are stable opaque IDs; multiple source keys may share an ID when their configs are byte-identical (the alphabetical-first slug wins).

`

  const league_entries = Object.entries(league_processed).sort((a, b) =>
    a[0].localeCompare(b[0])
  )
  if (league_entries.length > 0) {
    content += `## League Format Summary

| Source Key | ID | Description |
|------------|----|-------------|
`
    for (const [name, entry] of league_entries) {
      content += `| \`${name}\` | \`${entry.id}\` | ${entry.description || 'No description'} |\n`
    }
    content += '\n'
  }

  const scoring_entries = Object.entries(scoring_processed).sort((a, b) =>
    a[0].localeCompare(b[0])
  )
  if (scoring_entries.length > 0) {
    content += `## Scoring Format Summary

| Source Key | ID | Description |
|------------|----|-------------|
`
    for (const [name, entry] of scoring_entries) {
      content += `| \`${name}\` | \`${entry.id}\` | ${entry.description || 'No description'} |\n`
    }
    content += '\n'
  }

  const scoring_groups = group_by_id(scoring_processed)
  const league_groups = group_by_id(league_processed)

  if (league_entries.length > 0) {
    content += `## League Format Details\n\n`
    for (const [id, members] of [...league_groups.entries()].sort()) {
      const canonical = members.slice().sort()[0]
      const entry = league_processed[canonical]
      content += `### ${id}\n\n`
      if (members.length > 1) {
        content += `**Source Keys:** ${members.map((m) => `\`${m}\``).join(', ')} (collapsed to canonical \`${id}\`)\n`
      } else {
        content += `**Source Key:** \`${canonical}\`\n`
      }
      content += `**Label:** ${entry.label}\n`
      content += `**Description:** ${entry.description || 'No description'}\n`
      content += `**Scoring Format:** \`${entry.scoring_format}\`\n`
      content += `**Pricing Model:** \`${entry.pricing_model}\`\n\n`
      const config = league_formats[canonical].config
      content += `**Configuration:**\n\n| Property | Value |\n|----------|-------|\n`
      for (const [prop, value] of Object.entries(config)) {
        content += `| \`${prop}\` | ${value} |\n`
      }
      content += '\n'
    }
  }

  if (scoring_entries.length > 0) {
    content += `## Scoring Format Details\n\n`
    for (const [id, members] of [...scoring_groups.entries()].sort()) {
      const canonical = members.slice().sort()[0]
      const entry = scoring_processed[canonical]
      content += `### ${id}\n\n`
      if (members.length > 1) {
        content += `**Source Keys:** ${members.map((m) => `\`${m}\``).join(', ')} (collapsed to canonical \`${id}\`)\n`
      } else {
        content += `**Source Key:** \`${canonical}\`\n`
      }
      content += `**Label:** ${entry.label}\n`
      content += `**Description:** ${entry.description || 'No description'}\n\n`
      const config = scoring_formats[canonical].config
      content += `**Configuration:**\n\n| Property | Value |\n|----------|-------|\n`
      for (const [prop, value] of Object.entries(config)) {
        content += `| \`${prop}\` | ${value} |\n`
      }
      content += '\n'
    }
  }

  return content
}

const main = async () => {
  console.log('Generating named format catalog...')

  const all_errors = []

  const {
    processed: scoring,
    errors: scoring_errors,
    canonical_by_source: scoring_canonical
  } = process_scoring_formats()
  all_errors.push(...scoring_errors)
  const scoring_unique_ids = new Set(Object.values(scoring).map((e) => e.id)).size
  console.log(
    `- Processed ${Object.keys(scoring).length} scoring source keys -> ${scoring_unique_ids} unique IDs`
  )

  const { processed: league, errors: league_errors } = process_league_formats(
    scoring_canonical,
    scoring
  )
  all_errors.push(...league_errors)
  const league_unique_ids = new Set(Object.values(league).map((e) => e.id)).size
  console.log(
    `- Processed ${Object.keys(league).length} league source keys -> ${league_unique_ids} unique IDs`
  )

  if (all_errors.length > 0) {
    console.error('\nErrors found:')
    all_errors.forEach((error) => console.error(`- ${error}`))
    process.exit(1)
  }

  const libs_dir = path.join(project_root, 'libs-shared')
  const docs_dir = path.join(project_root, 'docs')

  const catalog_content = generate_catalog_content(scoring, league)
  const catalog_path = path.join(libs_dir, 'named-format-catalog.mjs')
  await fs.writeFile(catalog_path, catalog_content, 'utf8')
  console.log(`\nGenerated: ${path.relative(project_root, catalog_path)}`)

  const markdown_content = generate_markdown_documentation(scoring, league)
  const markdown_path = path.join(docs_dir, 'named-formats.md')
  await fs.writeFile(markdown_path, markdown_content, 'utf8')
  console.log(`Generated: ${path.relative(project_root, markdown_path)}`)

  console.log('\nFormat generation completed successfully.')
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error('Generation failed:', error)
    process.exit(1)
  })
}

export default main
