require('dotenv').config()
const { Telegraf } = require('telegraf');
const bot = new Telegraf(process.env.BOT_TOKEN);
const axios = require('axios');
const geoUtils = require('geolocation-utils')
const logger = require('./logger')
const { EttuService, MapService, TelegramService } = require('./services')

const allowedTramRoutes = []
const ettuApiKey = process.env.ETTU_API_KEY

const ettuService = new EttuService(process.env.ETTU_API_KEY)
const mapService = new MapService(process.env.MAPQUEST_KEY)

/**
 * @type {EttuRoute[]}
 */
let routes = null

/**
 * @type {EttuPoint[]}
 */
let points = null

bot.command('start', ctx => {
  logger.info(`start: `, ctx.from)
  bot.telegram.sendMessage(ctx.chat.id, `This bot shows following tram routes in Ekaterinburg: ${allowedTramRoutes.join(', ')}`, {})
})

bot.command('help', ctx => {
  logger.info(`help: `, ctx.from)
  bot.telegram.sendMessage(ctx.chat.id, `To watch trams send the number of the tram from the following list: ${allowedTramRoutes.join(', ')}`, {})
})

bot.on('text', (ctx) => {
  const askedRouteStr = ctx.message.text
  logger.info(`incoming message`, ctx.message)
  if (allowedTramRoutes.includes(askedRouteStr)) {
    ettuService.getTramBoards()
      .then(function (response) {
        const askedVehicles = response.filter((tram) => (tram.ROUTE === askedRouteStr))
        const askedRoutes = routes.filter((x) => x.num === askedRouteStr)

        const vehiclesLocations = askedVehicles.map((tram) => ({ lat: Number(tram.LAT), lon: Number(tram.LON), course: Number(tram.COURSE) }))

        var params = new URLSearchParams();
        params.append('key', process.env.MAPQUEST_KEY)
        params.append(
          'locations',
          vehiclesLocations.map(({ lon, lat, course }) => {
            const courseLocation = geoUtils.moveTo({ lat, lon }, { distance: 150, heading: course + 90 })
            return `${lat},${lon}||${courseLocation.lat},${courseLocation.lon}|via-sm`
          }).join('||')
        )
        params.append('size', '800,800@2x')
        params.append('defaultMarker', `circle-${askedRouteStr}`)

        // add routes polylines
        const routesPoints = []
        askedRoutes.forEach((askedRoute) => {
          askedRoute.elements.forEach((element, elementKey) => {
            const polyLine = []
            element.full_path.forEach((pointId) => {
              const filteredPoints = points.filter((x) => x.ID === String(pointId))
              if (filteredPoints.length > 0) {
                const point = filteredPoints[0]
                polyLine.push(`${point.LAT},${point.LON}`)
                routesPoints.push({ lat: Number(point.LAT), lon: Number(point.LON) })
              }
            })
            params.append('shape', polyLine.join('|'))
          })
        })

        const box = geoUtils.getBoundingBox(routesPoints)

        const lons = [box.topLeft.lon, box.bottomRight.lon]
        const lats = [box.topLeft.lat, box.bottomRight.lat]

        const boxData = [
          Math.max(...lats),
          Math.min(...lons),
          Math.min(...lats),
          Math.max(...lons),
        ]

        params.append('boundingBox', boxData.join(','))

        const imageUrl = axios.getUri({
          method: 'get',
          url: 'https://open.mapquestapi.com/staticmap/v5/map',
          params: params,
        })

        logger.info(`Send image with tram ${askedRouteStr} to`, ctx.chat)
        ctx.telegram.sendPhoto(ctx.chat.id, imageUrl)
      })
      .catch(function (error) {
        logger.error(error)
      })
      .then(function () {
        // always executed
      });
  }
})

ettuService.init()
  .then(() => {
    const telegramService = new TelegramService(process.env.BOT_TOKEN, ettuService, mapService, logger)
    telegramService.startBot()
  })

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'))
process.once('SIGTERM', () => bot.stop('SIGTERM'))
