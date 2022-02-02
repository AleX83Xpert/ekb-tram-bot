require('dotenv').config()
const { Telegraf } = require('telegraf');
const bot = new Telegraf(process.env.BOT_TOKEN);

bot.command('start', ctx => {
    console.log(ctx.from)
    bot.telegram.sendMessage(ctx.chat.id, 'TestBot', {
    })
})

// copy every message and send to the user
bot.on('message', (ctx) => {
    console.log(ctx.message.text)
    ctx.telegram.copyMessage(ctx.chat.id, ctx.message.from.id ,ctx.message.message_id)
})

// Start webhook via launch method (preferred)
bot.launch({
    // webhook: {
    //   domain: 'https://example.com',
    //   port: process.env.PORT
    // }
  })

  
// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'))
process.once('SIGTERM', () => bot.stop('SIGTERM'))
