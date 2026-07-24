// Compound identity builders for betting market records.
//
// Each builder mirrors a database unique constraint, so a caller cannot
// construct a key that silently omits a field the database considers part of
// identity. Betting sources reuse each other's id strings -- 33 source_market_id
// values are shared between DRAFTKINGS and FANATICS in production -- so every
// key here is scoped by source_id.
//
// Components are joined with a NUL character, which Postgres forbids inside
// varchar values. That makes a key unambiguous even though real ids contain the
// underscore this module previously joined on (63,599 market ids and 2,285,499
// selection ids contain one).
//
// Built keys are in-memory Map keys ONLY. Never log a key or place one in a
// signal payload: the delimiter is invisible in output, and Postgres rejects
// NUL inside jsonb on insert. Pass the raw id fields instead.

const KEY_DELIMITER = String.fromCharCode(0)

const join_key = (components) => components.join(KEY_DELIMITER)

// Book-scoped market identity. Used to group cleanup state per emitting book.
export const build_market_key = ({ source_id, source_market_id }) =>
  join_key([source_id, source_market_id])

// prop_markets_index unique index: (source_id, source_market_id, time_type)
export const build_market_index_key = ({
  source_id,
  source_market_id,
  time_type
}) => join_key([source_id, source_market_id, time_type])

// prop_markets_history unique index: (source_id, source_market_id, observed_at)
export const build_market_history_key = ({
  source_id,
  source_market_id,
  observed_at
}) => join_key([source_id, source_market_id, observed_at])

// prop_market_selections_index unique index:
// (source_id, source_market_id, source_selection_id, time_type)
export const build_selection_index_key = ({
  source_id,
  source_market_id,
  source_selection_id,
  time_type
}) => join_key([source_id, source_market_id, source_selection_id, time_type])

// prop_market_selections_history unique index:
// (source_id, source_market_id, source_selection_id, observed_at)
export const build_selection_history_key = ({
  source_id,
  source_market_id,
  source_selection_id,
  observed_at
}) => join_key([source_id, source_market_id, source_selection_id, observed_at])
