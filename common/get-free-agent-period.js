import dayjs from 'dayjs'

export default function getFreeAgentPeriod(auction_date) {
  const adate = dayjs.unix(auction_date)
  const start = adate.subtract('4', 'days')
  const end = adate.tz('America/New_York').add('2', 'day').startOf('day')

  return {
    start,
    end
  }
}
