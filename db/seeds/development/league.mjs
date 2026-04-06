import draft from '#db/seeds/draft.mjs'
import league from '#db/seeds/league.mjs'
import users from '#db/seeds/users.mjs'
import matchups from '#db/seeds/matchups.mjs'
import draftPicks from '#db/seeds/draft-picks.mjs'
import nflTeams from '#db/seeds/nfl-teams.mjs'

export async function seed(knex, Promise) {
  try {
    await knex('waivers').del()
    await knex('poaches').del()
    await knex('rosters_players').del()
  } catch (error) {
    console.log(error)
  }

  try {
    await nflTeams(knex)
  } catch (error) {
    console.log(error)
  }

  try {
    await users(knex)
  } catch (error) {
    console.log(error)
  }

  try {
    await league(knex)
  } catch (error) {
    console.log(error)
  }

  try {
    await draft(knex)
  } catch (error) {
    console.log(error)
  }

  try {
    await matchups(knex)
  } catch (error) {
    console.log(error)
  }

  try {
    await draftPicks(knex)
  } catch (error) {
    console.log(error)
  }
}
