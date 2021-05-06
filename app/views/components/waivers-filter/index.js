import { connect } from 'react-redux'

import { waiverActions } from '@core/waivers'

import Filter from '@components/filter'

const mapDispatchToProps = {
  filter: waiverActions.filter
}

export default connect(null, mapDispatchToProps)(Filter)
