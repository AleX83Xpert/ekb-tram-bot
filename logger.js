const pino = require('pino')

const logger = pino({
  name: 'bot',
  timestamp: () => `,"time":"${new Date(Date.now()).toISOString()}"`,
})

module.exports = logger
