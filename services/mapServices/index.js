const MapBoxService = require("./MapBoxService")
const MapQuestService = require("./MapQuestService")

let MapService

switch (process.env.MAP_SERVICE) {
  case 'MAPQUEST':
    MapService = MapQuestService
    break

  case 'MAPBOX':
    MapService = MapBoxService
    break

  default:
    throw new Error('Please set the `MAP_SERVICE` env variable (MAPQUEST | MAPBOX)')
}

module.exports = MapService
