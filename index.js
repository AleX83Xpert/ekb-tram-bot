require('dotenv').config()
const { Telegraf } = require('telegraf');
const bot = new Telegraf(process.env.BOT_TOKEN);
const axios = require('axios');
const geoUtils = require('geolocation-utils')
const logger = require('./logger')

const allowedTramRoutes = []
const ettuApiKey = process.env.ETTU_API_KEY

/**
 * @typedef EttuRouteElement
 * @type {object}
 * @property {string} duration_plan
 * @property {{id: string, name: string}} from
 * @property {string[]} full_path
 * @property {string} id
 * @property {string} ind
 * @property {string} kind
 * @property {string} len
 * @property {string} len_plan
 * @property {string} mnemo
 * @property {string} name
 * @property {string[]} path
 * @property {{id: string, name: string}} to
 */

/**
 * @typedef EttuRoute
 * @type {object}
 * @property {EttuRouteElement[]} elements
 * @property {{id: string, mnemo: string, name: string}[]} end_stations
 * @property {string} id
 * @property {string} name
 * @property {string} num
 */

/**
 * @type {EttuRoute[]}
 */
let routes = null

/**
 * @typedef EttuPoint
 * @type {object}
 * @property {string}
 * @property {string} ID
 * @property {string} NAME
 * @property {string} NOTE
 * @property {string} STATUS
 * @property {string} X
 * @property {string} Y
 * @property {string?} ATTACHED_TO
 * @property {string} SMS_CODE
 * @property {string} ANGLE
 * @property {string} ALIGN
 * @property {string} TTU_CODE
 * @property {string} DIRECTION
 * @property {string} TR_LAYER
 * @property {string} TTU_IDS
 * @property {string} LONGITUDE
 * @property {string} LATITUDE
 * @property {string} LAT
 * @property {string} LON
 * @property {string} ACCURACY
 */

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
    axios.get(`http://map.ettu.ru/api/v2/tram/boards/?apiKey=${ettuApiKey}&order=1`)
      .then(function (response) {
        /**
         * @typedef EttuVehicle
         * @type {object}
         * @property {string} ATIME
         * @property {string} DEV_ID
         * @property {string} LAT
         * @property {string} LON
         * @property {string} ROUTE
         * @property {string} COURSE
         * @property {string} VELOCITY
         * @property {string} ON_ROUTE
         * @property {string} LAYER
         * @property {string} BOARD_ID
         * @property {string} BOARD_NUM
         * @property {string} DEPOT
         */

        /** @type {EttuVehicle[]} */
        const askedVehicles = response.data.vehicles.filter((tram) => (tram.ROUTE === askedRouteStr))
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

logger.info('getting initial data from api server...')
Promise.all([
  axios.get(`http://map.ettu.ru/api/v2/tram/routes/?apiKey=${ettuApiKey}`),
  axios.get(`http://map.ettu.ru/api/v2/tram/points/?apiKey=${ettuApiKey}`)
])
  .then((results) => {
    results.forEach((result) => {
      const err = result.data.error
      if (err.code != 0) {
        throw new Error(`Error ${err.code}: ${err.msg}`)
      }
    })
    routes = results[0].data.routes
    points = results[1].data.points
    logger.info('initial data received')

    allowedTramRoutes.push(...routes.map((route) => route.num).sort((a, b) => a - b))

    logger.info(`allowed tram routes: ${allowedTramRoutes.join(',')}`)

    // Start webhook via launch method (preferred)
    bot.launch({
      // webhook: {
      //   domain: 'https://example.com',
      //   port: process.env.PORT
      // }
    })
    logger.info('bot ready to communicate!')
  })
  .catch(function (error) {
    // handle error
    logger.error(error);
  })
  .then(function () {
    // always executed
  })

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'))
process.once('SIGTERM', () => bot.stop('SIGTERM'))
