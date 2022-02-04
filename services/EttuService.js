const axios = require('axios');

class EttuService {

  /**
   * @param {string} apiKey 
   */
  constructor(apiKey) {
    this.apiKey = apiKey

    /**
     * @private
     * @type {EttuRoute[]|null}
     */
    this.routes = null;

    /**
     * @private
     * @type {EttuPoint[]|null}
     */
    this.points = null;
  }

  /**
   * @returns {Promise}
   */
  init() {
    return new Promise((resolve, reject) => {
      Promise.all([this.loadTramRoutes(), this.loadTramPoints()])
        .then((results) => {
          this.routes = results[0]
          this.points = results[1]
          resolve()
        })
        .catch((err) => {
          reject(err)
        })
        .then(() => {
          // always executed
        })
    })
  }

  /**
   * @returns {string[]}
   */
  getRoutesNums() {
    if (!this.routes) {
      throw new Error('Service not initialized')
    }
    return this.routes.map((route) => route.num).sort((a, b) => a - b)
  }

  /**
   * @returns {EttuPoint[]}
   */
  getPoints() {
    if (!this.points) {
      throw new Error('Service not initialized')
    }
    return this.points
  }

  /**
   * @param {'tram'|'troll'} vehicleType 
   * @param {'boards'|'routes'|'points'} dataType 
   * @param {'vehicles'|'routes'|'points'} dataField
   * @param {object} urlParams
   * @returns {Promise}
   */
  ettuCall(vehicleType, dataType, dataField, urlParams = {}) {
    return new Promise((resolve, reject) => {
      const url = axios.getUri({
        method: 'get',
        url: `http://map.ettu.ru/api/v2/${vehicleType}/${dataType}/`,
        params: {
          ...urlParams,
          apiKey: this.apiKey,
        },
      })

      axios.get(url)
        .then((res) => {
          const err = res.data.error
          if (err.code !== 0) {
            throw new Error(`Error ${err.code}: can not load ${vehicleType}/${dataType}: ${err.msg}`)
          }

          resolve(res.data[dataField])
        })
        .catch((err) => {
          reject(err)
        })
    })
  }

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

  /**
   * Current positions of all vehicles
   * 
   * @returns {Promise<EttuVehicle[]>}
   */
  getTramBoards() {
    return this.ettuCall('tram', 'boards', 'vehicles', { order: 1 })
  }

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
   * @private
   * @returns {Promise<EttuRoute[]>}
   */
  loadTramRoutes() {
    return this.ettuCall('tram', 'routes', 'routes')
  }

  /**
   * @param {string} routeNum 
   * @returns {EttuRoute[]}
   */
  getRoutes(routeNum = null) {
    if (!routeNum) {
      return this.routes
    }

    return this.routes.filter((x) => x.num === routeNum)
  }

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
   * @private
   * @returns {Promise<EttuPoint[]>}
   */
  loadTramPoints() {
    return this.ettuCall('tram', 'points', 'points')
  }
}

module.exports = EttuService
