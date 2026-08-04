/* global describe it before */

// Consistency spec for libs-shared/scoring-columns.mjs.
//
// The registry replaced four hand-maintained enumerations with one. That is
// only an improvement if the registry is checked against the surfaces it now
// feeds -- otherwise it is a fifth place to be wrong. These assertions make
// drift structurally detectable instead of comment-enforced.
//
// The schema check exists because of a concrete failure on 2026-08-04: a writer
// named five columns that did not exist in league_scoring_formats and 2947
// tests passed.

import fs from 'fs/promises'
import path, { dirname } from 'path'
import { fileURLToPath } from 'url'
import * as chai from 'chai'

import {
  scoring_registry,
  scoring_columns,
  scoring_column_names,
  stat_names_for_group
} from '#libs-shared/scoring-columns.mjs'
import {
  base_fantasy_stats,
  kicker_fantasy_stats,
  defense_fantasy_stats,
  all_fantasy_stats
} from '#constants/stats-constants.mjs'
import { SCORING_COLUMNS } from '#libs-server/find-or-create-format.mjs'
import { scoring_field_labels } from '#constants/league-settings-labels.mjs'

const expect = chai.expect
const __dirname = dirname(fileURLToPath(import.meta.url))

const schema_path = path.resolve(__dirname, '../db/schema.postgres.sql')

// Reads the league_scoring_formats CREATE TABLE block out of the exported
// schema. Parsing the committed schema file rather than querying the test
// database is deliberate: CI, the conformance ratchet and every fresh
// environment all load the schema file, so it is the artifact that must agree
// with the registry.
const parse_scoring_format_columns = (schema_sql) => {
  const block = schema_sql.match(
    /CREATE TABLE public\.league_scoring_formats \(\n([\s\S]*?)\n\);/
  )

  expect(block, 'league_scoring_formats CREATE TABLE block not found').to.exist

  const columns = {}
  for (const line of block[1].split('\n')) {
    const match = line
      .trim()
      .replace(/,$/, '')
      .match(/^(\w+) (.+?)(?: DEFAULT (.+?))?(?: NOT NULL)?$/)
    if (match) {
      columns[match[1]] = { sql_type: match[2], default_sql: match[3] }
    }
  }
  return columns
}

// The dedup oracle: a config that already exists must upsert onto its existing
// id rather than minting a new one. A registry column missing from the oracle
// silently merges two distinct formats.
//
// Today the oracle is the full-tuple unique constraint. It is replaced by a
// generated config_digest column once the kicking and DST columns take the
// tuple past Postgres's 32-key index ceiling, at which point this reads the
// digest expression instead.
const parse_dedup_oracle_columns = (schema_sql) => {
  const constraint = schema_sql.match(
    /ADD CONSTRAINT league_scoring_formats_config_unique UNIQUE \(([^)]+)\)/
  )

  expect(constraint, 'dedup oracle not found in schema').to.exist

  return constraint[1].split(',').map((column) => column.trim())
}

