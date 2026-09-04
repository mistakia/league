// Navigation for the Betting Markets tab: how the player's markets are keyed,
// labelled and grouped so that any one of them can be REACHED. Not how they are
// displayed once reached.
//
// The problem it solves is volume. The tab keyed every market carrying no
// market_type by `${source_id}_${source_market_name}`, which is one entry per
// distinct market name per book, and offered the result as a flat list of raw
// enum strings under Season / Game / Other. Measured over the deduplicated
// payload:
//
//   WITH per_player AS (
//     SELECT s.selection_pid,
//       count(DISTINCT m.market_type) FILTER (WHERE m.market_type IS NOT NULL) AS typed,
//       count(DISTINCT (m.source_id, m.source_market_name)) FILTER (WHERE m.market_type IS NULL) AS untyped_now,
//       count(DISTINCT m.source_id) FILTER (WHERE m.market_type IS NULL) AS untyped_after
//     FROM prop_markets_index m
//     JOIN prop_market_selections_index s
//       ON m.source_id=s.source_id AND m.source_market_id=s.source_market_id
//      AND m.time_type=s.time_type
//     WHERE s.selection_pid IS NOT NULL GROUP BY 1)
//   SELECT max(typed + untyped_now), max(typed + untyped_after),
//          avg(typed + untyped_now), avg(typed + untyped_after) FROM per_player;
//
// Worst player 570 entries against 73; average 52.7 against 10.3. The untyped
// tail is the whole problem -- 523 of that worst player's 570.
//
// LABELS AND GROUPS ARE DERIVED FROM THE market_type STRING, deliberately, and
// not read from the market-type taxonomy. That taxonomy is under active
// normalisation and its membership moves; a derivation that falls back to
// "Other" for a shape it does not recognise keeps working across a rename, where
// a snapshot of its membership would silently stop grouping whatever moved.

const UNTYPED_KEY_PREFIX = 'UNTYPED:'

const title_case = (word) =>
  word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()

// Market types whose derived label reads badly enough to be worth naming. Kept
// deliberately short: an override table is a maintenance surface, and the rule
// below handles the other ~130 types without one.
const market_type_label_overrides = {
  ANYTIME_TOUCHDOWN: 'Anytime TD',
  GAME_TWO_PLUS_TOUCHDOWNS: '2+ TDs',
  GAME_PASSING_RUSHING_YARDS: 'Pass + Rush Yds',
  GAME_RUSHING_RECEIVING_YARDS: 'Rush + Rec Yds',
  GAME_ALT_PASSING_RUSHING_YARDS: 'Alt Pass + Rush Yds',
  GAME_ALT_RUSHING_RECEIVING_YARDS: 'Alt Rush + Rec Yds',
  GAME_PASSING_LONGEST_COMPLETION: 'Longest Completion'
}

// Applied after the prefix strip, longest key first so PASSING_TOUCHDOWNS does
// not become "Passing Touchdowns" through the TOUCHDOWNS entry alone.
const word_labels = {
  TOUCHDOWNS: 'TDs',
  INTERCEPTIONS: 'Ints',
  COMPLETIONS: 'Comp',
  ATTEMPTS: 'Att',
  RECEPTIONS: 'Rec',
  RECEIVING: 'Rec',
  PASSING: 'Pass',
  RUSHING: 'Rush',
  DEFENSE: 'Def',
  YARDS: 'Yds',
  TARGETS: 'Tgts',
  SACKS: 'Sacks',
  MADE: 'Made',
  ALT: 'Alt',
  FIELD: 'FG',
  GOALS: ''
}

const period_prefixes = [
  { match: /^SEASON_/, period: 'Season' },
  { match: /^GAME_FIRST_QUARTER_/, period: 'First Quarter' },
  { match: /^GAME_FIRST_HALF_/, period: 'First Half' },
  { match: /^GAME_/, period: 'Game' }
]

