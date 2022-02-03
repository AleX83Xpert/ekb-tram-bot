require('dotenv').config()
const { Telegraf } = require('telegraf');
const bot = new Telegraf(process.env.BOT_TOKEN);
const axios = require('axios');
const geoUtils = require('geolocation-utils')

const allowedTramRoutes = ['32', '15', '26']
const ettuApiKey = process.env.ETTU_API_KEY

let routes = null
let points = null

bot.command('start', ctx => {
    console.log(ctx.from)
    bot.telegram.sendMessage(ctx.chat.id, `This bot shows following tram routes in Ekaterinburg: ${allowedTramRoutes.join(', ')}`, {
    })
})

bot.command('help', ctx => {
    console.log(ctx.from)
    bot.telegram.sendMessage(ctx.chat.id, `To watch trams send the number of the tram from the following list: ${allowedTramRoutes.join(', ')}`, {
    })
})

bot.on('text', (ctx) => {
    const askedRoute = ctx.message.text
    if(allowedTramRoutes.includes(askedRoute)) {
      axios.get(`http://map.ettu.ru/api/v2/tram/boards/?apiKey=${ettuApiKey}&order=1`)
        .then(function (response) {
            const askedTrams = response.data.vehicles.filter((tram) => (tram.ROUTE === askedRoute))
            const route = routes.filter((x)=>x.num === askedRoute)
            // [
            //     {
            //     ATIME: '2022-02-02 20:19:21',
            //     DEV_ID: '3008736',
            //     LAT: '56.834849',
            //     LON: '60.690990',
            //     ROUTE: '32',
            //     COURSE: '270',
            //     VELOCITY: '0',
            //     ON_ROUTE: '1',
            //     LAYER: '1',
            //     BOARD_ID: '807',
            //     BOARD_NUM: '807',
            //     DEPOT: '3'
            //   }
            // ]

            const locations = askedTrams.map((tram)=>({lat: Number(tram.LAT), lon: Number(tram.LON), course: Number(tram.COURSE)}))
            const box = geoUtils.getBoundingBox(locations)
            const lons = [box.topLeft.lon, box.bottomRight.lon]
            const lats = [box.topLeft.lat, box.bottomRight.lat]

            const boxData = [
                Math.max(...lats),
                Math.min(...lons),
                Math.min(...lats),
                Math.max(...lons),
            ]

            var params = new URLSearchParams();
            params.append('key', process.env.MAPQUEST_KEY)
            params.append('boundingBox', boxData.join(','))
            params.append('locations', locations.map(({lon,lat,course}) => {
                const courseLocation = geoUtils.moveTo({lat, lon}, {distance: 150, heading: course + 90})
                return `${lat},${lon}||${courseLocation.lat},${courseLocation.lon}|via-sm`
            }).join('||'))
            params.append('size', '800,800@2x')
            params.append('defaultMarker', `circle-${askedRoute}`)

            route[0].elements.forEach((element, elementKey) => {
                const polyLine = []
                element.full_path.forEach((pointId) => {
                    const filteredPoints = points.filter((x) => x.ID === String(pointId))
                    if(filteredPoints.length > 0) {
                        const point = filteredPoints[0]
                        polyLine.push(`${point.LAT},${point.LON}`)
                    }
                })
                params.append('shape', polyLine.join('|'))
            })

            const imageUrl = axios.getUri({
                method: 'get',
                url: 'https://open.mapquestapi.com/staticmap/v5/map',
                params: params,
            })

            ctx.telegram.sendPhoto(ctx.chat.id, imageUrl)
        })
        .catch(function (error) {
            // handle error
            console.log(error);
        })
        .then(function () {
            // always executed
        });
    }
})

Promise.all([
    axios.get(`http://map.ettu.ru/api/v2/tram/routes/?apiKey=${ettuApiKey}`),
    axios.get(`http://map.ettu.ru/api/v2/tram/points/?apiKey=${ettuApiKey}`)
])
.then((results)=>{
    results.forEach((result)=>{
        const err = result.data.error
        if(err.code != 0){
            throw new Error(`Error ${err.code}: ${err.msg}`)
        }
    })
    routes = results[0].data.routes
    points = results[1].data.points

    // Start webhook via launch method (preferred)
    bot.launch({
        // webhook: {
        //   domain: 'https://example.com',
        //   port: process.env.PORT
        // }
    })
})
.catch(function (error) {
    // handle error
    console.log(error);
})
.then(function () {
    // always executed
})
  
// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'))
process.once('SIGTERM', () => bot.stop('SIGTERM'))
