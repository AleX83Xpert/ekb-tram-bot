import { Telegraf, Context, Input } from 'telegraf'
import https from 'https'
import { EttuService } from './EttuService'
import { MapServiceType } from './mapServices'
import { Update } from 'telegraf/typings/core/types/typegram'
import { message } from 'telegraf/filters'
import { i18n } from '../i18n'
import { TFunction } from 'i18next/typescript/t'

type TContext = Context<Update.MessageUpdate> & { t: TFunction, reqId: string }

class TelegramService {
  private bot: Telegraf<TContext>
  private ettuService: EttuService
  private mapService: MapServiceType
  private logger: any
  private allowedTramRoutes: string[]

  constructor(ettuService: EttuService, mapService: MapServiceType, logger: any) {
    if (!process.env.BOT_TOKEN) {
      throw new Error('No BOT_TOKEN in .env')
    }

    this.bot = new Telegraf<TContext>(process.env.BOT_TOKEN)
    this.ettuService = ettuService
    this.mapService = mapService
    this.logger = logger
    this.allowedTramRoutes = ettuService.getRoutesNums()
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

  startBot () {
    this.bot.use((ctx, next) => {
      const start = Date.now()
      if (!ctx.reqId) {
        ctx.reqId = crypto.randomUUID()
      }

      this.logger.info({ msg: 'requestStart', reqId: ctx.reqId, updateType: ctx.updateType, data: ctx.update })

      ctx.t = i18n(ctx.from?.language_code)

      return next().then(() => {
        const duration = Date.now() - start
        this.logger.info({ msg: 'requestEnd', reqId: ctx.reqId, duration })
      })
    })

    this.bot.command('start', (ctx) => {
      this.logger.info({ from: ctx.from }, '/start')
      this.bot.telegram.sendMessage(ctx.chat.id, ctx.t('whatCanIDo', { routesList: this.allowedTramRoutes.join(', ') }), {})
    })

    this.bot.command('help', (ctx) => {
      this.logger.info({ from: ctx.from }, '/help')
      this.bot.telegram.sendMessage(ctx.chat.id, ctx.t('helpMessage', { routesList: this.allowedTramRoutes.join(', ') }), {})
    })

    this.bot.on(message('text'), (ctx) => {
      const askedRouteStr = ctx.message.text
      const message_id = ctx.message.message_id

      this.generateMapUrl(askedRouteStr).then(({ imageUrl, imageThumbUrl }) => {
        this.logger.info({ chat: ctx.chat, reqId: ctx.reqId, askedRouteStr }, 'send image to chat')

        // Send with stream to keep map service key in secret
        https.get(imageUrl, { timeout: 20 }, (imageStream) => {
          this.logger.debug({ reqId: ctx.reqId }, 'image stream created')

          const now = new Date() // month is 0-indexed
          const [month, day, year] = [now.getMonth(), now.getDate(), now.getFullYear()]
          const [hour, minutes, seconds] = [now.getHours(), now.getMinutes(), now.getSeconds()]
          const fileName = `tram-${askedRouteStr}_${year}-${month + 1}-${day}_${hour}-${minutes}-${seconds}.jpg`

          ctx.telegram.sendPhoto(
            ctx.chat.id,
            Input.fromReadableStream(imageStream, fileName),
            { caption: ctx.t('tramRoute', { routeNumber: askedRouteStr }), reply_to_message_id: message_id },
          ).then(() => {
            this.logger.info({ chat: ctx.chat, reqId: ctx.reqId }, `image was sent to chat`)
          }).catch((err: Error) => {
            this.logger.error({ chat: ctx.chat, reqId: ctx.reqId, err }, 'can not send image')
            ctx.telegram.sendMessage(
              ctx.chat.id,
              ctx.t('cantSendImageException'),
              { reply_to_message_id: message_id },
            )
          })
        })
      }).catch((err) => {
        this.logger.error({ err }, 'generateMapUrl error')
        ctx.telegram.sendMessage(
          ctx.chat.id,
          ctx.t('cantCreateImageUrlException', { errMessage: err.message }),
          { reply_to_message_id: message_id },
        )
      })
    })

    this.bot.on('inline_query', (ctx) => {
      const askedRouteStr = ctx.inlineQuery.query
      if (askedRouteStr) {
        this.logger.info({ reqId: ctx.reqId, askedRouteStr }, 'inline query')
        this.generateMapUrl(askedRouteStr).then(({ imageUrl, imageThumbUrl }) => {
          this.logger.info({ inlineQuery: ctx.inlineQuery, reqId: ctx.reqId, askedRouteStr }, 'send inline answer')
          ctx.telegram.answerInlineQuery(
            ctx.inlineQuery.id,
            [
              {
                type: 'photo',
                id: crypto.randomUUID(),
                photo_url: imageUrl,
                thumbnail_url: imageThumbUrl,
                title: ctx.t('tramRoute', { routeNumber: askedRouteStr }),
                caption: ctx.t('tramRoute', { routeNumber: askedRouteStr }),
                description: ctx.t('tramRoute', { routeNumber: askedRouteStr }),
              },
            ],
            { cache_time: 30 },
          ).then((res) => {
            this.logger.info({ inlineQuery: ctx.inlineQuery, reqId: ctx.reqId }, 'inline image was sent')
          }).catch((err) => {
            this.logger.error({ inlineQuery: ctx.inlineQuery, reqId: ctx.reqId, err }, 'can not send inline image')
          })
        }).catch((err) => {
          this.logger.warn({ reqId: ctx.reqId, askedRouteStr, err }, 'generateMapUrl error')
          ctx.telegram.answerInlineQuery(ctx.inlineQuery.id, [])
        })
      }
    })

    this.bot.launch()
    this.logger.info('Bot ready to communicate!')

    // Enable graceful stop
    process.once('SIGINT', () => this.bot.stop('SIGINT'))
    process.once('SIGTERM', () => this.bot.stop('SIGTERM'))
  }
}

export { TelegramService }
