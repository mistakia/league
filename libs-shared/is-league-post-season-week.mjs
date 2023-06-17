// TODO should be derived from league settings for that year
export default function ({ year, week }) {
  return (year === 2020 && week > 13) || (year > 2020 && week > 14)
}
