import { moveTo, getBoundingBox } from 'geolocation-utils'
import { AbstractMapService, TGenerateMapUrlOptions } from './AbstractMapService'

interface TMapQuestServiceConfig {
  key: string
}

class MapQuestService extends AbstractMapService {
  key: string

  constructor(config: TMapQuestServiceConfig) {
    super()
    this.key = config.key
  }

  generateMapUrl(options: TGenerateMapUrlOptions): string {
    const { vehiclesLocations, askedRouteStr, askedRoutes, points, imageWidth = '1024', imageHeight = '1024' } = options

    var params = new URLSearchParams();
    params.append('key', this.key)
    params.append(
      'locations',
      vehiclesLocations.map(
        ({ lon, lat, course }) => {
          const coursePointLocation = moveTo({ lat, lon }, { distance: 150, heading: course + 90 })

          return `${lat},${lon}||${coursePointLocation.lat},${coursePointLocation.lon}|via-sm`
        }
      ).join('||')
    )
    params.append('size', `${imageWidth},${imageHeight}`)
    params.append('format', 'jpg90')
    params.append('defaultMarker', `circle-${askedRouteStr}`)

    // add routes polylines
    const routesPoints: { latitude: number, longitude: number }[] = []
    askedRoutes.forEach((askedRoute) => {
      askedRoute.elements.forEach((element, elementKey) => {
        const polyLine: string[] = []
        element.full_path.forEach((pointId) => {
          const filteredPoints = points.filter((x) => x.ID === String(pointId))
          if (filteredPoints.length > 0) {
            const point = filteredPoints[0]
            polyLine.push(`${point.LAT},${point.LON}`)
            routesPoints.push({ latitude: Number(point.LAT), longitude: Number(point.LON) })
          }
        })
        params.append('shape', polyLine.join('|'))
      })
    })

    const box = getBoundingBox(routesPoints, 0)

    const lons = [box.topLeft.longitude, box.bottomRight.longitude]
    const lats = [box.topLeft.latitude, box.bottomRight.latitude]

    const boxData = [
      Math.max(...lats),
      Math.min(...lons),
      Math.min(...lats),
      Math.max(...lons),
    ]

    params.append('boundingBox', boxData.join(','))

    return `https://mapquestapi.com/staticmap/v5/map?${params.toString()}`
  }
}

export { MapQuestService }
