// `Math.max(current_season.week, 1)` is a NAMED concept written out longhand:
// the week fantasy operations target, never the season-long 0 slot. It appeared
// 20 times across 19 files before the sweep that introduced
// `current_season.active_fantasy_week`, and having no name is what let the rule
// rot -- it could not be stated, taught, or enforced.
//
// The failure that name prevents is not cosmetic. `get_player_projections`
// floored the NFL week rather than the fantasy week, amputated every week-0 row,
// and zeroed `market_salary` on 22 of 23 league formats. The convention was
// already documented in prose at the time; prose did not hold it.
//
// This rule is BASELINE-FREE, deliberately. The sweep went to zero, so the
// honest enforcement is zero, and a baseline file would be a second thing to
// maintain and to ratchet down. It covers private/ for the same reason
// no-bare-debug-enable does: a stateless rule over an unchecked-out submodule
// reports nothing rather than failing over files it cannot see.
//
// SHAPES FLAGGED -- the three spellings of the same floor:
//
//   Math.max(current_season.week, 1)   and the reversed argument order
//   current_season.week || 1
//   current_season.week ?? 1
//
// NOT flagged, because they are different concepts rather than this one written
// out:
//
//   Math.max(current_season.week - 1, 0)   the PRIOR week
//   Math.max(current_season.nfl_seas_week, 1)   the NFL week, which must never
//     be floored into a fantasy week -- that IS the projections defect above,
//     and it is a wrong value rather than an unnamed right one
//   Math.max(row.week, 1)   any object that is not `current_season`
//
// The rule anchors on `current_season` as the receiver by name. An aliased
// import defeats it. That is accepted: this is a ratchet against re-growth of a
// sweep, not a proof of absence.

const RULE_ID = 'no-week-reconstruction'

const SEASON_OBJECT = 'current_season'
const GETTER = 'active_fantasy_week'

// `current_season.week` in value position -- the receiver named, the property
// `week` specifically, and not a computed access whose key we cannot read.
const is_current_season_week = (node) =>
  node &&
  node.type === 'MemberExpression' &&
  !node.computed &&
  node.object.type === 'Identifier' &&
  node.object.name === SEASON_OBJECT &&
  node.property.type === 'Identifier' &&
  node.property.name === 'week'

const is_literal_one = (node) =>
  node && node.type === 'Literal' && node.value === 1

const is_math_max = (node) =>
  node.callee.type === 'MemberExpression' &&
  !node.callee.computed &&
  node.callee.object.type === 'Identifier' &&
  node.callee.object.name === 'Math' &&
  node.callee.property.type === 'Identifier' &&
  node.callee.property.name === 'max'

const rule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'ban re-deriving the clamped current fantasy week in favour of current_season.active_fantasy_week'
    },
    fixable: 'code',
    schema: [],
    messages: {
      reconstruction: `This re-derives ${SEASON_OBJECT}.${GETTER} without naming it. Use ${SEASON_OBJECT}.${GETTER}, which is the week fantasy operations target and is never the season-long 0 slot.`
    }
  },
  create(context) {
    const report = (node) =>
      context.report({
        node,
        messageId: 'reconstruction',
        fix: (fixer) => fixer.replaceText(node, `${SEASON_OBJECT}.${GETTER}`)
      })

    return {
      CallExpression(node) {
        if (!is_math_max(node)) return
        if (node.arguments.length !== 2) return

        const [first, second] = node.arguments
        if (is_current_season_week(first) && is_literal_one(second)) {
          report(node)
        } else if (is_literal_one(first) && is_current_season_week(second)) {
          report(node)
        }
      },

      LogicalExpression(node) {
        if (node.operator !== '||' && node.operator !== '??') return
        if (!is_current_season_week(node.left)) return
        if (!is_literal_one(node.right)) return

        // `a || 1` inside a wider chain -- `x || current_season.week || 1` --
        // has a left operand that is not the member expression, so it does not
        // reach here. Only the two-operand form is the reconstruction.
        report(node)
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
