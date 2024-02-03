require('dotenv').config()
const logger = require('./logger')
const { EttuService, MapService, TelegramService } = require('./services')

const ettuService = new EttuService(process.env.ETTU_API_KEY)
const mapService = new MapService(JSON.parse(process.env.MAP_SERVICE_CONFIG))

ettuService.init()
  .then(() => {
    const telegramService = new TelegramService(process.env.BOT_TOKEN, ettuService, mapService, logger)
    telegramService.startBot()
  })
