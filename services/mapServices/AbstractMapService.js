class AbstractMapService {
  /**
   * @param {object} config 
   */
  constructor(config) {
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
    throw new Error('Please do not use the abstract class')
  }
}

module.exports = AbstractMapService
