const { Telegraf, Context, Input } = require('telegraf');
const UUID = require('uuid')
const https = require('https')

class TelegramService {

  /**
   * @param {string} botToken 
   * @param {EttuService} ettuService 
   * @param {MapService} mapService
   * @param {winston.Logger} logger 
   */
  constructor(botToken, ettuService, mapService, logger) {
    /**
     * @private
     */
    this.bot = new Telegraf(botToken)

    /**
     * @private
     */
    this.ettuService = ettuService

    /**
    * @private
    */
    this.mapService = mapService

    /**
     * @private
     */
    this.logger = logger

    /**
     * @private
     */
    this.allowedTramRoutes = ettuService.getRoutesNums()

    // Enable graceful stop
    process.once('SIGINT', () => this.bot.stop('SIGINT'))
    process.once('SIGTERM', () => this.bot.stop('SIGTERM'))
  }

  /**
   * @private
   * @param {Context} ctx 
   */
  onStartCommand = (ctx) => {
    this.logger.info('/start:', ctx.from)
    this.bot.telegram.sendMessage(ctx.chat.id, `This bot shows following tram routes in Ekaterinburg: ${this.allowedTramRoutes.join(', ')}`, {})
  }

  /**
   * @private
   * @param {Context} ctx 
   */
  onHelpCommand = (ctx) => {
    this.logger.info('/help:', ctx.from)
    this.bot.telegram.sendMessage(ctx.chat.id, `To watch trams send the number of the tram from the following list: ${this.allowedTramRoutes.join(', ')}`, {})
  }

  /**
   * @private
   * @param {string} askedRouteStr 
   * @returns {Promise<{imageUrl: string, imageThumbUrl: string}>}
   */
  generateMapUrl = (askedRouteStr) => {
    return new Promise((resolve, reject) => {
      if (this.allowedTramRoutes.includes(askedRouteStr)) {
        this.ettuService.getTramBoards()
          .then((response) => {
            const askedVehicles = response.filter((tram) => (tram.ROUTE === askedRouteStr))
            const askedRoutes = this.ettuService.getRoutes(askedRouteStr)

            const vehiclesLocations = askedVehicles.map((tram) => ({ lat: Number(tram.LAT), lon: Number(tram.LON), course: Number(tram.COURSE) }))

            /** @type TGenerateMapUrlOptions */
            const options = {
              vehiclesLocations,
              askedRouteStr,
              askedRoutes,
              points: this.ettuService.getPoints(),
              imageWidth: 1024,
              imageHeight: 1024,
            }

            const imageUrl = this.mapService.generateMapUrl(options)
            const imageThumbUrl = this.mapService.generateMapUrl({ ...options, imageWidth: 256, imageHeight: 256 })

            resolve({ imageUrl, imageThumbUrl })
          })
          .catch((err) => {
            reject(err)
          })
          .then(() => {
            // always executed
          });
      } else {
        reject(new Error(`Route ${askedRouteStr} not found. Allowed routes: ${this.allowedTramRoutes.join(', ')}`))
      }
    })
  }

  /**
   * @private
   * @param {Context} ctx 
   */
  onText = (ctx) => {
    const reqId = UUID.v4()
    const askedRouteStr = ctx.message.text
    const message_id = ctx.message.message_id

    this.generateMapUrl(askedRouteStr).then(({ imageUrl, imageThumbUrl }) => {
      this.logger.info(`${reqId}: Send image with tram ${askedRouteStr} to chat`, ctx.chat)

      // Send with stream to keep map service key in secret
      https.get(imageUrl, { timeout: 20 }, (imageStream) => {
        this.logger.debug(`${reqId}: Image stream created`)

        const now = new Date() // month is 0-indexed
        const [month, day, year] = [now.getMonth(), now.getDate(), now.getFullYear()]
        const [hour, minutes, seconds] = [now.getHours(), now.getMinutes(), now.getSeconds()]
        const fileName = `tram-${askedRouteStr}_${year}-${month + 1}-${day}_${hour}-${minutes}-${seconds}.jpg`

        ctx.telegram.sendPhoto(
          ctx.chat.id,
          Input.fromReadableStream(imageStream, fileName),
          { caption: `Tram ${askedRouteStr} route`, reply_parameters: { message_id }, cache_time: 30 },
        ).then((res) => {
          this.logger.info(`${reqId}: Image was sent to chat`, ctx.chat)
        }).catch((err) => {
          this.logger.error(`${reqId}: Can't send image: ${err.message}`, ctx.chat)
          ctx.telegram.sendMessage(
            ctx.chat.id,
            'Oops! An error occured. Can\'t send image :( You may try to find route here: http://map.ettu.ru/',
            { reply_parameters: { message_id } },
          )
        })
      })
    }).catch((err) => {
      this.logger.error(err)
      ctx.telegram.sendMessage(
        ctx.chat.id,
        `Oops! An error occured :( ${err.message} You may try to find route here: http://map.ettu.ru/`,
        { reply_parameters: { message_id } },
      )
    })
  }

  /**
   * @private
   * @param {Context} ctx 
   */
  onInlineQuery = (ctx) => {
    const reqId = UUID.v4()
    const askedRouteStr = ctx.inlineQuery.query
    if (askedRouteStr) {
      this.logger.info(`${reqId}: Inline query: ${askedRouteStr}`)
      this.generateMapUrl(askedRouteStr).then(({ imageUrl, imageThumbUrl }) => {
        this.logger.info(`${reqId}: Send inline answer with tram ${askedRouteStr} to:`, ctx.inlineQuery)
        ctx.telegram.answerInlineQuery(
          ctx.inlineQuery.id,
          [
            {
              type: 'photo',
              id: UUID.v4(),
              photo_url: imageUrl,
              thumbnail_url: imageThumbUrl,
              title: `Tram ${askedRouteStr}`,
              caption: `Tram ${askedRouteStr}`,
              description: `Tram ${askedRouteStr}`,
            },
          ],
          { cache_time: 30 },
        ).then((res) => {
          this.logger.info(`${reqId}: Inline image was sent`, ctx.inlineQuery)
        }).catch((err) => {
          this.logger.error(`${reqId}: Can't send inline image: ${err.message}`, ctx.inlineQuery)
        })
      }).catch((err) => {
        this.logger.warn(`${reqId}: No inline results for '${askedRouteStr}'`)
        ctx.telegram.answerInlineQuery(ctx.inlineQuery.id, [])
      })
    }
  }

  startBot() {
    this.bot.command('start', this.onStartCommand)
    this.bot.command('help', this.onHelpCommand)

    this.bot.on('message', this.onText)
    this.bot.on('inline_query', this.onInlineQuery)

    this.bot.launch({
      // webhook: {
      //   domain: 'https://example.com',
      //   port: process.env.PORT
      // }
    })
    this.logger.info('Bot ready to communicate!')
  }
}

module.exports = TelegramService
