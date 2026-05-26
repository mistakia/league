import * as cheerio from 'cheerio'

export default async function fetch_cheerio(url, options = {}) {
  const response = await fetch(url, options)
  const html = await response.text()
  return cheerio.load(html)
}
