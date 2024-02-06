import pino from 'pino'

const logger = pino({
  name: 'bot',
  timestamp: () => `,"time":"${new Date(Date.now()).toISOString()}"`,
})

export { logger }
