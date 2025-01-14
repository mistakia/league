export default ({ params }) => {
  const seas_type = Array.isArray(params.seas_type)
    ? params.seas_type
    : params.seas_type
      ? [params.seas_type]
      : ['REG']

  return {
    ...params,
    seas_type
  }
}
