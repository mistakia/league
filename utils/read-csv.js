const fs = require('fs')
const csv = require('csv-parser')

module.exports = (filepath) =>
  new Promise((resolve, reject) => {
    const results = []
    fs.createReadStream(filepath)
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('error', (error) => resolve(error))
      .on('end', () => resolve(results))
  })
