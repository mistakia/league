// Single source of truth for the adp_format dimension axes and the decode map
// from the legacy `adp_type` enum to the normalized axis tuple.
//
// The legacy `adp_type` enum flattened a cross-product of
// {scoring} x {superflex} x {redraft|dynasty|rookie} with `BESTBALL` wedged in
// as a peer value. The `adp_format` dimension decomposes those conflated axes
// into independent columns so new format dimensions are additive
// (ALTER TABLE ADD COLUMN + a wider CHECK) instead of an ALTER TYPE blowup.
//
// Axis identity is opaque (gen_random_uuid()); the dedup oracle is a
// UNIQUE NULLS NOT DISTINCT index across the full tuple below. The closed-set
// axes are stored as text with CHECK constraints (extensible without
// ALTER TYPE). These constant sets are the source the DDL CHECK constraints
// mirror -- keep them in sync with db/adhoc/2026-06-10-adp-format-dimension.sql.

// Closed-set axis values. Mirrored by the CHECK constraints on `adp_format`.
export const SCORING_CLASS = Object.freeze(['STANDARD', 'PPR', 'HALF_PPR'])
export const DURATION = Object.freeze(['REDRAFT', 'DYNASTY'])
export const DRAFT_POOL = Object.freeze(['ALL', 'ROOKIE'])
export const CONTEST_STYLE = Object.freeze(['MANAGED', 'BEST_BALL'])

// The full axis tuple, in column order. This is both the find-or-create
// conflict target and the UNIQUE index column list.
export const ADP_FORMAT_TUPLE_COLUMNS = Object.freeze([
  'scoring_class',
  'scoring_format_id',
  'num_qb',
  'num_teams',
  'duration',
  'draft_pool',
  'contest_style'
])

// Every legacy `adp_type` enum literal (all 19, including the empty `BESTBALL`
// bucket no importer ever wrote). The decode map below must cover this list
// exactly -- asserted as a closed-coverage test.
export const LEGACY_ADP_TYPES = Object.freeze([
  'STANDARD_REDRAFT',
  'PPR_REDRAFT',
  'HALF_PPR_REDRAFT',
  'STANDARD_SUPERFLEX_REDRAFT',
  'PPR_SUPERFLEX_REDRAFT',
  'HALF_PPR_SUPERFLEX_REDRAFT',
  'STANDARD_DYNASTY',
  'PPR_DYNASTY',
  'HALF_PPR_DYNASTY',
  'STANDARD_SUPERFLEX_DYNASTY',
  'PPR_SUPERFLEX_DYNASTY',
  'HALF_PPR_SUPERFLEX_DYNASTY',
  'STANDARD_ROOKIE',
  'PPR_ROOKIE',
  'HALF_PPR_ROOKIE',
  'STANDARD_SUPERFLEX_ROOKIE',
  'PPR_SUPERFLEX_ROOKIE',
  'HALF_PPR_SUPERFLEX_ROOKIE',
  'BESTBALL'
])

// Helper to spell out a full axis tuple with the legacy-default nulls.
// Legacy `adp_type` rows carry no concrete scoring_format link and no team
// count, so scoring_format_id and num_teams are null for every decoded row.
const tuple = ({
  scoring_class,
  num_qb,
  duration,
  draft_pool,
  contest_style
}) =>
  Object.freeze({
    scoring_class,
    scoring_format_id: null,
    num_qb,
    num_teams: null,
    duration,
    draft_pool,
    contest_style
  })

