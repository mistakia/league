export const is_year_offset_range = (params) =>
  Boolean(
    params.year_offset &&
      Array.isArray(params.year_offset) &&
      params.year_offset.length > 1 &&
      params.year_offset[0] !== params.year_offset[1]
  )
