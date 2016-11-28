import {SakuraApi} from './sakura-api';

export class RouteHandler {
  private api: SakuraApi;

  constructor() {
    this.api = SakuraApi.instance;
  }

  route(routable: any) {

  }

}
