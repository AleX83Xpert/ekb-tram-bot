const axios = require('axios');
const geoUtils = require('geolocation-utils')

class MapService {
  /**
   * @param {string} mapQuestKey 
   */
  constructor(mapQuestKey) {
    this.mapQuestKey = mapQuestKey
  }

  /**
   * @param {{lat:Number, lon: Number, course: Number}} vehiclesLocations 
   * @param {string} askedRouteStr
   * @param {EttuRoute[]} askedRoutes
   * @param {EttuPoint[]} points
   * 
   * @returns {string}
   */
  generateMapUrl(vehiclesLocations, askedRouteStr, askedRoutes, points, size = '1024,1024') {
    var params = new URLSearchParams();
    params.append('key', this.mapQuestKey)
    params.append(
      'locations',
      vehiclesLocations.map(
        ({ lon, lat, course }) => {
          const coursePointLocation = geoUtils.moveTo({ lat, lon }, { distance: 150, heading: course + 90 })

          return `${lat},${lon}||${coursePointLocation.lat},${coursePointLocation.lon}|via-sm`
        }
      ).join('||')
    )
    params.append('size', size)
    params.append('format', 'jpg90')
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

    return axios.getUri({
      method: 'post',
      url: 'https://open.mapquestapi.com/staticmap/v5/map',
      params: params,
    })
  }
}

module.exports = MapService