const stat_families = [
  { match: /PASSING_RUSHING|RUSHING_RECEIVING/, family: 'Combined' },
  { match: /PASSING/, family: 'Passing' },
  { match: /RUSHING/, family: 'Rushing' },
  { match: /RECEIVING|RECEPTIONS|TARGETS/, family: 'Receiving' },
  { match: /TOUCHDOWN/, family: 'Touchdowns' },
  { match: /FIELD_GOALS|KICKING/, family: 'Kicking' },
  { match: /DEFENSE|SACKS|TACKLES/, family: 'Defense' }
]

/**
 * Navigation key for a market carrying no market_type
 * @param {string} source_id - Bookmaker identifier
 * @returns {string} Key that cannot collide with a market_type
 */
export const build_untyped_market_key = (source_id) =>
  `${UNTYPED_KEY_PREFIX}${source_id}`

/**
 * Whether a navigation key stands for a book's untyped markets
 * @param {string} market_key - Navigation key
 * @returns {boolean} True for an untyped bucket
 */
export const is_untyped_market_key = (market_key) =>
  market_key.startsWith(UNTYPED_KEY_PREFIX)

/**
 * Short display label for a navigation key
 * @param {string} market_key - A market_type, or an untyped bucket key
 * @returns {string} Label for the option list
 */
export const build_market_label = (market_key) => {
  if (is_untyped_market_key(market_key)) {
    const source_id = market_key.slice(UNTYPED_KEY_PREFIX.length)
    return `${title_case(source_id)} — uncategorized`
  }

  if (market_type_label_overrides[market_key]) {
    return market_type_label_overrides[market_key]
  }

  const period = period_prefixes.find((entry) => entry.match.test(market_key))
  const remainder = period ? market_key.replace(period.match, '') : market_key

  const words = remainder
    .split('_')
    .map((word) => (word in word_labels ? word_labels[word] : title_case(word)))
    .filter(Boolean)

  // A period that is not the plain per-game one is worth carrying into the
  // label, since two options otherwise read identically in different groups.
  const prefix =
    period && period.period !== 'Game' && period.period !== 'Season'
      ? `${period.period} `
      : ''

  return `${prefix}${words.join(' ')}`.trim()
}

/**
 * Group heading for a navigation key
 * @param {string} market_key - A market_type, or an untyped bucket key
 * @returns {string} Heading the option sits under
 */
export const build_market_group = (market_key) => {
  if (is_untyped_market_key(market_key)) return 'Uncategorized'

  const period = period_prefixes.find((entry) => entry.match.test(market_key))
  const family = stat_families.find((entry) => entry.match.test(market_key))

  if (!period && !family) return 'Other'
  return `${period ? period.period : 'Other'} · ${family ? family.family : 'Other'}`
}

// Groups in reading order: the per-game markets a user reaches for most, then
// the in-game periods, then season-long, then the tail. Anything unrecognised
// sorts last rather than being dropped.
const group_rank = (group) => {
  if (group.startsWith('Game')) return 0
  if (group.startsWith('First Quarter')) return 1
  if (group.startsWith('First Half')) return 2
  if (group.startsWith('Season')) return 3
  if (group === 'Uncategorized') return 5
  return 4
}

/**
 * Ordered navigation options for the tab's market selector
 *
 * Sorting happens here rather than in the component because MUI's Autocomplete
 * groups CONSECUTIVE options only -- an unsorted list renders the same heading
 * several times, which reads as duplicate groups rather than as a sort bug.
 *
 * @param {string[]} market_keys - Keys of the grouped market map
 * @returns {object[]} { key, label, group }, ordered for display
 */
export const build_market_navigation = (market_keys) =>
  market_keys
    .map((key) => ({
      key,
      label: build_market_label(key),
      group: build_market_group(key)
    }))
    .sort(
      (a, b) =>
        group_rank(a.group) - group_rank(b.group) ||
        a.group.localeCompare(b.group) ||
        a.label.localeCompare(b.label)
    )
