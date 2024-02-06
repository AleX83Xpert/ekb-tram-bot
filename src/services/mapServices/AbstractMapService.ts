import { EttuPoint, EttuRoute } from "../EttuService"

export interface TGenerateMapUrlOptions {
  vehiclesLocations: { lat: number; lon: number; course: number }[]
  askedRouteStr: string
  askedRoutes: EttuRoute[]
  points: EttuPoint[]
  imageWidth: number
  imageHeight: number
}

class AbstractMapService {

  constructor(config: object|null|undefined = null) {
  }

  generateMapUrl(options: TGenerateMapUrlOptions): string {
    throw new Error('Please do not use the abstract class')
  }
}

export { AbstractMapService }
