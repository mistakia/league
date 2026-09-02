/* global describe it */

// Structural enforcement for the physical-vs-vocabulary column split.
//
// The data-view row-axis vocabulary is 'year' / 'seas_type'; the conformed
// physical columns are 'season_year' / 'season_type'. apply_scope_to_query
// resolves between them by table name through physical-season-columns, so the map
// IS the mechanism -- and a map that silently falls out of step with the schema
// puts the pre-rename names back into generated SQL. That is not hypothetical:
// build_role_union_period_cte emitted nfl_plays.year against the renamed table, a
// 42703 on every data view carrying a rate type, and eight regenerated
// query-match goldens blessed it, because a golden regenerated from buggy code
// agrees with the buggy code.
//
// Two directions, both derived rather than hand-listed:
//
//   1. Every table registered in the map really carries the column the map claims,
//      read from db/schema.postgres.sql.
//   2. Every table an apply_scope_to_query call site names by literal, found by
//      scanning libs-server, is registered if it carries season_year.
//
// Direction 2 is the one that prevents the next 791c2393, and it has to be
// derived to mean anything. An earlier version of this spec checked it against a
// hand-maintained array of target tables, which enforced nothing: a cluster that
// conformed a table and added it to neither the array nor the map passed green.
// Both directions are negative-controlled -- adding an emitter that targets an
// unregistered season_year table, or a new dynamic call site, each fail this spec.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import * as chai from 'chai'

import {
  physical_year_column,
  physical_seas_type_column,
  physical_year_projection,
  physical_year_projection_unqualified,
  physical_seas_type_projection_unqualified,
  physical_year_group_by,
  physical_table_names,
  tables_without_seas_type,
  tables_with_nfl_week_id
} from '#libs-server/data-views/physical-season-columns.mjs'
import { FACT_SOURCES } from '#libs-server/data-views/measure/fact-source-registry.mjs'

const { expect } = chai
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const schema_path = path.resolve(__dirname, '../db/schema.postgres.sql')
const schema_sql = fs.readFileSync(schema_path, 'utf8')

