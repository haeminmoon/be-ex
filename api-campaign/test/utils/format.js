const moment = require('moment')

const addDay = (date, num, format) => moment(date).add(num, 'd').format(format)

module.exports = {
  addDay
}
