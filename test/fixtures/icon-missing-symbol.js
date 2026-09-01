// Fixture for test/app.icon-sprite-coverage.spec.mjs. Not rendered anywhere:
// it is the negative control that proves the scan can report a missing symbol.
import React from 'react'
import Icon from '@components/icon'

export default function IconMissingSymbolFixture() {
  return <Icon name='not-a-real-glyph' />
}
