// Fixture for test/app.icon-sprite-coverage.spec.mjs. A `name` attribute that
// belongs to an input rather than to an icon — the shape that made a looser
// version of the scan report three icons that do not exist.
import React from 'react'

export default function IconAdjacentNameAttributeFixture() {
  return <input name='username' type='text' />
}
