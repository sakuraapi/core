import {routableSymbols} from './@routable/routable';
import {SakuraApiConfig} from '../boot/sakura-api-config';
import {SakuraMongoDbConnection} from './sakura-mongo-db-connection';
import * as colors from 'colors';
import * as express from 'express';
import * as http from 'http';

/**
 * A set of properties defining the configuration of the server.
 */
export interface ServerConfig {
  /**
   * An Express compatible address for the server to bind to.
   */
  address?: string;
  /**
   * An Express compatible port for the server to bind to.
   */
  port?: number;
  /**
   * A message that you'd like printed to the screen when the server is started.
   */
  bootMessage?: string;
}

/**
 * SakuraApi is responsible for:
 * 1. Instantiating Express.js.
 * 2. Loading the server's configuration via [[SakuraApiConfig]]
 * 3. Taking routes from `@Routable` decorated classes ([[Routable]]) and binding those routes to Express.
 * 4. Starting and stopping the server.
 *
 * SakuraApi is a singleton, so all you have to do is use [[SakuraApi.instance]] to get access to the server's instance.
 * This is important, but the `@Routable` classes and be auto binding their routes to Express and you'll want a way to get
 * a reference to the same instance of SakuraApi that they used.
 *
 * ### Example
 * <pre>
 * import {SakuraApi}       from 'sakuraapi';
 * import                   './model/user';
 * import                   'colors';
 * import * as bodyParser   from 'body-parser'
 *
 * (function boot() {
 *    let sapi = SakuraApi.instance;
 *
 *    sapi.addMiddleware(bodyParser.json());
 *
 *    sapi
 *     .listen()
 *     .catch((err) => {
 *       console.log(`Error: ${err}`.red);
 *     });
 * })();
 * </pre>
 *
 * This example assumes you have a class called `User` that is decorated with [[Routable]]. You import that module
 * even though you're not going to use it do that it kicks off the `@Routable` bootstrapping.
 */
export class SakuraApi {

  private static _instance: SakuraApi;

  private _address: string = '127.0.0.1';
  private _app: express.Express;
  private _config: any;
  private _port: number = 3000;
  private _server: http.Server;
  private _dbConnections: SakuraMongoDbConnection;
  private routes = [];

  /**
   * SakuraApi is a singleton. You get a reference to the instance with [[SakuraApi.instance]].
   */
  static get instance(): SakuraApi {
    if (!this._instance) {
      this._instance = new SakuraApi();
    }
    return this._instance;
  }

  /**
   * Sets the baseUri for the entire application.
   *
   * ### Example
   * <pre>
   * SakuraApi.instance.baseUri = 'api';
   * </pre>
   *
   * This will cause SakuraApi to expect all routes to have `api` at their base (e.g., `http://localhost:8080/api/user`).
   */
  baseUri = '/';

  /**
   * Returns the address of the server as a string.
   */
  get address(): string {
    return this._address;
  }

  /**
   * Returns an reference to SakuraApi's instance of Express.
   */
  get app(): express.Express {
    return this._app;
  }

  /**
   * Returns an instance of the Config that was automatically loaded during SakuraApi's instantiation using [[SakuraApiConfig.load]].
   * You can also set the instance, but keep in mind that you should probably do this before calling [[SakuraApi.listen]].
   */
  get config(): any {
    return this._config;
  }

  set config(config: any) {
    this._config = config;
  }

  /**
   * The [[SakuraMongoDbConnection]] instance that was created when [[SakuraApi]] instantiated if
   * the "dbConnections" property was found in the config with the proper configuration options set, or
   * if [[SakuraApi.instantiate]] was used to instantiate the [[SakuraApi]] singleton and the
   * [[SakuraMongoDbConnection]] was manually provided.
   */
  get dbConnections(): SakuraMongoDbConnection {
    return this._dbConnections;
  }

  /**
   * Returns the port the server is listening on.
   */
  get port(): number {
    return this._port;
  }

  /**
   * Returns a reference to the `http.Server` that SakuraApi is using.
   */
  get server(): http.Server {
    return this._server;
  }

