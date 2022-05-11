import dayjs from 'dayjs'

export default function getGameDayAbbreviation({
  type,
  date,
  time_est,
  wk,
  seas
}) {
  if (type === 'PRO') {
    return 'PRO'
  }

  if (seas <= 2019 && wk === 21) {
    return 'SB'
  }

  const gameDate = dayjs.tz(
    `${date} ${time_est}`,
    'YYYY/MM/DD HH:mm:SS',
    'America/New_York'
  )

  const day = gameDate.day()

  switch (day) {
    // sunday
    case 0: {
      const hour = gameDate.hour()
      if (hour < 19) {
        return 'SUN'
      } else {
        return 'SN'
      }
    }

    // monday
    case 1:
      return 'MN'

    // tuesday
    case 2:
      return 'TUE'

    // wednesday
    case 3:
      return 'WED'

    // thursday
    case 4:
      return 'THU'

    // friday
    case 5:
      return 'FRI'

    // saturday
    case 6:
      return 'SAT'
  }
}
