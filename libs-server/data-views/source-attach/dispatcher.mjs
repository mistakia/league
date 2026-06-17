import debug from 'debug'
import { apply_bridge } from '../identity-bridge-registry.mjs'
import { resolve as resolve_rule } from './source-attach-registry.mjs'
import './rules/index.mjs'

const log = debug('data-views:source-attach')

const resolve_mode = (params = {}) => {
  const raw = Array.isArray(params.matchup_opponent_type)
    ? params.matchup_opponent_type[0] &&
      typeof params.matchup_opponent_type[0] === 'object'
      ? null
      : params.matchup_opponent_type[0]
    : params.matchup_opponent_type
  switch (raw) {
    case 'current_week_opponent_total':
      return 'matchup_opponent_current_week'
    case 'next_week_opponent_total':
      return 'matchup_opponent_next_week'
    default:
      return 'default'
  }
}

export const attach_source = ({
  players_query,
  query_context,
  column_def,
  params = {},
  table_alias,
  join_type = 'LEFT',
  splits = []
}) => {
  const { source } = column_def
  if (!source || (!source.table && !source.attach)) {
    throw new Error(
      `attach_source called without source.table/source.attach (column_id=${column_def.column_id})`
    )
  }

  const cell_identity = query_context.identity_id
  const mode = resolve_mode(params)

  // Rules need from-table-aware references: the joined source attaches to
  // whatever's actually in the FROM clause. query_context's defaults are
  // identity-aware and reference identity CTEs (player_years, team_years)
  // which aren't joined when from_table is a fact table. Identity-bridges
  // still read the identity-aware values directly from query_context.
  const dv = query_context.data_view_options || {}
  const rule_ctx = {
    ...query_context,
    pid_reference: dv.pid_reference ?? query_context.pid_reference,
    team_reference: dv.team_reference ?? query_context.team_reference,
    year_reference: dv.year_reference ?? query_context.year_reference,
    week_reference: dv.week_reference ?? query_context.week_reference
  }

  let rule = resolve_rule(cell_identity, source.grain, mode)
  if (!rule && mode !== 'default') {
    log(
      `source-attach miss for column_id=${column_def.column_id} mode=${mode} (cell=${cell_identity}, source=${source.grain}); falling back to default`
    )
    rule = resolve_rule(cell_identity, source.grain, 'default')
  }
  if (!rule) {
    const msg = `No source-attach rule for (cell=${cell_identity}, source=${source.grain}, mode=${mode}); column_id=${column_def.column_id}`
    log(msg)
    throw new Error(msg)
  }

  // Enforce structural requirements per source grain before the rule fires.
  // team_year sources that use a standard source.table join must declare
  // key_columns.team so the emit_predicate can reference the team column; a
  // missing declaration produces a silent mismatch at runtime that is hard to
  // diagnose from the resulting SQL. Sources that supply a custom `attach`
  // function manage their own join logic and are exempt.
  if (
    source.table &&
    !source.attach &&
    source.grain === 'team_year' &&
    !(source.key_columns && source.key_columns.team)
  ) {
    throw new Error(
      `column ${column_def.column_id} declared team_year grain without key_columns.team` +
        ` (source.table=${source.table})`
    )
  }

  const required =
    typeof rule.required_identity_bridges === 'function'
      ? rule.required_identity_bridges(params) || []
      : rule.required_identity_bridges || []
  for (const b of required) {
    apply_bridge({
      query_context,
      from: b.from,
      to: b.to,
      mode: b.mode || 'default',
      params,
      source
    })
  }

  // A source may declare `table` purely so select-string's correlated-aggregate
  // (year_offset range) path can re-scan a real relation, while still owning its
  // entire join via a custom `attach` (e.g. projections, whose join correlates a
  // week dimension and week-splits the bridge emit_predicate cannot express).
  // Such a source sets `attach_owns_join` so the dispatcher does NOT also emit a
  // primary join here -- otherwise the same alias is joined twice ("table name
  // specified more than once"). Sources where `attach` only adds secondary joins
  // (e.g. pff_player_source's career_year filter) leave the flag unset.
  if (source.table && !source.attach_owns_join) {
    const join_method = join_type === 'INNER' ? 'innerJoin' : 'leftJoin'
    const target =
      table_alias && table_alias !== source.table
        ? `${source.table} as ${table_alias}`
        : source.table
    const extras =
      typeof source.extra_predicates === 'function'
        ? source.extra_predicates(params) || []
        : []
    const { db } = query_context

    const qualify = (col) =>
      col.includes('.') ? col : `${table_alias || source.table}.${col}`

    players_query[join_method](target, function () {
      rule.emit_predicate({
        query_context: rule_ctx,
        source,
        table_alias,
        params,
        builder: this
      })
      for (const p of extras) {
        const op = p.op || '='
        const col = qualify(p.column)
        if (op === '=') {
          this.andOn(col, '=', db.raw('?', [p.value]))
        } else if (op === 'in') {
          this.andOnIn(col, p.value)
        } else if (op === 'between') {
          this.andOnBetween(col, p.value)
        } else {
          throw new Error(
            `Unknown source.extra_predicates op: ${op} (column_id=${column_def.column_id})`
          )
        }
      }
    })
  }

  // attach runs AFTER the primary leftJoin so secondary joins/WHEREs that
  // reference the primary alias resolve in the SQL's left-to-right order.
  // Splits is forwarded so CTE-backed attaches know which predicates the
  // with: callback actually projected onto the joined CTE.
  //
  // Pass raw query_context (not rule_ctx) so source.attach observes any
  // mutations emit_predicate made above -- rule_ctx is a snapshot via spread,
  // not a live view, and attaches like game-column-definitions branch on
  // late-registered fields (e.g. player_year_teams_cte_name). Attach helpers
  // that need FROM-table-aware references use the dv.X ?? query_context.X
  // fallback pattern locally.
  if (typeof source.attach === 'function') {
    source.attach({
      query_context,
      params,
      table_alias,
      join_type,
      splits
    })
  }
}
