import dayjs from 'dayjs'
import { current_season } from '#constants'

/**
 * Whether the league is still inside the extension window, and therefore
 * whether a contract's salary should be displayed on the post-extension basis
 * (extensions applied, tags priced in) rather than as recorded.
 *
 * A league with no configured `extension_deadline_at` is treated as inside the window during
 * the offseason and outside it during the regular season, when salaries are
 * locked. This is the single definition of the boundary — `Roster` prices every
 * roster row from it, so any other surface that needs the basis must read it
 * here rather than re-deriving the comparison.
 */
export default function is_before_extension_deadline({ league }) {
  if (!league || !league.extension_deadline_at) {
    return !current_season.isRegularSeason
  }

  return current_season.now.isBefore(dayjs(league.extension_deadline_at))
}
