const axios = require('axios');

interface EttuVehicle {
  ATIME: string;
  DEV_ID: string;
  LAT: string;
  LON: string;
  ROUTE: string;
  COURSE: string;
  VELOCITY: string;
  ON_ROUTE: string;
  LAYER: string;
  BOARD_ID: string;
  BOARD_NUM: string;
  DEPOT: string;
}

interface EttuRouteElement {
  duration_plan: string;
  from: { id: string; name: string; };
  full_path: string[];
  id: string;
  ind: string;
  kind: string;
  len: string;
  len_plan: string;
  mnemo: string;
  name: string;
  path: string[];
  to: { id: string; name: string; };
}

export interface EttuRoute {
  elements: EttuRouteElement[];
  end_stations: { id: string; mnemo: string; name: string; }[];
  id: string;
  name: string;
  num: string;
}

export interface EttuPoint {
  ID: string;
  NAME: string;
  NOTE: string;
  STATUS: string;
  X: string;
  Y: string;
  ATTACHED_TO: string | null | undefined;
  SMS_CODE: string;
  ANGLE: string;
  ALIGN: string;
  TTU_CODE: string;
  DIRECTION: string;
  TR_LAYER: string;
  TTU_IDS: string;
  LONGITUDE: string;
  LATITUDE: string;
  LAT: string;
  LON: string;
  ACCURACY: string;
}

class EttuService {
  apiKey: string;
  routes: EttuRoute[] | null;
  points: EttuPoint[] | null;

  /**
   * @param {string} apiKey 
   */
  constructor() {
    if (!process.env.ETTU_API_KEY) {
      throw new Error('No ETTU_API_KEY in .env')
    }

    this.apiKey = process.env.ETTU_API_KEY
    this.routes = null;
    this.points = null;
  }

  init(): Promise<void> {
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
    })
  }

  getRoutesNums(): string[] {
    if (!this.routes) {
      throw new Error('Service not initialized')
    }

    return this.routes.map((route) => route.num).sort((a, b) => Number(a) - Number(b))
  }

  getPoints(): EttuPoint[] {
    if (!this.points) {
      throw new Error('Service not initialized')
    }
    return this.points
  }

  ettuCall(vehicleType: 'tram' | 'troll', dataType: 'boards' | 'routes' | 'points', dataField: 'vehicles' | 'routes' | 'points', urlParams: object = {}): Promise<any> {
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
        .then((res: { data: { [x: string]: any; error: any; }; }) => {
          const err = res.data.error
          if (err.code !== 0) {
            throw new Error(`Error ${err.code}: can not load ${vehicleType}/${dataType}: ${err.msg}`)
          }

          resolve(res.data[dataField])
        })
        .catch((err: any) => {
          reject(err)
        })
    })
  }

  getTramBoards(): Promise<EttuVehicle[]> {
    return this.ettuCall('tram', 'boards', 'vehicles', { order: 1 })
  }

  loadTramRoutes(): Promise<EttuRoute[]> {
    return this.ettuCall('tram', 'routes', 'routes')
  }

  getRoutes(routeNum: string | null = null): EttuRoute[] {
    if (!this.routes) {
      throw new Error('Service not initialized')
    }

    if (!routeNum) {
      return this.routes
    }

    return this.routes.filter((x) => x.num === routeNum)
  }

  loadTramPoints(): Promise<EttuPoint[]> {
    return this.ettuCall('tram', 'points', 'points')
  }
}

export { EttuService }
