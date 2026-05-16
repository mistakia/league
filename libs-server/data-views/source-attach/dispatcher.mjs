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
  join_type = 'LEFT'
}) => {
  const { source } = column_def
  if (!source || (!source.table && !source.attach)) {
    throw new Error(
      `attach_source called without source.table/source.attach (column_id=${column_def.column_id})`
    )
  }

  const cell_identity = query_context.identity_id
  const mode = resolve_mode(params)
  let rule = resolve_rule(cell_identity, source.grain, mode)
  if (!rule && mode !== 'default') {
    log(
      `source-attach miss for column_id=${column_def.column_id} mode=${mode} (cell=${cell_identity}, source=${source.grain}); falling back to default`
    )
    rule = resolve_rule(cell_identity, source.grain, 'default')
  }
  if (!rule) {
    throw new Error(
      `No source-attach rule for (cell=${cell_identity}, source=${source.grain}, mode=${mode}); column_id=${column_def.column_id}`
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
      params
    })
  }

  if (typeof source.attach === 'function') {
    source.attach(query_context, params)
  }

  if (!source.table) return

  const join_method = join_type === 'INNER' ? 'innerJoin' : 'leftJoin'
  const target = table_alias ? `${source.table} as ${table_alias}` : source.table
  const extras =
    typeof source.extra_predicates === 'function'
      ? source.extra_predicates(params) || []
      : []
  const { db } = query_context

  players_query[join_method](target, function () {
    rule.emit_predicate({
      query_context,
      source,
      table_alias,
      params,
      builder: this
    })
    for (const p of extras) {
      const op = p.op || '='
      if (op === '=') {
        this.andOn(p.column, '=', db.raw('?', [p.value]))
      } else if (op === 'in') {
        this.andOnIn(p.column, p.value)
      } else if (op === 'between') {
        this.andOnBetween(p.column, p.value)
      } else {
        throw new Error(
          `Unknown source.extra_predicates op: ${op} (column_id=${column_def.column_id})`
        )
      }
    }
  })
}
