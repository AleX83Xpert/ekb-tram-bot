const mbxStatic = require('@mapbox/mapbox-sdk/services/static')
const { moveTo } = require('geolocation-utils')
const AbstractMapService = require('./AbstractMapService')

const EARTH_RADIUS = 6378137 // Earth's radius in meters

/**
 * @typedef {Object} TMapBoxServiceConfig
 * @property {string} accessToken
 */

class MapBoxService extends AbstractMapService {
  
  /**
   * @param {TMapBoxServiceConfig} config 
   */
  constructor(config) {
    super()
    this.client = mbxStatic({ accessToken: config.accessToken })
  }

  radToDeg(rad) {
    return rad * 180 / Math.PI
  }

  degToRad(deg) {
    return deg * Math.PI / 180
  }

  /**
   * @typedef {Object} TGenerateMapUrlOptions
   * @property {{lat:Number, lon: Number, course: Number}} vehiclesLocations 
   * @property {string} askedRouteStr
   * @property {EttuRoute[]} askedRoutes
   * @property {EttuPoint[]} points
   * @property {number} imageWidth
   * @property {number} imageHeight
   */

  /**
   * @param {TGenerateMapUrlOptions} options
   * @returns {string}
   */
  generateMapUrl(options) {
    const { vehiclesLocations, askedRouteStr, askedRoutes, points, imageWidth = '1024', imageHeight = '1024' } = options

    var params = new URLSearchParams();
    params.append('access_token', this.accessToken)

    // Polar coordinates related to [0, 0]
    // [distance, heading]
    const markerPoints = [
      [75, 0],
      [50, 45],
      [50, 135],
      [50, -135],
      [50, -45],
    ]
    
    const vehiclesMarkers = vehiclesLocations.reduce(
        (acc, { lon, lat, course }) => {
          const rotatedMarkerPointsCoordinates = markerPoints.map(([distance, heading]) => {
            const { lon: newLon, lat: newLat } = moveTo({ lon, lat }, { distance, heading: heading + 90 + course })

            return [newLon, newLat]
          })

          return [
            ...acc,
            // {
            //   marker: {
            //     coordinates: [lon, lat],
            //     size: 'small',
            //     label: askedRouteStr,
            //     color: '#f00',
            //   },
            // },
            {
              /**
               * @see https://github.com/mapbox/mapbox-sdk-js/blob/main/docs/services.md#pathoverlay
               */
              path: {
                coordinates: rotatedMarkerPointsCoordinates,
                strokeWidth: 2,
                strokeColor: '#000',
                strokeOpacity: 1,
                fillColor: '#fc6100',
                fillOpacity: 1,
              },
            },
          ]
        },
        []
      )

    // add routes polylines
    const paths = []
    askedRoutes.forEach((askedRoute) => {
      askedRoute.elements.forEach((element, elementKey) => {
        const coordinates = []
        element.full_path.forEach((pointId) => {
          const filteredPoints = points.filter((x) => x.ID === String(pointId))
          if (filteredPoints.length > 0) {
            const point = filteredPoints[0]
            coordinates.push([Number(point.LON), Number(point.LAT)])
          }
        })
        paths.push({ path: { coordinates, strokeColor: '#f00', strokeWidth: 1 } })
      })
    })

    /**
     * @see {https://github.com/mapbox/mapbox-sdk-js/blob/main/services/static.js}
     */
    const request = this.client.getStaticImage({
      ownerId: 'mapbox',
      styleId: 'streets-v12',
      width: imageWidth,
      height: imageHeight,
      position: 'auto',
      highRes: true,
      overlays: [
        ...paths,
        ...vehiclesMarkers,
      ],
    })

    return request.url()
  }
}

module.exports = MapBoxService
