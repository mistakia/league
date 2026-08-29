// Week 0 is not a week. It was a SENTINEL meaning "the whole season", sharing a
// column with real week numbers, and it is falsy -- so it broke every
// `if (week)` and `week || default` guard it reached.
//
// The incident: player-betting-market-column-definitions gated its nfl_games
// join on `if (week || career_year.length)`. A season-grain column resolved
// week 0, the gate read false, and the column went season-wide. That was the
// intended reading. But a GAME-grain column with no resolvable week resolved 0
// too, and read identically -- so six player game-prop columns were season-wide
// under a week-scoped label for their whole lives. Then clamping the producer
// to 1 flipped the same expression the other way and inner-joined away every
// player without a preseason week-1 game. One expression, three behaviours,
// none of them named.
//
// The rule now is that a week param holds a real week or nothing, and grain is
// carried by the column's own declaration. This rule is the ratchet on that.
//
// DELIBERATELY NARROW, by path. `week === 0` legitimately means the offseason
// in get-roster.mjs, context-docs/rosters.mjs and is-reserve-eligible.mjs, and
// it legitimately means the preseason opener in the nfl_games and practice
// data. Scoping to the data-view param path is exactly what lets this be an
// error with no baseline file -- a repo-wide version would be a list of
// exceptions, which is a different and much weaker thing.

import path from 'node:path'

const RULE_ID = 'no-week-zero-sentinel'

// Where a `week` value is a data-view PARAM rather than a stored row value.
const SCOPED_PATH_FRAGMENTS = [
  path.join('libs-server', 'data-views-column-definitions'),
  path.join('libs-server', 'data-views'),
  path.join('libs-server', 'get-data-view-results.mjs')
]

// The ONE file still holding the sentinel, exempted by name rather than by a
// baseline file so the exemption has an owner and an end date.
//
// THE OWNER CHANGED, and the old rationale here was wrong in a way worth
// stating: it said projections_index was the last table where week 0 means the
// season-long aggregate, and that this rule's exemption would fall when
// user:task/league/retire-week-zero-season-slot-from-projections.md landed. That
// task HAS landed -- projections_index carries CHECK (week >= 1) and season rows
// live in season_projections_index -- and the two `params.week || 0` sites
// survived it, because they were never about that table.
//
// What they are about is league_player_projection_values, whose season prefix
// still resolves through the week param. The successor owner is
// user:task/league/pin-season-projected-period-to-season-key.md. Note the fix is
// NOT a throw: one was built, proved and then CUT on evidence, because
// check-data-view-sql-validity EXPLAINs every column with empty params and a
// bare API request reaches the same shape. It belongs to source-attach
// resolution -- declare grain `player_year_week` and refuse at the request
// boundary beside ColumnRowGrainMismatch -- as the comment at the `:230` site
// records.
//
// Delete this exemption when THAT task lands. It is still the only thing
// standing between this rule and zero.
const PENDING_STORAGE_MIGRATION_FILE = path.join(
  'libs-server',
  'data-views-column-definitions',
  'player-projected-column-definitions.mjs'
)

const WEEK_IDENTIFIERS = new Set([
  'week',
  'min_week',
  'max_week',
  'default_week'
])

const is_zero_literal = (node) =>
  node && node.type === 'Literal' && node.value === 0

// A `week`-ish name in VALUE position: a bare identifier, or a `.week` member
// access. Anchored on the syntactic role rather than on the token appearing
// anywhere in the line.
const is_week_expression = (node) => {
  if (!node) return false
  if (node.type === 'Identifier') return WEEK_IDENTIFIERS.has(node.name)
  if (node.type === 'MemberExpression' && !node.computed) {
    return (
      node.property.type === 'Identifier' &&
      WEEK_IDENTIFIERS.has(node.property.name)
    )
  }
  return false
}

const rule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'ban week 0 as a season-long sentinel on the data-view param path'
    },
    schema: [],
    messages: {
      fallback:
        'A week param holds a real week or nothing. `week || 0` reintroduces the season-long sentinel, which is falsy and silently disables every week-scoped join gate downstream. Use null and let the column declare its grain.',
      assignment:
        'Assigning 0 to a week reintroduces the season-long sentinel. A week-grain column with no resolvable week is an error, not a default of 0.',
      comparison:
        'Comparing a week to 0 tests for the retired season-long sentinel. Test the grain the column declares instead.',
      clamp:
        'Clamping a week to a floor of 0 can produce the retired season-long sentinel. The floor is 1 -- see MIN_WEEK in libs-shared/week-dynamic-values.mjs.'
    }
  },
  create(context) {
    const filename = context.filename ?? context.getFilename()
    if (filename.includes(PENDING_STORAGE_MIGRATION_FILE)) return {}

    const in_scope = SCOPED_PATH_FRAGMENTS.some((fragment) =>
      filename.includes(fragment)
    )
    if (!in_scope) return {}

    return {
      // `week || 0` and `week ?? 0`
      LogicalExpression(node) {
        if (node.operator !== '||' && node.operator !== '??') return
        if (!is_week_expression(node.left)) return
        if (!is_zero_literal(node.right)) return
        context.report({ node, messageId: 'fallback' })
      },

      // `week = 0`
      AssignmentExpression(node) {
        if (node.operator !== '=') return
        if (!is_week_expression(node.left)) return
        if (!is_zero_literal(node.right)) return
        context.report({ node, messageId: 'assignment' })
      },

      // `const min_week = 0`
      VariableDeclarator(node) {
        if (!is_week_expression(node.id)) return
        if (!is_zero_literal(node.init)) return
        context.report({ node, messageId: 'assignment' })
      },

      // `week === 0`, `week !== 0`, `week == 0`
      BinaryExpression(node) {
        const is_equality = ['===', '==', '!==', '!='].includes(node.operator)
        if (!is_equality) return
        if (is_week_expression(node.left) && is_zero_literal(node.right)) {
          context.report({ node, messageId: 'comparison' })
        } else if (
          is_zero_literal(node.left) &&
          is_week_expression(node.right)
        ) {
          context.report({ node, messageId: 'comparison' })
        }
      },

      // `Math.max(week, 0)` in either argument order
      CallExpression(node) {
        const callee = node.callee
        if (callee.type !== 'MemberExpression' || callee.computed) return
        if (callee.object.type !== 'Identifier') return
        if (callee.object.name !== 'Math') return
        if (callee.property.type !== 'Identifier') return
        if (callee.property.name !== 'max') return
        if (node.arguments.length !== 2) return

        const [first, second] = node.arguments
        if (
          (is_week_expression(first) && is_zero_literal(second)) ||
          (is_zero_literal(first) && is_week_expression(second))
        ) {
          context.report({ node, messageId: 'clamp' })
        }
      }
    }
  }
}

export default {
  rules: {
    [RULE_ID]: rule
  }
}

export { RULE_ID }
