/* eslint-disable no-extra-semi */
export default function (xs, key) {
  return xs.reduce((rv, x) => {
    ;(rv[x[key]] = rv[x[key]] || []).push(x)
    return rv
  }, {})
}
/* eslint-enable no-extra-semi */
