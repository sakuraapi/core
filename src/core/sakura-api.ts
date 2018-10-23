// tslint:disable:no-duplicate-imports
import * as colors from 'colors';
import * as debugInit from 'debug';
import * as express from 'express';
import { ErrorRequestHandler, Express, Handler, NextFunction, Request, Response, Router } from 'express';
import * as http from 'http';
import { Observable, Subject } from 'rxjs';
import { SakuraApiConfig } from '../boot';
import { injectableSymbols, ProviderNotRegistered, ProvidersMustBeDecoratedWithInjectableError } from './';
import { ModelNotRegistered, ModelsMustBeDecoratedWithModelError, modelSymbols } from './@model';
import {
  IRoutableLocals,
  ISakuraApiClassRoute,
  RoutableNotRegistered,
  RoutablesMustBeDecoratedWithRoutableError,
  routableSymbols
} from './@routable';
import { BAD_REQUEST, OK } from './lib';
import {
  Anonymous,
  AuthenticatorNotRegistered,
  AuthenticatorPluginResult,
  authenticatorPluginSymbols,
  AuthenticatorsMustBeDecoratedWithAuthenticatorPluginError,
  IAuthenticator,
  IAuthenticatorConstructor,
  SakuraApiPlugin,
  SakuraApiPluginResult
} from './plugins';
import { SakuraMongoDbConnection } from './sakura-mongo-db-connection';
// tslint:enable:no-duplicate-imports

const debug = {
  authenticators: debugInit('sapi:authenticators'),
  models: debugInit('sapi:models'),
  normal: debugInit('sapi:SakuraApi'),
  providers: debugInit('sapi:providers'),
  routables: debugInit('sapi:routables'),
  route: debugInit('sapi:route')
};

export class DependencyAlreadyInjectedError extends Error {
  constructor(type: string, name: string) {
    super(`${type} ${name} already registered - if you are getting this during testing, make sure` +
      ` you call SakuraApi.deregisterDependencies() after you are done using each instantiation of SakuraApi. If` +
      ` you are getting this error launching a SakuraApi application, you have double registerd ${name}.`);
  }
}

/**
 * Used for [[SakuraApi]] constructor
 */
export interface SakuraApiOptions {
  /**
   * Optionally allows you to provide your own instantiated Express app... if you're into that kind of thing.
   */
  app?: Express;
  /**
   * Optionally sets [[SakuraApiConfig]] manually, otherwise, the configuration will be loaded automatically.
   */
  config?: any;
  /**
   * Allows the configuration file location to be overridden. By default [[SakuraApiConfig]] looks for
   * `config/environment.json`.
   */
  configPath?: any;
  /**
   * Optionally sets [[SakuraMongoDbConnection]], otherwise, the configuration will be loaded automatically.
   */
  dbConfig?: SakuraMongoDbConnection;
  /**
   * An array of objects that are decorated with @[[Injectable]]. Alternatively, for testing purposes, an Injectable can be
   * mocked by passing in the following object literal:
   * <pre>
   *   {
   *      use: SomeMockInjectable,
   *      for: TheInjectableBeingReplacedByTheMock
   *   }
   * </pre>
   */
  providers?: any[];
  /**
   * An array of objects that are decorated with @[[Model]]. Alternatively, for testing purposes, a Model can be
   * mocked by passing in the following object literal:
   * <pre>
   *   {
   *      use: SomeMockModel,
   *      for: TheModelBeingReplacedByTheMock
   *   }
   * </pre>
   */
  models: any[];
  /**
   * An array of objects that are decorated with @[[Routable]]. Alternatively, for testing purposes, a Routable can be
   * mocked by passing in the following object literal:
   * <pre>
   *   {
   *      use: SomeMockRoutable,
   *      for: TheRoutableBeingReplacedByTheMock
   *   }
   * </pre>
   */
  routables: any[];
  /**
   * Takes an array of [[SakuraApiModule]]s, or an empty array. This is how you add a module to SakuraApi. A module
   * adds Routable and Module classes; they're usually a set of add-on functionality that either you or a third-party
   * have defined. For example, `auth-native-authority` is a SakuraApi Module.
   */
  plugins?: SakuraApiPlugin[];
  /**
   * Sets the baseUrl for the entire application.
   *
   * ### Example
   * <pre>
   * sakuraApi.baseUrl = '/api';
   * </pre>
   *
   * This will cause SakuraApi to expect all routes to have `api` at their base (e.g.,
   * `http://localhost:8080/api/user`).
   */
  baseUrl?: string;

