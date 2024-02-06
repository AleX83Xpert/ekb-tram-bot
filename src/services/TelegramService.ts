import { Telegraf, Context, Input, NarrowedContext, Middleware } from 'telegraf'
import { v4 } from 'uuid'
import https from 'https'
import { EttuService } from './EttuService'
import { MapServiceType } from './mapServices'
import { Update, Message } from 'telegraf/typings/core/types/typegram'
import { message } from "telegraf/filters"

class TelegramService {
  private bot: Telegraf
  private ettuService: EttuService
  private mapService: MapServiceType
  private logger: any
  private allowedTramRoutes: string[]

  constructor(ettuService: EttuService, mapService: MapServiceType, logger: any) {
    if (!process.env.BOT_TOKEN) {
      throw new Error('No BOT_TOKEN in .env')
    }

    this.bot = new Telegraf(process.env.BOT_TOKEN)
    this.ettuService = ettuService
    this.mapService = mapService
    this.logger = logger
    this.allowedTramRoutes = ettuService.getRoutesNums()

    // Enable graceful stop
    process.once('SIGINT', () => this.bot.stop('SIGINT'))
    process.once('SIGTERM', () => this.bot.stop('SIGTERM'))
  }

  private onStartCommand = (ctx: Context<Update.MessageUpdate>) => {
    this.logger.info({ from: ctx.from }, '/start')
    this.bot.telegram.sendMessage(ctx.chat.id, `This bot shows following tram routes in Ekaterinburg: ${this.allowedTramRoutes.join(', ')}`, {})
  }

  private onHelpCommand = (ctx: Context<Update.MessageUpdate>) => {
    this.logger.info({ from: ctx.from }, '/help')
    this.bot.telegram.sendMessage(ctx.chat.id, `To watch trams send the number of the tram from the following list: ${this.allowedTramRoutes.join(', ')}`, {})
  }

  private generateMapUrl = (askedRouteStr: string): Promise<{ imageUrl: string; imageThumbUrl: string }> => {
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

  private onText = (ctx: any) => {
    const reqId = v4()
    const askedRouteStr = ctx.message.text
    const message_id = ctx.message.message_id

    this.generateMapUrl(askedRouteStr).then(({ imageUrl, imageThumbUrl }) => {
      this.logger.info({ chat: ctx.chat, reqId, askedRouteStr }, 'send image to chat')

      // Send with stream to keep map service key in secret
      https.get(imageUrl, { timeout: 20 }, (imageStream) => {
        this.logger.debug({ reqId }, 'image stream created')

        const now = new Date() // month is 0-indexed
        const [month, day, year] = [now.getMonth(), now.getDate(), now.getFullYear()]
        const [hour, minutes, seconds] = [now.getHours(), now.getMinutes(), now.getSeconds()]
        const fileName = `tram-${askedRouteStr}_${year}-${month + 1}-${day}_${hour}-${minutes}-${seconds}.jpg`

        ctx.telegram.sendPhoto(
          ctx.chat.id,
          Input.fromReadableStream(imageStream, fileName),
          { caption: `Tram ${askedRouteStr} route`, reply_to_message_id: message_id },
        ).then(() => {
          this.logger.info({ chat: ctx.chat, reqId }, `image was sent to chat`)
        }).catch((err: Error) => {
          this.logger.error({ chat: ctx.chat, reqId, err }, 'can not send image')
          ctx.telegram.sendMessage(
            ctx.chat.id,
            'Oops! An error occured. Can\'t send image :( You may try to find route here: http://map.ettu.ru/',
            { reply_to_message_id: message_id },
          )
        })
      })
    }).catch((err) => {
      this.logger.error({ err }, 'generateMapUrl error')
      ctx.telegram.sendMessage(
        ctx.chat.id,
        `Oops! An error occured :( ${err.message} You may try to find route here: http://map.ettu.ru/`,
        { reply_to_message_id: message_id },
      )
    })
  }

  private onInlineQuery = (ctx: Context<Update.InlineQueryUpdate>) => {
    const reqId = v4()
    const askedRouteStr = ctx.inlineQuery.query
    if (askedRouteStr) {
      this.logger.info({ reqId, askedRouteStr }, 'inline query')
      this.generateMapUrl(askedRouteStr).then(({ imageUrl, imageThumbUrl }) => {
        this.logger.info({ inlineQuery: ctx.inlineQuery, reqId, askedRouteStr }, 'send inline answer')
        ctx.telegram.answerInlineQuery(
          ctx.inlineQuery.id,
          [
            {
              type: 'photo',
              id: v4(),
              photo_url: imageUrl,
              thumbnail_url: imageThumbUrl,
              title: `Tram ${askedRouteStr}`,
              caption: `Tram ${askedRouteStr}`,
              description: `Tram ${askedRouteStr}`,
            },
          ],
          { cache_time: 30 },
        ).then((res) => {
          this.logger.info({ inlineQuery: ctx.inlineQuery, reqId }, 'inline image was sent')
        }).catch((err) => {
          this.logger.error({ inlineQuery: ctx.inlineQuery, reqId, err }, 'can not send inline image')
        })
      }).catch((err) => {
        this.logger.warn({ reqId, askedRouteStr, err }, 'generateMapUrl error')
        ctx.telegram.answerInlineQuery(ctx.inlineQuery.id, [])
      })
    }
  }

  startBot() {
    this.bot.command('start', this.onStartCommand)
    this.bot.command('help', this.onHelpCommand)

    this.bot.on(message('text'), this.onText)
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

export { TelegramService }
