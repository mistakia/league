/**
 * The leagues the sidebar's switcher may offer, in the order it shows them.
 *
 * Kept OUT of `app/core/selectors.js` so it can be specced. That module pulls
 * the whole saga tree in transitively -- `app/core/draft/sagas.js` calls
 * `dayjs.extend` at load and throws under native ESM -- so nothing reachable
 * only through it can have a unit test at all. This file imports Immutable and
 * nothing else; `get_leagues_for_user` is the thin `createSelector` around it.
 *
 * `leagueIds` is the membership list off `/api/me`; `leagues` is the record
 * store. The join is what turns ids into something nameable.
 *
 * A league whose record has not arrived is KEPT, labelled by its id. Both
 * halves ride the same payload so it should not happen -- but the switcher
 * navigates, and a league silently missing from it is one the user cannot reach
 * with nothing on screen to say why. A bare id is still a working option.
 *
 * Sorted by id rather than left in arrival order, which is whatever the
 * `/api/me` join produced: an unsorted list reorders itself between sessions.
 */
export const build_league_switcher_options = ({ leagueIds, leagues }) =>
  leagueIds
    .map((league_id) => ({
      league_id,
      name: leagues.getIn([league_id, 'name']) || `League ${league_id}`
    }))
    .sortBy((league) => league.league_id)
    .toArray()

export default build_league_switcher_options
