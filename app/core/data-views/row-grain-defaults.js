// Re-export the isomorphic row-grain defaults. Single source of truth lives
// in libs-shared/row-grain-defaults.mjs, shared with the server-side
// row-grain registry.
export {
  ROW_GRAIN_DEFAULTS,
  ROW_GRAIN_OPTIONS,
  ROW_GRAIN_TOOLTIP
} from '@libs-shared/row-grain-defaults.mjs'
