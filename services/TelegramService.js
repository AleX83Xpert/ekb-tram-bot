const { Telegraf, Context } = require('telegraf');
const UUID = require('uuid')

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
    this.bot = new Telegraf(botToken);

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

            const imageUrl = this.mapService.generateMapUrl(vehiclesLocations, askedRouteStr, askedRoutes, this.ettuService.getPoints())
            const imageThumbUrl = this.mapService.generateMapUrl(vehiclesLocations, askedRouteStr, askedRoutes, this.ettuService.getPoints(), '256,256')

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
    const askedRouteStr = ctx.message.text
    this.generateMapUrl(askedRouteStr)
      .then(({ imageUrl, imageThumbUrl }) => {
        this.logger.info(`Send image with tram ${askedRouteStr} to chat`, ctx.chat)
        ctx.telegram.sendPhoto(ctx.chat.id, imageUrl)
          .then((res) => {
            this.logger.info('Image was sent to chat', ctx.chat)
          })
          .catch((err) => {
            this.logger.error(`Can't send image: ${err.message}`, ctx.chat)
            ctx.telegram.sendMessage(ctx.chat.id, 'Oops! An error occured. Can\'t send photo :(')
          })
      })
      .catch((err) => {
        this.logger.error(err)
        ctx.telegram.sendMessage(ctx.chat.id, `Oops! An error occured :( ${err.message}`)
      })
  }

  /**
   * @private
   * @param {Context} ctx 
   */
  onInlineQuery = (ctx) => {
    const askedRouteStr = ctx.inlineQuery.query
    if (askedRouteStr) {
      this.logger.info(`Inline query: ${askedRouteStr}`)
      this.generateMapUrl(askedRouteStr)
        .then(({ imageUrl, imageThumbUrl }) => {
          this.logger.info(`Send inline answer with tram ${askedRouteStr} to:`, ctx.inlineQuery.from)
          ctx.telegram.answerInlineQuery(
            ctx.inlineQuery.id,
            [
              {
                type: 'photo',
                id: UUID.v4(),
                photo_url: imageUrl,
                thumb_url: imageThumbUrl,
                title: `Tram ${askedRouteStr}`,
                caption: `Tram ${askedRouteStr}`,
                description: `Tram ${askedRouteStr}`,
              },
            ]
          )
        })
        .catch((err) => {
          this.logger.warn(`No inline results for '${askedRouteStr}'`)
          ctx.telegram.answerInlineQuery(ctx.inlineQuery.id, [])
        })
    } else {
      this.logger.warn(`No inline results for '${askedRouteStr}'`)
      ctx.telegram.answerInlineQuery(ctx.inlineQuery.id, [])
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
