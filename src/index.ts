import 'dotenv/config'
import { logger } from './logger'
import { EttuService, createMapService, TelegramService } from './services'

const ettuService = new EttuService()
const mapService = createMapService()

ettuService.init().then(() => {
  const telegramService = new TelegramService(ettuService, mapService, logger)
  telegramService.startBot()
})
