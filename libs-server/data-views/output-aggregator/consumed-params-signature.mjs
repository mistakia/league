export const consumed_params_signature = ({ params, consumes_params }) => {
  const subset = {}
  for (const key of consumes_params) {
    if (params[key] !== undefined) subset[key] = params[key]
  }
  return JSON.stringify(subset)
}
