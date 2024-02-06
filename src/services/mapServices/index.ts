import { MapBoxService } from './MapBoxService'
import { MapQuestService } from './MapQuestService'

export type MapServiceType = MapBoxService | MapQuestService

function createMapService(): MapServiceType {
  let mapService: MapServiceType

  if (!process.env.MAP_SERVICE) {
    throw new Error('No MAP_SERVICE in .env')
  }

  if (!process.env.MAP_SERVICE_CONFIG) {
    throw new Error('No MAP_SERVICE_CONFIG in .env')
  }

  switch (process.env.MAP_SERVICE) {
    case 'MAPQUEST':
      mapService = new MapQuestService(JSON.parse(process.env.MAP_SERVICE_CONFIG))
      break

    case 'MAPBOX':
      mapService = new MapBoxService(JSON.parse(process.env.MAP_SERVICE_CONFIG))
      break

    default:
      throw new Error('Please set the `MAP_SERVICE` env variable (MAPQUEST | MAPBOX)')
  }

  return mapService
}

export { createMapService }