  /**
   * Optionally allows you to suppress the injection of the Anonymous Authenticator. If no authentication
   * plugins are provided, this is suppressed regardless since the Authenticator would serve no purpose. In that
   * case, passing [[Anonymous]] into [[Routable]] or [[Route]] has no effect.
   */
  suppressAnonymousAuthenticatorInjection?: boolean;

  /**
   * Disabled by default. If enabled, attempting to register a model, routable or provider for DI that's already been
   * registered with any instance of SakuraApi will throw the DependencyAlreadyInjectedError. This option is provided
   * for diagnostic purposes.
   */
  throwDependencyAlreadyInjectedError?: boolean;
}

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

interface IProviderContainer {
  target: any;
  instance: any;
}

/**
 * @outdatedDoc
 *
 * SakuraApi is responsible for:
 * 1. Instantiating Express.js.
 * 2. Loading the server's configuration via [[SakuraApiConfig]]
 * 3. Taking routes from `@Routable` decorated classes ([[Routable]]) and binding those routes to Express.
 * 4. Starting and stopping the server.
 *
 * You'll want to instantiate SakuraApi and export SakuraApi then import that to anywhere that requires a reference
 * to that instance (for example [[Model]] or [[Routable]]).
 *
 * ### Example
 * <pre>
 * import {SakuraApi}       from 'sakuraapi';
 * import                   './model/user';
 * import                   'colors';
 * import * as bodyParser   from 'body-parser'
 *
 * export const sapi = new SakuraApi();
 *
 * class Server {
 *
 *    constructor() {}
 *
 *    start() {
 *        sapi.addMiddleware(bodyParser.json());
 *        sapi
 *          .listen()
 *          .catch((err) => {
 *            console.log(`Error: ${err}`.red);
 *          });
 *    }
 * }
 *
 * new Server().start();
 * </pre>
 *
 * This example assumes you have a class called `User` that is decorated with [[Routable]]. You import that module
 * even though you're not going to use it do that it kicks off the `@Routable` bootstrapping.
 */
export class SakuraApi {

  /**
   * If implemented, `onAuthenticationError` will be called if there's [[AuthenticatorPluginResult]] status === false
   * returned. Implement this to add logging and/or override the values of `authResult` (specifically status and
   * data), to change what will be returned to the client.
   *
   * `AuthenticatorPluginResult`: [[AuthenticatorPluginResult]]
   * `authenticatorName`: the name of the first authenticator constructor function that failed the user's authentication.
   */
  onAuthenticationError: (req: Request, res: Response, authResult?: AuthenticatorPluginResult,
                          authenticatorName?: string) => Promise<AuthenticatorPluginResult>;

  /**
   * If implemented, `onAuthenticationFatalError` will be called if during authentication there's an unexpected,
   * and therefore fatal, error. The default behavior if not implemented is for SakuraApi to return an generic 500
   * { error: 'SERVER_ERROR' }.
   *
   * You can return null/void to leave the default behavior alone or return an object with `{data: any, status:number}`
   * to provide your own values.
   */
  onAuthenticationFatalError: (req: Request, res: Response, err: Error,
                               authenticatorName?: string) => Promise<{ data: any, status: number } | void | null>;

  /**
   * If implemented, `onAuthenticationSuccess` will be called if there's [[AuthenticatorPluginResult]] status === true
   * returned. Implement this to add logging and/or override the values of `authResult` (specifically status and
   * data), to change what will be returned to the client.
   *
   * `AuthenticatorPluginResult`: [[AuthenticatorPluginResult]]
   * `authenticatorName`: the name of the authenticator constructor function that succeeded the user's authentication.
   */
  onAuthenticationSuccess: (req: Request, res: Response, authResult?: AuthenticatorPluginResult,
                            authenticatorName?: string) => Promise<AuthenticatorPluginResult>;


  private _address: string = '127.0.0.1';
  private _app: Express;
  private _baseUrl;
  private _config: any;
  private _dbConnections: SakuraMongoDbConnection;
  private _port: number = 3000;
  private _server: http.Server;

