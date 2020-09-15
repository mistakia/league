const calculateDstPoints = (stats) => {
  const points = {
    sk: stats.sk * 1,
    int: stats.int * 2,
    ff: stats.ff * 1, // forced fumble
    rf: stats.rf * 1, // recovered fumble
    tno: stats.tno * 1, // three and out
    fds: stats.fds * 1, // fourth down stop
    pa: Math.max(stats.pa - 20, 0) * -0.4, // points against
    ya: Math.max(stats.ya - 300, 0) * -0.02, // yards against
    blk: stats.blk * 3, // blocked kicks
    sfty: stats.sfty * 2, // safety
    tpr: stats.tpr * 2, // two point return
    td: stats.td * 6,
    total: 0
  }

  points.total = Object.values(points).reduce((sum, v) => sum + v, 0)

  return points
}

export default calculateDstPoints