// Column list for a CREATE TABLE body, keyed by unqualified table name. Only the
// top-level definition is read; partitions repeat the parent's shape.
const table_columns = (table_name) => {
  const start = schema_sql.indexOf(`CREATE TABLE public.${table_name} (`)
  if (start === -1) return null
  const end = schema_sql.indexOf('\n);', start)
  const body = schema_sql.slice(start, end)
  const columns = new Set()
  for (const line of body.split('\n').slice(1)) {
    const match = /^\s{4}("?)([a-z_][a-z0-9_]*)\1\s/.exec(line)
    if (match) columns.add(match[2])
  }
  return columns
}

// The tables an apply_scope_to_query call site targets are DERIVED FROM SOURCE,
// not listed by hand. A hand-maintained list cannot enforce map completeness: a
// cluster that conforms a table and registers it in neither the list nor the map
// passes green, which is the original 791c2393 failure mode surviving the guard
// built to stop it. Scanning the call sites means adding an emitter automatically
// enters it into the check.
//
// Note the criterion is "an emitter targets this table", NOT "this table carries
// season_year". 70 base tables carry season_year and only the handful an
// apply_scope_to_query call site names belong in the map; historical_injury_index
// carries it and is correctly absent, because it is writer-only and no emitter
// targets it.
const scan_apply_scope_call_sites = () => {
  const literal_tables = new Set()
  const dynamic_sites = []

  const walk = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const full = path.join(directory, entry.name)
      if (entry.isDirectory()) walk(full)
      else if (entry.name.endsWith('.mjs')) scan_file(full)
    }
  }

  const scan_file = (file) => {
    const text = fs.readFileSync(file, 'utf8')
    // The helper's own definition and default export are not call sites.
    if (file.endsWith('apply-scope-to-query.mjs')) return
    const call = /apply_scope_to_query\(\{/g
    let match
    while ((match = call.exec(text))) {
      const window = text.slice(match.index, match.index + 600)
      const literal = /\n\s*table_name:\s*'([a-z0-9_]+)'/.exec(window)
      if (literal) {
        literal_tables.add(literal[1])
        continue
      }
      const dynamic = /\n\s*table_name(?::\s*([A-Za-z0-9_.]+))?\s*,/.exec(
        window
      )
      if (dynamic) {
        dynamic_sites.push({
          file: path.basename(file),
          expression: dynamic[1] || 'table_name'
        })
      }
    }
  }

  walk(path.resolve(__dirname, '../libs-server'))
  return { literal_tables: [...literal_tables].sort(), dynamic_sites }
}

// Call sites that pass a variable rather than a literal cannot be resolved
// statically, so they are reviewed once and pinned here. A NEW dynamic call site
// fails this list and forces the same review rather than slipping through.
//
// Both entries resolve at runtime to tables already in the map (the plays family
// and nfl_games) or to a hash-named CTE alias, for which the map's fallback to
// the vocabulary names is the correct answer. Their real safety net is
// db/gates/check-data-view-sql-validity.mjs, which EXPLAINs the emitted SQL and
// so catches a wrong column name whatever the table turns out to be.
const REVIEWED_DYNAMIC_CALL_SITES = [
  {
    file: 'apply-play-by-play-column-params-to-query.mjs',
    expression: 'table_name'
  },
  { file: 'build-period-cte.mjs', expression: 'scope_table_name' }
]

// Every relation the period-CTE builder can scan, taken from the fact-source
// registry rather than listed here. That builder resolves its scope columns
// through this map by variable, so the reviewed-call-site check above cannot see
// which table it lands on -- this is what makes the dynamic site safe. A cohort
// source is reached under an ALIAS, so the map is consulted for the physical
// table behind it.
const fact_source_relations = () => {
  const relations = new Set()
  for (const source of Object.values(FACT_SOURCES)) {
    relations.add(source.table)
    if (source.cohort_expansion) relations.add(source.cohort_expansion.table)
  }
  return [...relations].sort()
}

describe('physical season columns', () => {
  describe('the map agrees with db/schema.postgres.sql', () => {
    for (const table_name of physical_table_names()) {
      it(`${table_name} really carries ${physical_year_column(table_name)}`, () => {
        const columns = table_columns(table_name)
        expect(
          columns,
          `${table_name} is missing from the schema`
        ).to.not.equal(null)
        expect(columns.has(physical_year_column(table_name))).to.equal(true)
      })
    }

    for (const table_name of physical_table_names()) {
      if (tables_without_seas_type().has(table_name)) continue
      it(`${table_name} really carries ${physical_seas_type_column(table_name)}`, () => {
        expect(
          table_columns(table_name).has(physical_seas_type_column(table_name))
        ).to.equal(true)
      })
    }
  })

  // The scope emitter asks the map which components a table can carry before it
  // emits them, so a table wrongly listed here emits a 42703 and one wrongly
  // omitted loses the predicate that prunes it. Both directions read from the
  // schema.
  describe('the nfl_week_id declaration agrees with the schema', () => {
    for (const table_name of tables_with_nfl_week_id()) {
      it(`${table_name} really carries nfl_week_id`, () => {
        expect(table_columns(table_name).has('nfl_week_id')).to.equal(true)
      })
    }

    for (const table_name of physical_table_names()) {
      if (tables_with_nfl_week_id().has(table_name)) continue
      it(`${table_name} really has no nfl_week_id`, () => {
        expect(table_columns(table_name).has('nfl_week_id')).to.equal(false)
      })
    }
  })

  // The period-CTE builder reaches this map by variable, so nothing static can
  // tell which table it lands on. This is that guard: a fact source whose table
  // is unregistered would emit the vocabulary `year` against a conformed table.
  describe('every fact-source relation is registered', () => {
    for (const table_name of fact_source_relations()) {
      it(`${table_name} resolves to a real season-year column`, () => {
        const columns = table_columns(table_name)
        expect(
          columns,
          `${table_name} is missing from the schema`
        ).to.not.equal(null)
        expect(
          columns.has(physical_year_column(table_name)),
          `a fact source scans ${table_name}, which resolves to ${physical_year_column(table_name)} -- register it in physical-season-columns`
        ).to.equal(true)
      })
    }
  })

  describe('tables declared to have no season type really have none', () => {
    for (const table_name of tables_without_seas_type()) {
      it(`${table_name} has neither season_type nor seas_type`, () => {
        const columns = table_columns(table_name)
        expect(
          columns,
          `${table_name} is missing from the schema`
        ).to.not.equal(null)
        expect(columns.has('season_type')).to.equal(false)
        expect(columns.has('seas_type')).to.equal(false)
      })
    }

    it('throws rather than falling back when asked for their seas_type column', () => {
      for (const table_name of tables_without_seas_type()) {
        expect(() => physical_seas_type_column(table_name)).to.throw(
          /has no season-type column/
        )
      }
    })
  })

  // The direction that actually prevents the next 791c2393: a table conformed to
  // season_year but never registered resolves to the vocabulary 'year' and emits
  // a 42703 that no golden can catch.
  describe('map completeness', () => {
    const { literal_tables, dynamic_sites } = scan_apply_scope_call_sites()

    it('finds the call sites at all', () => {
      // Guards the scanner itself. A regex that silently stops matching would
      // make every assertion below vacuously pass, which is the failure mode
      // this whole describe block exists to prevent.
      expect(literal_tables.length).to.be.greaterThan(0)
      expect(dynamic_sites.length).to.be.greaterThan(0)
    })

    it('every table an emitter names by literal is registered', () => {
      for (const table_name of literal_tables) {
        const columns = table_columns(table_name)
        expect(
          columns,
          `apply_scope_to_query targets ${table_name}, which is not in the schema`
        ).to.not.equal(null)
        if (!columns.has('season_year')) continue
        expect(
          physical_year_column(table_name),
          `${table_name} is targeted by an apply_scope_to_query call site and carries season_year, but is not registered in physical-season-columns -- it will emit the vocabulary name and 42703`
        ).to.equal('season_year')
      }
    })

    it('every dynamic call site has been reviewed', () => {
      const seen = dynamic_sites
        .map(({ file, expression }) => `${file}:${expression}`)
        .sort()
      const reviewed = REVIEWED_DYNAMIC_CALL_SITES.map(
        ({ file, expression }) => `${file}:${expression}`
      ).sort()
      expect(
        seen,
        'an apply_scope_to_query call site passes a table_name this spec cannot resolve statically; review what it resolves to and add it to REVIEWED_DYNAMIC_CALL_SITES'
      ).to.deep.equal(reviewed)
    })

    it('every registered table resolves away from the vocabulary default', () => {
      for (const table_name of physical_table_names()) {
        expect(physical_year_column(table_name)).to.not.equal('year')
      }
    })

    it('an unregistered name still falls back to the vocabulary column', () => {
      // CTE aliases are hash-named and alias year/seas_type back, so the fallback
      // is load-bearing and must not become an error.
      expect(
        physical_year_column('t22c9a76f62c8a62fec52ad076663a982')
      ).to.equal('year')
      expect(
        physical_seas_type_column('t22c9a76f62c8a62fec52ad076663a982')
      ).to.equal('seas_type')
    })
  })

  // The PROJECTION half of the boundary. The predicate half has been derived
  // through this map since the conform; the projection half was hand-written at
  // eleven sites across eight files until they were routed through
  // physical_year_projection.
  //
  // This block is now the PRIMARY instrument for the projection class, and that
  // is a deliberate transfer rather than an accident. db/gates/
  // check-rename-alias-residue.mjs anchors on alias LITERALS, so a derived
  // projection emits nothing for it to find and it reports these sites no more.
  // What replaces it is stronger where it matters and weaker where it does not:
  // the gate's candidate set comes from a schema diff against a base ref, so it
  // only ever saw columns that moved in that window, while the scan below is
  // absolute and catches a hand-written alias for any table at any time.
  describe('the projection half is derived, not hand-written', () => {
    it('projects each registered table through its mapped physical column', () => {
      for (const table_name of physical_table_names()) {
        const column = physical_year_column(table_name)
        expect(physical_year_projection(table_name)).to.equal(
          `${table_name}.${column} as year`
        )
        expect(physical_year_group_by(table_name)).to.equal(
          `${table_name}.${column}`
        )
        expect(physical_year_projection_unqualified(table_name)).to.equal(
          `${column} as year`
        )
      }
    })

    it('projects the unqualified seas_type shape from the same map', () => {
      for (const table_name of physical_table_names()) {
        if (tables_without_seas_type().has(table_name)) continue
        expect(physical_seas_type_projection_unqualified(table_name)).to.equal(
          `${physical_seas_type_column(table_name)} as seas_type`
        )
      }
    })

    it('refuses an unqualified seas_type projection for a table with none', () => {
      // Same loud-failure contract as physical_seas_type_column: a table with no
      // season-type column must throw rather than emit 'seas_type as seas_type'
      // and 42703 at runtime.
      for (const table_name of tables_without_seas_type()) {
        expect(() =>
          physical_seas_type_projection_unqualified(table_name)
        ).to.throw()
      }
    })

    it('names the same physical column in the projection and its GROUP BY', () => {
      // Postgres rejects a statement whose GROUP BY does not name the projected
      // column, so a resolver that derived one and left the other hardcoded
      // would reintroduce the divergence this module exists to prevent.
      for (const table_name of physical_table_names()) {
        expect(physical_year_projection(table_name)).to.equal(
          `${physical_year_group_by(table_name)} as year`
        )
      }
    })

    it('refuses to project an unregistered name', () => {
      // The PREDICATE resolvers fall back for an unregistered name because
      // apply_scope_to_query is routinely handed a CTE alias and the fallback
      // is what makes an alias emit the vocabulary names. A PROJECTION exists
      // to name the physical column of a physical table, so an unregistered
      // name is a caller error: the old fallback emitted `<name>.year as year`,
      // which satisfies the schema-conformance ratchet and then throws 42703 at
      // runtime -- or resolves against a real `year` column meaning something
      // else. A misspelling and a CTE alias are indistinguishable here, so the
      // refusal covers both; a CTE that wants to re-project its aliased-back
      // column writes the literal directly.
      const alias = 't22c9a76f62c8a62fec52ad076663a982'
      expect(() => physical_year_projection(alias)).to.throw(
        /not a registered physical table/
      )
      expect(() => physical_year_projection_unqualified(alias)).to.throw(
        /not a registered physical table/
      )
      expect(() => physical_year_group_by(alias)).to.throw(
        /not a registered physical table/
      )
      expect(() => physical_seas_type_projection_unqualified(alias)).to.throw(
        /not a registered physical table/
      )
    })

    it('refuses a MISSPELLING of a registered table', () => {
      // The must-report control for the case that motivated the refusal. A
      // near-miss of a real registered name is exactly what falls through a
      // name-keyed map, and the old fallback answered it with a confident
      // `nfl_playz.year as year`.
      expect(() => physical_year_projection('nfl_playz')).to.throw(
        /not a registered physical table/
      )
      // Paired decoy: the correctly spelled neighbour must still resolve, so
      // the assertion above is detecting an unregistered NAME rather than a
      // helper that now throws on everything.
      expect(physical_year_projection('nfl_plays')).to.equal(
        'nfl_plays.season_year as year'
      )
    })

    // Direction 2 for projections, derived from source the same way the
    // apply_scope_to_query call-site scan is. A hand-written alias literal is
    // what the eleven routed sites were; this fails if one comes back.
    it('leaves no hand-written season-year alias literal under data-views', () => {
      const offenders = []
      const walk = (directory) => {
        for (const entry of fs.readdirSync(directory, {
          withFileTypes: true
        })) {
          const full = path.join(directory, entry.name)
          if (entry.isDirectory()) walk(full)
          else if (entry.name.endsWith('.mjs')) scan(full)
        }
      }
      const scan = (file) => {
        // The module that DEFINES the boundary is not a violation of it.
        if (file.endsWith('physical-season-columns.mjs')) return
        const code = fs
          .readFileSync(file, 'utf8')
          .split('\n')
          .filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line))
          .join('\n')
        if (/['"`][a-z0-9_]*\.?season_year\s+as\s+year['"`]/.test(code)) {
          offenders.push(path.relative(process.cwd(), file))
        }
      }
      walk(path.resolve(__dirname, '../libs-server/data-views'))
      expect(
        offenders,
        `these files hand-write a season-year alias instead of calling physical_year_projection: ${offenders.join(', ')}`
      ).to.deep.equal([])
    })

    it('can see the literal it is looking for', () => {
      // Negative control for the scan above. A pattern that cannot match returns
      // a confident zero, and this scan's whole value is its zero.
      const pattern = /['"`][a-z0-9_]*\.?season_year\s+as\s+year['"`]/
      expect(pattern.test(`query.select('nfl_plays.season_year as year')`)).to
        .be.true
      expect(pattern.test(`query.select('season_year as year')`)).to.be.true
      expect(
        pattern.test(`query.select(physical_year_projection('nfl_plays'))`)
      ).to.be.false
    })
  })
})