  private authenticators = new Map<string, IAuthenticator>();
  private lastErrorHandlers: ErrorRequestHandler[] = [];
  private listenCalled = false;
  private middlewareHandlers: { [key: number]: Handler[] } = {};
  private models = new Map<string, any>();
  private providers = new Map<string, IProviderContainer>();
  private routables = new Map<string, any>();
  private routeQueue = new Map<string, ISakuraApiClassRoute>();
  private throwDependencyAlreadyInjectedError = false;

  // emitters
  private closed$ = new Subject<void>();
  private listening$ = new Subject<void>();

  /**
   * Returns the address of the server as a string.
   */
  get address(): string {
    return this._address;
  }

  /**
   * Returns an reference to SakuraApi's instance of Express.
   */
  get app(): Express {
    return this._app;
  }

  /**
   * Returns the base URL for this instance of SakuraApi. The Base URL is prepended to all [[Routable]]
   * apis.
   */
  get baseUrl(): string {
    return this._baseUrl;
  }

  /**
   * Emits when [[SakuraApi.close]] is called and completed.
   */
  get closed(): Observable<void> {
    return this.closed$.asObservable();
  }

  /**
   * Returns an instance of the Config that was automatically loaded during SakuraApi's instantiation using
   * [[SakuraApiConfig.load]]. You can also set the instance, but keep in mind that you should probably do this before
   * calling [[SakuraApi.listen]].
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
   * Emits when [[SakuraApi.listen]] is called and completed.
   */
  get listening(): Observable<void> {
    return this.listening$.asObservable();
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

  constructor(options: SakuraApiOptions) {
    debug.normal('.constructor started');

    this._baseUrl = options.baseUrl || '/';

    this.config = (!options.config)
      ? new SakuraApiConfig().load(options.configPath) || {}
      : options.config;

    this._dbConnections = (options.dbConfig)
      ? this._dbConnections = options.dbConfig
      : this._dbConnections = SakuraApiConfig.dataSources(this.config);

    this._app = options.app || express();
    this._server = http.createServer(this.app);

    this._address = (this.config.server || {}).address || this._address;
    this._port = (this.config.server || {}).port || this._port;

    this.throwDependencyAlreadyInjectedError = options.throwDependencyAlreadyInjectedError || false;

    this.registerProviders(options);
    this.registerPlugins(options);
    this.registerModels(options);
    this.registerRoutables(options);

    debug.normal('.constructor done');
  }

  /**
   * Adds middleware grouped by option ordering. See [[SakuraApi]] for an example of its use. You could also
   * use [[SakuraApi.app]] to get a reference to Express then add your middleware with that reference directly, but that
   * would not support ordering. Default order group is 0. When handlers are added, they're added by their order
   * (least to highest), and in then in the order that `addMiddleware` was called.
   *
   * This uses `express.use(...)` internally.
   *
   * @param fn the handler function being added
   * @param order The priority in which the route should be added. Routes are added in groups by their order, and then
   * by the order in which they were added. So, for example, if you add routes [A, B, C] with an order of 0, they'll
   * be added [A, B, C] to the router. As another example, if you Add C to 0 and [A, B] to 1, then Z to 0, the handlers
   * will be added: [C, Z, A, B].
   */
  addMiddleware(fn: Handler, order: number = 0): void {
    debug.normal(`.addMiddleware called: '${(fn || {} as any).name}', order: ${order}`);

    if (!fn) {
      debug.normal(`handler rejected because it's null or undefined`);
      return;
    }

    if (!this.middlewareHandlers[order]) {
      this.middlewareHandlers[order] = [];
    }

    this.middlewareHandlers[order].push(fn);
  }

  /**
   *
   * @param {e.ErrorRequestHandler} fn
   */
  addLastErrorHandlers(fn: ErrorRequestHandler): void {
    debug.normal('.addMiddleware called');
    this.lastErrorHandlers.push(fn);
  }

  /**
   * Gracefully shuts down the server. This includes calling [[SakuraApi.deregisterDependencies]]
   * and [[SakuraApi.dbConnections.closeAll]].
   *
   * It will not reject if the server is not running. It will, however, reject
   * with any error other than `Not running` that's returned from the `http.Server` instance.
   */
  async close(): Promise<void> {
    debug.normal('.close called');

    try {
      this.deregisterDependencies();
      await this.dbConnections.closeAll();
    } catch (err) {
      debug.normal(`.close error`, err);
      this.closed$.next();
      return Promise.reject(err);
    }

    return new Promise<void>((resolve, reject) => {
      this.server.close((err) => {
        if (err && err.message !== 'Not running') {
          debug.normal(`.close error`, err);
          this.closed$.next();
          reject(err);
          return;
        }

        debug.normal('.close done');
        this.closed$.next();
        resolve();
      });
    });
  }

  /**
   * Removes SakuraApi initialization from injected [[Model]]s, [[Routable]]s, and [[Injectable]]s. To reuse these
   * dependencies, a new instance of SakuraApi needs to be instantiated.
   */
  deregisterDependencies() {
    const modelKeys = (this.models) ? this.models.keys() : [];
    for (const key of modelKeys) {
      const model = this.models.get(key);
      model[modelSymbols.sapi] = null;
      this.models.delete(key);
    }

    const providerKeys = (this.providers) ? this.providers.keys() : [];
    for (const key of providerKeys) {
      const provider = this.providers.get(key);
      if (provider.target) {
        provider.target[injectableSymbols.sapi] = null;
      }
      if (provider.instance) {
        provider.instance[injectableSymbols.sapi] = null;
      }
      this.providers.delete(key);
    }

    const routableKeys = (this.routables) ? this.routables.keys() : [];
    for (const key of routableKeys) {
      const routable = this.routables.get(key);
      routable[routableSymbols.sapi] = null;
      this.routables.delete(key);
    }
  }

  /**
   * Used internally by [[Routable]] during bootstrapping.
   */
  enqueueRoutes(target: any): void {

    debug.route(`SakuraApi.route called for %O`, target);

    if (!target[routableSymbols.routes]) {
      debug.route(`.route '%O' is not a routable class`, target);
      return;
    }

    for (const route of target[routableSymbols.routes] as ISakuraApiClassRoute[]) {
      debug.route(`\tadded '%O'`, route);

      const methodSignature = route.httpMethods.join('');
      const routeSignature = `${methodSignature}:${route.path}`;
      if (this.routeQueue.get(routeSignature)) {
        throw new Error(`Duplicate route (${routeSignature}) registered by ${target.name || target.constructor.name}.`);
      }

      // used by this.listen
      this.routeQueue.set(routeSignature, route);
    }
  }

  /**
   * Gets a `@`[[AuthenticatorPlugin]] that was registered during construction of [[SakuraApi]].
   * @param {IAuthenticator} target
   */
  getAuthenticator(target: IAuthenticatorConstructor) {
    debug.authenticators(`.getAuthenticator ${(target || {} as any).name}`);

    if (!target || !target[authenticatorPluginSymbols.isAuthenticator]) {
      throw new AuthenticatorsMustBeDecoratedWithAuthenticatorPluginError(target);
    }

    const id = target[authenticatorPluginSymbols.id];
    const authenticator = this.authenticators.get(id);

    if (!authenticator) {
      throw new AuthenticatorNotRegistered(target);
    }

    return authenticator;
  }

  /**
   * Gets a `@`[[Model]] that was registered during construction of [[SakuraApi]] by name.
   * @param name the name of the Model (the name of the class that was decorated with `@`[[Model]]
   * @returns {undefined|any}
   * @deprecated use [[SakuraApi.getModel]] instead.
   */
  getModelByName(name: string): any {
    return this.models.get(name);
  }

  /**
   * Gets a `@`[[Model] that was registered during construction of [[SakuraApi]]
   * @param target pass in the [[Model]] class
   * @returns {any} the constructor for the [[Model]] class
   */
  getModel(target: any): any {
    if (!target || !target[modelSymbols.isSakuraApiModel]) {
      throw new ModelsMustBeDecoratedWithModelError(target);
    }

    const model = this.models.get(target[modelSymbols.id]);
    if (!model) {
      throw new ModelNotRegistered(target);
    }

    return model;
  }

  /**
   * Gets a `@`[[Injectable]] that was registered during construction of [[SakuraApi]].
   * @param target Pass in the [[Injectable]] class
   * @returns {any} the singleton instance of the [[Injectable]] class
   */
  getProvider(target: any): any {
    debug.providers(`.getProvider ${(target || {} as any).name}`);

    if (!target || !target[injectableSymbols.isSakuraApiInjectable]) {
      throw new ProvidersMustBeDecoratedWithInjectableError(target);
    }

    const provider = this.providers.get(target[injectableSymbols.id]);
    if (!provider) {
      throw new ProviderNotRegistered(target);
    }

    if (!provider.instance) {
      debug.providers(`\t lazy instantiating singleton instance of ${(target || {} as any).name}`);
      provider.instance = new provider.target();
    }

    return provider.instance;
  }

  /**
   * Gets a `@`[[Routable]] that was registered during construction of [[SakuraApi]] by name.
   * @param name the name of the Routable (the name of the class that was decorated with `@`[[Model]]
   * @returns {undefined|any}
   * @deprecated use [[SakuraApi.getRoutable]] instead.
   */
  getRoutableByName(name: string): any {
    return this.routables.get(name);
  }

  /**
   * Gets a `@`[[Routable] that was registered during construction of [[SakuraApi]]
   * @param target pass in the [[Routable]] class
   * @returns {any} the constructor for the [[Routable]] class
   */
  getRoutable(target: any): any {
    if (!target || !target[routableSymbols.isSakuraApiRoutable]) {
      throw new RoutablesMustBeDecoratedWithRoutableError(target);
    }

    const routable = this.routables.get(target[routableSymbols.id]);
    if (!routable) {
      throw new RoutableNotRegistered(target);
    }

    return routable;
  }

  /**
   * Starts the server. You can override the settings loaded by [[SakuraApiConfig]] by passing in
   * an object that implements [[ServerConfig]].
   *
   * Connects to all the DB connections (if any) defined in [[SakuraApi.dbConnections]]. These are loaded
   * by [[SakuraApiConfig.dataSources]]. If you do not provide a "dbConnections" property in your config, or if you
   * did not instantiate SakuraApi manually with [[SakuraApi.instiate]] with a [[SakuraMongoDbConnection]] that
   * you constructed elsewhere, then no DB connections will be opened. You can also user
   * [[SakuraMongoDbConnection.connect]] to manually define Db connections.
   */
  async listen(listenProperties?: ServerConfig): Promise<void> {

    debug.route(`.listen called with serverConfig:`, listenProperties);
    debug.route(`.listen setting baseUri to ${this._baseUrl}`);

    listenProperties = listenProperties || {};
    this._address = listenProperties.address || this._address;
    this._port = listenProperties.port || this._port;

    let router;
    // Add App Route Handlers ----------------------------------------------------------------------------------------
    // but only once per instance of SakuraApi
    if (!this.listenCalled) {
      debug.route(`\t.listen first time call, adding app middleware and route handlers`);

      /**
       * Add ordered middleware
       */
      for (const key of Object.keys(this.middlewareHandlers).sort()) {
        const handlers = this.middlewareHandlers[key];
        this.app.use(handlers);
      }

      /**
       * Catch BodyParser parse errors
       */
      this.app.use(catchBodyParserErrors);

      /**
       * Handle Response.locals injection
       */
      this.app.use(handleResponseLocals);

      /**
       * Add final error handlers
       */
      if (this.lastErrorHandlers) {
        for (const handler of this.lastErrorHandlers) {
          this.app.use(handler);
        }
      }

      /**
       * Setup route handler so that each call to listen always overwrites the prior routes -- makes testing
       * easier, there's really not a lot of reasons to be calling listen multiple times in a production app
       */
      this.app.use(this._baseUrl, (req, res, next) => {
        // see: https://github.com/expressjs/express/issues/2596#issuecomment-81353034
        // hook whatever the current router is
        router(req, res, next);
      });

      // ensures that middleware is added only once
      this.listenCalled = true;
    }

    // Setup @Routable routes ----------------------------------------------------------------------------------------
    router = Router();

    debug.route('\t.listen processing route queue');
    // add routes
    const routes = this.routeQueue.values();
    for (const route of routes) {

      debug.route('\t\t.listen route %O', route);

      let routeHandlers: Handler[] = [
        // injects an initial handler that injects the reference to the instantiated @Routable decorated object
        // responsible for this route. This allows route handlers to look get the @Routable's model
        // (if present)
        (req: Request, res: Response, next: NextFunction) => {
          res.locals.routable = route.routable;
          next();
        }
      ];

      if (route.authenticators.length > 0) {
        // add authenticators to middleware for route, if present
        routeHandlers.push(authHandler.bind(this)(route));
      }

      if (route.beforeAll) {
        // add @Routable class beforeAll handlers if defined
        routeHandlers = [...routeHandlers, ...route.beforeAll as Handler[]];
      }

      if (route.before) {
        // add @Route before handlers if defined
        routeHandlers = [...routeHandlers, ...route.before as Handler[]];
      }

      routeHandlers.push(route.f);

      if (route.after) {
        // add @Route after handlers if defined
        routeHandlers = [...routeHandlers, ...route.after as Handler[]];
      }

      if (route.afterAll) {
        // add @Routable afterAll handlers if defined
        routeHandlers = [...routeHandlers, ...route.afterAll as Handler[]];
      }

      routeHandlers.push(resLocalsHandler);

      const routeMethods = route.httpMethods;
      for (let method of routeMethods) {
        if (method === '*') {
          method = 'all';
        }
        router[method](route.path, routeHandlers);
      }
    }

    // Setup DB Connetions -------------------------------------------------------------------------------------------
    if (this.dbConnections) {
      await this.dbConnections.connectAll();
    }

    return listen.bind(this)();

    //////////
    function authHandler(route: ISakuraApiClassRoute) {

      return async (req: Request, res: Response, next: NextFunction) => {

        let firstFailure: AuthenticatorPluginResult;
        let firstFailureAuthenticatorName: string;

        let currentAuthenticatorName: string;
        try {
          for (const authenticatorConstructor of route.authenticators) {
            currentAuthenticatorName = (authenticatorConstructor as any).name;
            const authenticator = this.getAuthenticator(authenticatorConstructor);
            const result = await authenticator.authenticate(req, res);

            if (!result.success && !firstFailure) {
              firstFailure = result;
              firstFailureAuthenticatorName = (authenticatorConstructor as any).name;
            } else if (result.success) {
              // give the integrator the opportunity to change the status and data as well as log the auth failure
              if (this.onAuthenticationError) {
                const override = await this.onAuthenticationSuccess(req, res, result, currentAuthenticatorName);
                if (override && override.status) {
                  result.status = override.status;
                }
                if (override && override.data) {
                  result.data = override.data;
                }
              }

              // authenticator returned success, call next handler in the chain
              return next();
            }
          }

          // give the integrator the opportunity to change the status and data as well as log the auth failure
          if (this.onAuthenticationError) {
            const override = await this.onAuthenticationError(req, res, firstFailure, firstFailureAuthenticatorName);
            if (override && override.status) {
              firstFailure.status = override.status;
            }
            if (override && override.data) {
              firstFailure.data = override.data;
            }
          }

          res
            .status(firstFailure.status)
            .json(firstFailure.data);
        } catch (err) {

          if (err instanceof AuthenticatorNotRegistered) {
            throw err;
          }

          if (this.onAuthenticationFatalError) {
            await this.onAuthenticationFatalError(req, res, err, currentAuthenticatorName);
          }
        }
      };
    }

    function catchBodyParserErrors(err, req: Request, res: Response, next: NextFunction): void {
      // see: https://github.com/expressjs/body-parser/issues/238#issuecomment-294161839
      if (err instanceof SyntaxError && (err as any).status === BAD_REQUEST && 'body' in err) {
        res.status(BAD_REQUEST).send({
          body: req.body,
          error: 'invalid_body'
        });
      } else {
        next(err);
      }
    }

    function listen(): Promise<null> {
      return new Promise((resolve, reject) => {
        this
          .server
          .listen(this.port, this.address, (err) => {
            if (err) {
              debug.normal('.listen error', err);
              return reject(err);
            }

            if (listenProperties.bootMessage === undefined) {
              // tslint:disable-next-line:no-console
              console.log(colors.green(`SakuraAPI started on: ${this.address}:${this.port}`));
            } else {
              const msg = (listenProperties.bootMessage === '')
                ? false
                : listenProperties.bootMessage;

              if (msg) {
                process.stdout.write(colors.green(`${msg}`));
              }
            }

            debug.normal(`.listen server started ${this.address}:${this.port}`);
            this.listening$.next();
            return resolve();
          });
      });
    }

    function handleResponseLocals(req: Request, res: Response, next: NextFunction) {
      // inject Response.locals.body
      // inject Response.locals.response

      if (req.body && !res.locals.reqBody) {
        res.locals.reqBody = req.body;
      }
      res.locals.data = {};
      res.locals.status = OK;

      res.locals.send = (status, data): IRoutableLocals => {
        res.locals.status = status;

        if (!res.locals.data || Object.keys(res.locals.data || {}).length === 0) {
          res.locals.data = data;
          return res.locals;
        }

        // shallow merge the two objects and make sure to de-reference data
        res.locals.data = Object.assign(res.locals.data, JSON.parse(JSON.stringify(data)));
        return res.locals;
      };

      next();
    }

    function resLocalsHandler(req: Request, res: Response, next: NextFunction) {
      if (res.headersSent) {
        return next();
      }
      res
        .status(res.locals.status || OK)
        .json(res.locals.data);

      next();
    }

  }

  private registerAuthenticators(options: SakuraApiPluginResult, sapiOptions: SakuraApiOptions) {
    debug.normal('\tRegistering Authenticators');

    const authenticators: IAuthenticator[] = options.authenticators || [];

    // inject Anonymous authenticator if other authenticators are provided (i.e., don't include it
    // if there's no authentication going on as it serves no purpose. Allow the developer to
    // `suppressAnonymousAuthenticatorInjection` if they don't want Anonymous injected for some reason.
    if (authenticators.length > 0 && !(sapiOptions || {} as any).suppressAnonymousAuthenticatorInjection) {
      this.authenticators.set(Anonymous[authenticatorPluginSymbols.id], new Anonymous());
    }

    // Allow overriding for mocking
    for (const authenticator of authenticators) {
      const isAuthenticator = (authenticator.constructor || {} as any)[authenticatorPluginSymbols.isAuthenticator];

      let authenticatorSource: any;
      let authenticatorRef: any;

      if (!isAuthenticator) {
        const mockAuthenticator: { use: any, for: any } = authenticator as any;
        if (!mockAuthenticator.use
          || !mockAuthenticator.for
          || !mockAuthenticator.use[injectableSymbols.isSakuraApiInjectable]
          || !mockAuthenticator.for[injectableSymbols.isSakuraApiInjectable]) {
          throw new Error('SakuraApi setup error. SakuraApiOptions.authenticators array must have classes decorated with'
            + ' @AuthenticatorPlugin() or an object literal of the form { use: SomeMockAuthenticatorPlugin, for: SomeAuthenticatorPlugin },'
            + ' where SomeMockAuthenticatorPlugin and SomeAuthenticatorPlugin are decorated with @AuthenticatorPlugin().');
        }

        authenticatorSource = mockAuthenticator.for;
        authenticatorRef = mockAuthenticator.use;
      } else {
        authenticatorSource = authenticator;
        authenticatorRef = authenticator;
      }

      authenticatorRef[authenticatorPluginSymbols.sapi] = this;

      debug.authenticators(`registering authenticator ${(authenticatorRef || {} as any).name}`);

      const id = (authenticatorSource.constructor || {} as any)[authenticatorPluginSymbols.id];
      this.authenticators.set(id, authenticatorRef);
    }
  }

  private registerModels(options: SakuraApiOptions | SakuraApiPluginResult): void {
    debug.normal('\tRegistering Models');
    const models: any[] = options.models || [];

    // Allow overriding for mocking
    for (const model of models) {
      const isModel = model[modelSymbols.isSakuraApiModel];

      let modelId: string;
      let modelName: string; // this will be removed
      let modelRef: any;

      // must be decorated with @Model or { use: SomeModel, for: SomeOriginalModel }
      if (!isModel) {
        if (!model.use
          || !model.for
          || !model.use[modelSymbols.isSakuraApiModel]
          || !model.for[modelSymbols.isSakuraApiModel]) {
          throw new Error('SakuraApi setup error. SakuraApiOptions.models array must have classes decorated with @Model'
            + ' or an object literal of the form { use: SomeMockModel, for: SomeRealModel }, where SomeMockModel and'
            + ' SomeRealModel are decorated with @Model.');
        }

        modelId = model.for[modelSymbols.id];
        modelName = model.for.name;
        modelRef = model.use;

        debug.models(`registering model ${modelRef.name} for ${modelName}`);
      } else {
        modelId = model[modelSymbols.id];
        modelName = model.name;
        modelRef = model;

        debug.models(`registering model ${modelName}`);
      }

      if (this.throwDependencyAlreadyInjectedError && modelRef[modelSymbols.sapi]) {
        throw new DependencyAlreadyInjectedError('Model', modelName);
      }
      modelRef[modelSymbols.sapi] = this;

      this.models.set(modelName, modelRef);
      this.models.set(modelId, modelRef);
    }
  }

  private registerPlugins(options: SakuraApiOptions): void {
    debug.normal('\tRegistering Modules');
    const plugins = options.plugins || [];

    // Allow overriding for mocking
    for (const plugin of plugins) {
      if (typeof plugin.plugin !== 'function') {
        throw new Error('SakuraApi setup error. SakuraApiOptions.plugin array must have objects with a plugin ' +
          'property that is a function, which accepts an instance of SakuraApi. The module throwing this error is ' +
          `a ${typeof plugin.plugin} rather than a function.`);
      }
      const pluginResults: SakuraApiPluginResult = plugin.plugin(this, plugin.options);

      this.registerModels(pluginResults);
      this.registerProviders(pluginResults);
      this.registerRoutables(pluginResults);

      this.registerAuthenticators(pluginResults, options);

      if (pluginResults.middlewareHandlers) {
        for (const handler of pluginResults.middlewareHandlers) {
          this.addMiddleware(handler, plugin.order || 0);
        }
      }
    }
  }

  private registerProviders(options: SakuraApiOptions | SakuraApiPluginResult): void {
    debug.normal('\tRegistering Providers');

    const injectables: any[] = options.providers || [];

    for (const injectable of injectables) {
      const isInjectable = injectable[injectableSymbols.isSakuraApiInjectable];

      let injectableName: string;
      let injectableRef: any;
      let injectableSource: any;

      // Allow overriding for mocking
      if (!isInjectable) {
        if (!injectable.use
          || !injectable.for
          || !injectable.use[injectableSymbols.isSakuraApiInjectable]
          || !injectable.for[injectableSymbols.isSakuraApiInjectable]) {
          throw new Error('SakuraApi setup error. SakuraApiOptions.providers array must have classes decorated with'
            + ' @Injectable or an object literal of the form { use: SomeInjectableService, for: SomeRealService },'
            + ' where SomeMockInjectable and SomeRealInjectable are decorated with @Injectable.');
        }

        injectableName = injectable.for.name;
        injectableRef = injectable.use;
        injectableSource = injectable.for;

        debug.providers(`registering provider ${injectableRef.name} for ${injectableName}`);
      } else {
        injectableName = injectable.name;
        injectableRef = injectable;
        injectableSource = injectable;

        debug.providers(`registering provider ${injectableName}`);
      }

      if (this.throwDependencyAlreadyInjectedError && injectableRef[injectableSymbols.sapi]) {
        throw new DependencyAlreadyInjectedError('Injectable', injectableName);
      }

      // set the injectable's instance of SakuraApi to this
      injectableRef[injectableSymbols.sapi] = this;
      this.providers.set(injectableSource[injectableSymbols.id], {
        instance: null,
        target: injectableRef
      });
    }
  }

  private registerRoutables(options: SakuraApiOptions | SakuraApiPluginResult): void {
    debug.normal('\tRegistering Models');
    const routables: any[] = options.routables || [];

    // Allow overriding for mocking
    for (const routable of routables) {

      const isRoutable = routable[routableSymbols.isSakuraApiRoutable];

      let routableId: string;
      let routableName: string;
      let routableRef: any;

      // must be decorated with @Routable or { use: Routable, for: Routable }
      if (!isRoutable) {
        if (!routable.use
          || !routable.for
          || !routable.use[routableSymbols.isSakuraApiRoutable]
          || !routable.for[routableSymbols.isSakuraApiRoutable]) {
          throw new Error('SakuraApi setup error. SakuraApiOptions.routables array must have classes decorated with '
            + ' @Routable or an object literal of the form { use: SomeMockRoutable, for: SomeRealRoutable }, where'
            + ' SomeMockRoutable and SomeRealRoutable are decorated with @Routable.');
        }

        routableId = routable.for[routableSymbols.id];
        routableName = routable.for.name;
        routableRef = routable.use;

        debug.providers(`registering routable ${routableRef.name} for ${routableName}`);
      } else {
        routableId = routable[routableSymbols.id];
        routableName = routable.name;
        routableRef = routable;

        debug.providers(`registering routable ${routableName}`);
      }

      if (this.throwDependencyAlreadyInjectedError && routableRef[routableSymbols.sapi]) {
        throw new DependencyAlreadyInjectedError('Routable', routableName);
      }
      routableRef[routableSymbols.sapi] = this;

      // get the routes queued up for .listen
      this.enqueueRoutes(new (routableRef as any)());
      this.routables.set(routableName, routableRef);
      this.routables.set(routableId, routableRef);
    }
  }
}
