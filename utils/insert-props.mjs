import db from '#db'

async function insertProp(prop) {
  const { pid, wk, year, type, sourceid, ln, o, u } = prop

  // get last prop
  const results = await db('props')
    .where({
      pid,
      year,
      wk,
      type,
      sourceid
    })
    .orderBy('timestamp', 'desc')
    .limit(1)

  const last_prop = results[0]

  // if there is no last prop or if line/odds have changed, insert prop
  if (
    !last_prop ||
    (last_prop.ln === ln && last_prop.o === o && last_prop.u === u)
  ) {
    await db('props').insert(prop)

    // TODO: send out notifications
  }
}

export default async function (props) {
  for (const prop of props) {
    await insertProp(prop)
  }
}
