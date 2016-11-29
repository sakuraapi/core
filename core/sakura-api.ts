import {SakuraApiConfig} from '../boot/config';
import * as colors       from 'colors';
import * as express      from 'express';
import * as http         from 'http';
import forEach = require("lodash/forEach");

export class ServerConfig {
  constructor(public address?: string,
              public port?: number,
              public bootMessage?: string) {
  }
}

export class SakuraApi {

  private static _instance: SakuraApi;

  private _address: string = '127.0.0.1';
  private _app: express.Express;
  private _port: number = 3000;
  private _server: http.Server;

  config: any;

  static get instance(): SakuraApi {
    if (!this._instance) {
      this._instance = new SakuraApi(express());
    }
    return this._instance;
  }

  get address(): string {
    return this._address;
  }

  get app(): express.Express {
    return this._app;
  }

  get port(): number {
    return this._port;
  }

  get server(): http.Server {
    return this._server;
  }

  private constructor(app: express.Express) {
    if (!app) {
      throw new Error('cannot instantiate a new SakuraApi without providing an Express object');
    }

    this._app = app;
    this._server = http.createServer(this.app);

    this.config = new SakuraApiConfig().load() || {};
    this._address = (this.config.server || {}).address || this._address;
    this._port = (this.config.server || {}).port || this._port;
  }

  close() {
    return new Promise((resolve, reject) => {
      this
        .server
        .close((err) => {
          if (err && err.message !== 'Not running') {
            return reject(err);
          }
          resolve();
        });
    });
  }

  listen(listenProperties?: ServerConfig): Promise<null> {
    listenProperties = listenProperties || {};

    return new Promise((resolve, reject) => {
      this._address = listenProperties.address || this._address;
      this._port = listenProperties.port || this._port;

      this
        .server
        .listen(this.port, this.address, (err) => {
          if (err) {
            return reject(err);
          }
          let msg = listenProperties.bootMessage || `SakuraAPI started on: ${this.address}:${this.port}`;
          console.log(colors.green(msg));
          resolve();
        });
    });
  }

  route(target: any) {
    if (!target.sakuraApiClassRoutes) {
      return;
    }
    
    target
      .sakuraApiClassRoutes
      .forEach((route) => {
        this.app[route.httpMethod](route.path, route.f);
      });
  }
}
