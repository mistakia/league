import draft from '../draft.mjs'
import league from '../league.mjs'
import users from '../users.mjs'
import matchups from '../matchups.mjs'
import draftPicks from '../draft-picks.mjs'
import nflTeams from '../nfl-teams.mjs'

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
