const american_to_decimal = (american) =>
  american >= 0 ? american / 100 + 1 : 100 / Math.abs(american) + 1

const american_to_implied_probability = (american) =>
  american >= 0
    ? 100 / (american + 100)
    : Math.abs(american) / (Math.abs(american) + 100)

const decimal_to_american = (decimal) =>
  decimal >= 2
    ? Math.round((decimal - 1) * 100)
    : Math.round(-100 / (decimal - 1))

const decimal_to_implied_probability = (decimal) => 1 / decimal

const converters = {
  moneyline: {
    moneyline: (x) => x,
    decimal: american_to_decimal,
    impliedProbability: american_to_implied_probability
  },
  decimal: {
    decimal: (x) => x,
    moneyline: decimal_to_american,
    impliedProbability: decimal_to_implied_probability
  }
}

export default {
  from(input_format, value) {
    const format_converters = converters[input_format]
    if (!format_converters) {
      throw new Error(`Unsupported input odds format: ${input_format}`)
    }
    return {
      to(output_format) {
        const convert = format_converters[output_format]
        if (!convert) {
          throw new Error(
            `Unsupported odds conversion: ${input_format} -> ${output_format}`
          )
        }
        return convert(value)
      }
    }
  }
}