// Decode map: each legacy `adp_type` literal -> its normalized axis tuple.
// Rookie drafts are a dynasty-league construct, so the legacy *_ROOKIE types
// decode to duration=DYNASTY with draft_pool=ROOKIE (distinguishing them from
// the *_DYNASTY types, which keep draft_pool=ALL). This map is injective:
// distinct literals decode to distinct tuples, so the narrowed unique
// constraint (year, source_id, adp_format_id, pid) cannot collapse rows.
export const ADP_TYPE_DECODE_MAP = Object.freeze({
  STANDARD_REDRAFT: tuple({
    scoring_class: 'STANDARD',
    num_qb: 1,
    duration: 'REDRAFT',
    draft_pool: 'ALL',
    contest_style: 'MANAGED'
  }),
  PPR_REDRAFT: tuple({
    scoring_class: 'PPR',
    num_qb: 1,
    duration: 'REDRAFT',
    draft_pool: 'ALL',
    contest_style: 'MANAGED'
  }),
  HALF_PPR_REDRAFT: tuple({
    scoring_class: 'HALF_PPR',
    num_qb: 1,
    duration: 'REDRAFT',
    draft_pool: 'ALL',
    contest_style: 'MANAGED'
  }),
  STANDARD_SUPERFLEX_REDRAFT: tuple({
    scoring_class: 'STANDARD',
    num_qb: 2,
    duration: 'REDRAFT',
    draft_pool: 'ALL',
    contest_style: 'MANAGED'
  }),
  PPR_SUPERFLEX_REDRAFT: tuple({
    scoring_class: 'PPR',
    num_qb: 2,
    duration: 'REDRAFT',
    draft_pool: 'ALL',
    contest_style: 'MANAGED'
  }),
  HALF_PPR_SUPERFLEX_REDRAFT: tuple({
    scoring_class: 'HALF_PPR',
    num_qb: 2,
    duration: 'REDRAFT',
    draft_pool: 'ALL',
    contest_style: 'MANAGED'
  }),
  STANDARD_DYNASTY: tuple({
    scoring_class: 'STANDARD',
    num_qb: 1,
    duration: 'DYNASTY',
    draft_pool: 'ALL',
    contest_style: 'MANAGED'
  }),
  PPR_DYNASTY: tuple({
    scoring_class: 'PPR',
    num_qb: 1,
    duration: 'DYNASTY',
    draft_pool: 'ALL',
    contest_style: 'MANAGED'
  }),
  HALF_PPR_DYNASTY: tuple({
    scoring_class: 'HALF_PPR',
    num_qb: 1,
    duration: 'DYNASTY',
    draft_pool: 'ALL',
    contest_style: 'MANAGED'
  }),
  STANDARD_SUPERFLEX_DYNASTY: tuple({
    scoring_class: 'STANDARD',
    num_qb: 2,
    duration: 'DYNASTY',
    draft_pool: 'ALL',
    contest_style: 'MANAGED'
  }),
  PPR_SUPERFLEX_DYNASTY: tuple({
    scoring_class: 'PPR',
    num_qb: 2,
    duration: 'DYNASTY',
    draft_pool: 'ALL',
    contest_style: 'MANAGED'
  }),
  HALF_PPR_SUPERFLEX_DYNASTY: tuple({
    scoring_class: 'HALF_PPR',
    num_qb: 2,
    duration: 'DYNASTY',
    draft_pool: 'ALL',
    contest_style: 'MANAGED'
  }),
  STANDARD_ROOKIE: tuple({
    scoring_class: 'STANDARD',
    num_qb: 1,
    duration: 'DYNASTY',
    draft_pool: 'ROOKIE',
    contest_style: 'MANAGED'
  }),
  PPR_ROOKIE: tuple({
    scoring_class: 'PPR',
    num_qb: 1,
    duration: 'DYNASTY',
    draft_pool: 'ROOKIE',
    contest_style: 'MANAGED'
  }),
  HALF_PPR_ROOKIE: tuple({
    scoring_class: 'HALF_PPR',
    num_qb: 1,
    duration: 'DYNASTY',
    draft_pool: 'ROOKIE',
    contest_style: 'MANAGED'
  }),
  STANDARD_SUPERFLEX_ROOKIE: tuple({
    scoring_class: 'STANDARD',
    num_qb: 2,
    duration: 'DYNASTY',
    draft_pool: 'ROOKIE',
    contest_style: 'MANAGED'
  }),
  PPR_SUPERFLEX_ROOKIE: tuple({
    scoring_class: 'PPR',
    num_qb: 2,
    duration: 'DYNASTY',
    draft_pool: 'ROOKIE',
    contest_style: 'MANAGED'
  }),
  HALF_PPR_SUPERFLEX_ROOKIE: tuple({
    scoring_class: 'HALF_PPR',
    num_qb: 2,
    duration: 'DYNASTY',
    draft_pool: 'ROOKIE',
    contest_style: 'MANAGED'
  }),
  BESTBALL: tuple({
    scoring_class: 'HALF_PPR',
    num_qb: 1,
    duration: 'REDRAFT',
    draft_pool: 'ALL',
    contest_style: 'BEST_BALL'
  })
})

// Decode a single legacy `adp_type` literal to its axis tuple. Throws loudly on
// an unknown literal so a stray value cannot silently migrate to a null format.
export const decode_adp_type = (adp_type) => {
  const decoded = ADP_TYPE_DECODE_MAP[adp_type]
  if (!decoded) {
    throw new Error(`no adp_format decode mapping for adp_type: ${adp_type}`)
  }
  return { ...decoded }
}
