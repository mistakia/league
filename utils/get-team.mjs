import db from '#db'

export default async function (tid) {
  const teams = await db('teams').where({ uid: tid })
  return teams[0]
}