describe('LIBS-SHARED scoring registry', function () {
  let schema_columns
  let dedup_oracle_columns

  before(async function () {
    const schema_sql = await fs.readFile(schema_path, 'utf8')
    schema_columns = parse_scoring_format_columns(schema_sql)
    dedup_oracle_columns = parse_dedup_oracle_columns(schema_sql)
  })

  describe('schema agreement', function () {
    it('declares every registry column as a real league_scoring_formats column', () => {
      const missing = scoring_column_names.filter(
        (column) => !schema_columns[column]
      )

      expect(missing, `not columns of league_scoring_formats: ${missing}`).to.be
        .empty
    })

    it('covers every scoring column the schema declares', () => {
      // scoring_format_title is the format's name and id is its identity;
      // neither is a scored value, so neither belongs to the registry.
      const non_scoring_columns = [
        'scoring_format_title',
        'id',
        'config_digest'
      ]
      const unregistered = Object.keys(schema_columns).filter(
        (column) =>
          !non_scoring_columns.includes(column) &&
          !scoring_column_names.includes(column)
      )

      expect(unregistered, `columns missing from the registry: ${unregistered}`)
        .to.be.empty
    })

    it('records the schema type of every column', () => {
      for (const entry of scoring_columns) {
        expect(entry.sql_type, `sql_type for ${entry.column}`).to.equal(
          schema_columns[entry.column].sql_type
        )
      }
    })

    it('records the schema default of every column that has one', () => {
      for (const entry of scoring_columns) {
        const { default_sql } = schema_columns[entry.column]
        if (default_sql === undefined) {
          expect(
            entry.default_value,
            `${entry.column} has no schema default`
          ).to.equal(undefined)
        } else {
          expect(
            String(entry.default_value),
            `default_value for ${entry.column}`
          ).to.equal(default_sql)
        }
      }
    })
  })

  describe('dedup oracle agreement', function () {
    it('includes every registry column in the dedup oracle', () => {
      const missing = scoring_column_names.filter(
        (column) => !dedup_oracle_columns.includes(column)
      )

      expect(
        missing,
        `registry columns absent from the dedup oracle, so two distinct formats would collapse onto one id: ${missing}`
      ).to.be.empty
    })

    it('has no column in the dedup oracle that the registry does not know', () => {
      const unknown = dedup_oracle_columns.filter(
        (column) => !scoring_column_names.includes(column)
      )

      expect(
        unknown,
        `dedup oracle columns missing from the registry: ${unknown}`
      ).to.be.empty
    })
  })

  describe('derived consumers', function () {
    it('feeds SCORING_COLUMNS in find-or-create-format', () => {
      expect(SCORING_COLUMNS).to.equal(scoring_column_names)
    })

    it('feeds the three fantasy stat lists', () => {
      expect(base_fantasy_stats).to.eql(stat_names_for_group('base'))
      expect(kicker_fantasy_stats).to.eql(stat_names_for_group('kicking'))
      expect(defense_fantasy_stats).to.eql(stat_names_for_group('dst'))
    })

    // Pinned in full, in order. all_fantasy_stats is what format_base_gamelog
    // filters persisted gamelog fields against, so both its membership and its
    // order are observable: a dropped entry stops a column being written, and a
    // reordering changes generated column order and the accumulation order of
    // the floating point sum in calculate-points.mjs. This is the array as it
    // stood before the registry replaced the three literal lists.
    it('reproduces all_fantasy_stats exactly as it stood before the registry', () => {
      expect(all_fantasy_stats).to.eql([
        'passing_attempts',
        'passing_completions',
        'passing_yards',
        'passing_interceptions',
        'passing_touchdowns',
        'rushing_attempts',
        'rushing_yards',
        'rushing_yards_excluding_kneels',
        'rushing_touchdowns',
        'rushing_first_downs',
        'fumbles_lost',
        'targets',
        'receptions',
        'receiving_yards',
        'receiving_first_downs',
        'receiving_touchdowns',
        'two_point_conversions',
        'punt_return_touchdowns',
        'kickoff_return_touchdowns',
        'fumble_return_touchdowns',
        'field_goals_made',
        'field_goal_yards',
        'field_goals_made_0_19_yards',
        'field_goals_made_20_29_yards',
        'field_goals_made_30_39_yards',
        'field_goals_made_40_49_yards',
        'field_goals_made_50_plus_yards',
        'extra_points_made',
        'defensive_sacks',
        'defensive_interceptions',
        'defensive_forced_fumbles',
        'defensive_recovered_fumbles',
        'defensive_three_and_outs',
        'defensive_fourth_down_stops',
        'defensive_points_against',
        'defensive_yards_against',
        'defensive_blocked_kicks',
        'defensive_safeties',
        'defensive_two_point_returns',
        'defensive_touchdowns'
      ])
    })

    it('agrees with the settings label map in both directions', () => {
      const labelled_fields = Object.values(scoring_field_labels).flatMap(
        (section) => Object.entries(section)
      )

      for (const [field, label] of labelled_fields) {
        const entry = scoring_registry.find((entry) => entry.column === field)
        expect(entry, `${field} is labelled but not in the registry`).to.exist
        expect(entry.label, `label for ${field}`).to.equal(label)
      }

      const labelled_field_names = labelled_fields.map(([field]) => field)
      const unlabelled = scoring_columns
        .filter((entry) => !labelled_field_names.includes(entry.column))
        .map((entry) => entry.column)

      expect(unlabelled, `registry columns with no label: ${unlabelled}`).to.be
        .empty
    })

    it('files every labelled column under the section the label map uses', () => {
      for (const [section, fields] of Object.entries(scoring_field_labels)) {
        for (const field of Object.keys(fields)) {
          const entry = scoring_registry.find((entry) => entry.column === field)
          expect(entry.section, `section for ${field}`).to.equal(section)
        }
      }
    })
  })

  describe('registry shape', function () {
    it('names no column twice', () => {
      expect(new Set(scoring_column_names).size).to.equal(
        scoring_column_names.length
      )
    })

    it('names no stat twice', () => {
      const stat_names = scoring_registry
        .filter((entry) => entry.stat)
        .map((entry) => entry.stat)

      expect(new Set(stat_names).size).to.equal(stat_names.length)
    })

    it('gives every entry a known group and at least one of stat or column', () => {
      for (const entry of scoring_registry) {
        expect(
          ['base', 'kicking', 'dst'],
          `group for ${JSON.stringify(entry)}`
        ).to.include(entry.group)
        expect(
          Boolean(entry.stat || entry.column),
          `entry with neither stat nor column: ${JSON.stringify(entry)}`
        ).to.equal(true)
      }
    })

    it('points every positional reception override at a real stat', () => {
      const overrides = scoring_registry.filter((entry) => entry.overrides_stat)

      expect(overrides).to.have.length(3)
      for (const entry of overrides) {
        expect(
          stat_names_for_group(entry.group),
          `${entry.column} overrides ${entry.overrides_stat}`
        ).to.include(entry.overrides_stat)
      }
    })
  })
})