  private constructor(app?: express.Express, config?: any, dbConfig?: SakuraMongoDbConnection) {
    if (!app) {
      app = express();
    }

    if (!config) {
      config = new SakuraApiConfig().load() || {};
    }

    if (!dbConfig) {
      this._dbConnections = SakuraApiConfig.dataSources(config);
    }

    this._app = app;
    this._server = http.createServer(this.app);

    this.config = config;
    this._address = (this.config.server || {}).address || this._address;
    this._port = (this.config.server || {}).port || this._port;
  }

  /**
   * A static helper method to make it easier to add middleware. See [[SakuraApi]] for an example of its use. You could also
   * use [[SakuraApi.app]] to get a reference to Express then add your middleware with that reference directly.
   *
   * This uses `express.use(...)` internally.
   */
  static addMiddleware(fn: (req: express.Request, res: express.Response, next: express.NextFunction) => void) {
    SakuraApi.instance.app.use(fn);
  }

  /**
   * A helper method to make it easier to add middleware. See [[SakuraApi]] for an example of its use. You could also
   * use [[SakuraApi.app]] to get a reference to Express then add your middleware with that reference directly.
   *
   * This uses `express.use(...)` internally.
   */
  addMiddleware(fn: (req: express.Request, res: express.Response, next: express.NextFunction) => void) {
    SakuraApi.addMiddleware(fn);
  }

  /**
   * Gracefully shuts down the server. It will not reject if the server is not running. It will, however, reject
   * with any error other than `Not running` that's returned from the `http.Server` instance.
   */
  close(): Promise<null> {
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

  /**
   * Manually instantiate the [[SakuraApi]] singleton with your own `express.Express` and [[SakuraApiConfig]].
   * If either parameter is null or undefined, then the defaults are used as if you can called
   * [[SakuraApi.instance]]. Note that you can only call this if the [[SakuraApi]] singleton has not already been
   * instantiated. Otherwise, it will throw `new Error('ALREADY_INSTANTIATED')`.
   */
  static instantiate(app?: express.Express, config?: SakuraApiConfig, dbConfig?: SakuraMongoDbConnection): SakuraApi {
    if (this._instance) {
      throw new Error('ALREADY_INSTANTIATED');
    }
    this._instance = new SakuraApi(app, config);
    return this.instance;
  }

  /**
   * Starts the server. You can override the settings loaded by [[SakuraApiConfig]] by passing in
   * an object that implements [[ServerConfig]].
   *
   * Connects to all the DB connections (if any) defined in [[SakuraApi.dbConnections]]. These are loaded
   * by [[SakuraApiConfig.dataSources]]. If you do not provide a "dbConnections" property in your config, or if you
   * did not instantiate SakuraApi manually with [[SakuraApi.instiate]] with a [[SakuraMongoDbConnection]] that
   * you constructed elsewhere, then no DB connections will be opened. You can also user [[SakuraMongoDbConnection.connect]]
   * to manually define Db connections.
   */
  listen(listenProperties?: ServerConfig): Promise<null> {
    listenProperties = listenProperties || {};

    return new Promise((resolve, reject) => {
      this._address = listenProperties.address || this._address;
      this._port = listenProperties.port || this._port;

      // Bind the routes
      let router = express.Router();
      this
        .routes
        .forEach((route) => {
          router[route.httpMethod](route.path, route.f);
        });

      this.app.use(this.baseUri, router);

      // Open the connections
      if (this.dbConnections) {
        this
          .dbConnections
          .connectAll()
          .then(() => {
            listen.bind(this)();
          })
          .catch((err) => {
            return reject(err);
          })
      } else {
        listen.bind(this)();
      }

      // Start the server
      function listen() {
        this
          .server
          .listen(this.port, this.address, (err) => {
            if (err) {
              return reject(err);
            }
            let msg = listenProperties.bootMessage || `SakuraAPI started on: ${this.address}:${this.port}`;
            console.log(colors.green(msg));
            return resolve();
          });
      }

      // Release the Kraken.
    });
  }

  /**
   * Primarily used internally by [[Routable]] during bootstrapping. However, if an `@Routable` class has [[RoutableClassOptions.autoRoute]]
   * set to false, the integrator will have to pass that `@Routable` class in to this method manually if he wants to routes to be
   * bound.
   */
  route(target: any) {
    if (!target[routableSymbols.sakuraApiClassRoutes]) {
      return;
    }

    target
      [routableSymbols.sakuraApiClassRoutes]
      .forEach((route) => {
        this.routes.push(route);
      });
  }
}
