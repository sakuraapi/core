import {Handler} from 'express';
import * as path from 'path';
import 'reflect-metadata';
import {
  deleteRouteHandler,
  getAllRouteHandler,
  getRouteHandler,
  postRouteHandler,
  putRouteHandler
} from '../../handlers/basic-handlers';
import {getDependencyInjections} from '../@injectable/injectable';
import {modelSymbols} from '../@model';

const debug = {
  normal: require('debug')('sapi:routable')
};

export type HttpMethod = 'get' | 'getAll' | 'put' | 'post' | 'delete';
const httpMethodMap = {
  delete: 'delete',
  get: 'get',
  getAll: 'get',
  post: 'post',
  put: 'put'
};

/**
 * Helper interface to apply to express.Request.locals. SakuraApi injects these properties (and the send function) in
 * response.locals (express.Response).
 */
export interface IRoutableLocals {
  reqBody: any;
  data: any;
  status: any;

  send(status, data?): IRoutableLocals;
}

/**
 * Interface defining the valid properties for the `@Routable({})` decorator ([[Routable]]).
 */
export interface IRoutableOptions {

  /**
   * Array of of method names (strings) defining which routes are ignored during route setup. Defaults to `[]`.
   */
  blackList?: string[];

  /**
   * String defining the base endpoint for all routes defined in this `@Routable()` class.
   * ### Example
   * <pre>
   * <span>@</span>Routable({
   *    baseUrl: 'user'
   * })
   * class User {
   *  <span>@</span>Route({
   *    path: '/',
   *    method: 'post'
   *  })
   *  postNewUser(req, res) {
   *    res.sendStatus(200);
   *  }
   * }
   * </pre>
   *
   * The above example would setup `postNewUser(...)` to respond to `POST` requests directed to the `/user` endpoint.
   */
  baseUrl?: string;

  /**
   * An array of strings for which APIs to expose when `@`[[Routable]] is bound to a model. Valid values include:
   * - get
   * - getAll
   * - put
   * - post
   * - delete
   *
   * If `suppressApi` is set, `exposeApi` will throw an error.
   */
  exposeApi?: HttpMethod[];

  /**
   * An array of strings for which APIs to suppress when `@`[[Routable]] is bound to a model. Valid values include:
   * - get
   * - getAll
   * - put
   * - post
   * - delete
   *
   * Alternatively, you can supply a boolean 'true' to suppress all endpoints from being included. This is helpful
   * when you want the built in handlers for `@`[[Route]]'s `before` and `after` functionality, but you have no need
   * for the built in endpoints.
   *
   * If `exposeApi` is set, `suppressApi` will throw an error.
   */
  suppressApi?: HttpMethod[] | boolean;

  /**
   * A class that is decorated with `@`[[Model]] for which this `@Routable` class will automatically create CRUD
   * route handlers.
   */
  model?: any;

  /**
   * Takes an array of Express Handlers or a single Express Handler. The handler(s) will be called before
   * each `@Route` method in the `@Routable` class.
   */
  beforeAll?: Handler[] | Handler;

  /**
   * Takes an array of Express Handlers or a single Express Handler. The handler(s) will be called after
   * each `@Route` method in the `@Routable` class.
   */
  afterAll?: Handler[] | Handler;
}

/**
 * Internal to SakuraApi's [[Routable]]. This can change without notice since it's not an official part of the API.
 */
export interface ISakuraApiClassRoute {
  /**
   * the class's baseUrl (if any) + the route's path
   */
  path: string;
  /**
   * the function that handles the route in Express.use
   */
  f: Handler;
  /**
   * the http verb (e.g., GET, PUT, POST, DELETE)
   */
  httpMethod: string;
  /**
   * the classes's method name that handles the route (the name of f)
   */
  method: string;
  /**
   * route handlers that run before all routes for an @Routable Class
   */
  beforeAll: Handler[] | Handler;
  /**
   * route handlers that run after all routes for an @Routable Class
   */
  afterAll: Handler[] | Handler;
  /**
   * route handlers that run before this route for an @Route Method
   */
  before?: Handler[] | Handler;
  /**
   * route handlers that run after this route for an @Route Method
   */
  after?: Handler[] | Handler;
  /**
   * the name of the constructor that added this route,
   */
  name: string;
  /**
   * reference to the @Routable class that's handling this route
   */
  routable: any;
}

/**
 * The symbols used by [[Routable]] decorated objects
 */
export const routableSymbols = {
  changeSapi: Symbol('changeSapi'),
  isSakuraApiRoutable: Symbol('isSakuraApiRoutable'),
  model: Symbol('model'),
  routes: Symbol('routes'),
  sapi: Symbol('sapi')
};

/**
 * Decorator applied to classes that represent routing logic for SakuraApi.
 *
 * ### Example
 * <pre>
 * import sapi from '../index'; // your app's reference to its instance of SakuraApi
 *
 * <span>@</span>Routable({
 *    baseUrl: 'users'
 * })
 * class User {
 *    <span>@</span>Route({
 *      path: ':id'.
 *      method: 'get'
 *    })
 *    getUser(req, res) {
 *      res.status(200).json(someModel.toJson());
 *    }
 * }
 * </pre>
 *
 * The above example creates a routable class called `User` that has one route, `users/:id`, which responds to GET
 * requests.
 *
 * Injection of properties and other stuff of interest:
 *   Static:
 *   * sapi: the @Routable's instance of SakuraApi that was injected during SakuraApi construction
 *   * sapiConfig: the @Routable's SakuraApi config (this is a shortcut to sapi.config)
 *
 * ### Automagical Behavior
 * @Routable decorated classes get instantiated when they are injected into the constructor of SakuraApi during
 * initialization. This registers their routes with [[SakuraApi]], which then adds the routes / handlers when
 * [[SakuraApi.listen]] is called.
 */
export function Routable(options?: IRoutableOptions): any {

  options = options || {};
  options.blackList = options.blackList || [];
  options.baseUrl = options.baseUrl || '';

  // -------------------------------------------------------------------------------------------------------------------
  // Developer notes:
  //
  // `target` represents the constructor function that is being reflected upon by the `@Routable` decorator. It is
  // decorated via a Proxy and becomes `newConstrutor` <- this is the decorated constructor function resulting
  // from the `@Routable` decorator.
  //
  // To add an instance member: newConstructor.prototype.newFunction = () => {}
  // to add a static member: newConstructor.newFunction = () => {}
  // ===================================================================================================================
  return (target: any) => {

    debug.normal(`@Routable decorating '${target.name}' with options: %o`, options);
    debug.normal(`\t@Routable options.model set to ${(options.model || {} as any).name}`);

    if (options.model && !options.model[modelSymbols.isSakuraApiModel]) {
      throw new Error(`${target.name} is not decorated by @Model and therefore cannot be used as a model for`
        + ` @Routable`);
    }

    if ((options.suppressApi || options.exposeApi) && !options.model) {
      throw new Error(`If @Routable '${target.name}' defines a 'suppressApi' or 'exposeApi' option, then a model`
        + ` option with a valid @Model must also be provided`);
    }

    if (options.suppressApi && options.exposeApi) {
      throw new Error(`@Routable '${target.name}' cannot have both 'suppressApi' and 'exposeApi' set at the same time`);
    }

    // -----------------------------------------------------------------------------------------------------------------
    // Developer notes:
    //
    // The constructor proxy implements logic that needs to take place upon constructions
    // =================================================================================================================
    debug.normal(`\tproxying constructor`);
    const newConstructor = new Proxy(target, {
      construct: (t, args, nt) => {
        debug.normal(`\tconstructing ${target.name}`);

        const diArgs = getDependencyInjections(target, t, target[routableSymbols.sapi]);

        const constructorProxy = Reflect.construct(t, diArgs, nt);

        const routes: ISakuraApiClassRoute[] = [];

        const beforeAll = bindHandlers(constructorProxy, options.beforeAll);
        const afterAll = bindHandlers(constructorProxy, options.afterAll);

        debug.normal(`\t\tprocessing methods for '${target.name}'`);
        // add routes decorated with @Route (integrator's custom routes)
        for (const methodName of Object.getOwnPropertyNames(Object.getPrototypeOf(constructorProxy))) {

          if (!Reflect.getMetadata(`hasRoute.${methodName}`, constructorProxy)) {
            continue;
          }

          if (options.blackList.indexOf(methodName) > -1) {
            debug.normal(`\t\t\t${methodName} is black listed; skipping`);
            continue;
          }

          debug.normal(`\t\t\t${methodName}`);

          const afterMeta = Reflect.getMetadata(`after.${methodName}`, constructorProxy);
          const after = bindHandlers(constructorProxy, afterMeta);
          const beforeMeta = Reflect.getMetadata(`before.${methodName}`, constructorProxy);
          const before = bindHandlers(constructorProxy, beforeMeta);

          let endPoint = path
            .join(options.baseUrl, Reflect.getMetadata(`path.${methodName}`, constructorProxy))
            .replace(/\/$/, '');

          if (!endPoint.startsWith('/')) {
            endPoint = '/' + endPoint;
          }

          const routerData: ISakuraApiClassRoute = {
            after,
            afterAll,
            before,
            beforeAll,
            f: Reflect
              .getMetadata(`function.${methodName}`, constructorProxy)
              // @Route handlers are bound to the context of the instance of the @Routable object
              .bind(constructorProxy),
            httpMethod: Reflect.getMetadata(`httpMethod.${methodName}`, constructorProxy),
            method: methodName,
            name: target.name,
            path: endPoint,
            routable: constructorProxy
          };

          debug.normal(`\t\t\thandler added: '%o'`, routerData);
          routes.push(routerData);
        }

        // add generated routes for Model
        if (options.model) {
          debug.normal(`\t\tbound to model, adding default routes`);

          addRouteHandler('get', getRouteHandler, routes, beforeAll, afterAll, constructorProxy);
          addRouteHandler('getAll', getAllRouteHandler, routes, beforeAll, afterAll, constructorProxy);
          addRouteHandler('put', putRouteHandler, routes, beforeAll, afterAll, constructorProxy);
          addRouteHandler('post', postRouteHandler, routes, beforeAll, afterAll, constructorProxy);
          addRouteHandler('delete', deleteRouteHandler, routes, beforeAll, afterAll, constructorProxy);
        }

        // set the routes property for the @Routable class
        constructorProxy[routableSymbols.routes] = routes;

        return constructorProxy;
      }
    });

    // isSakuraApiModel hidden property is attached to let other parts of the framework know that this is an @Model obj
    Reflect.defineProperty(newConstructor.prototype, routableSymbols.isSakuraApiRoutable, {
      value: true,
      writable: false
    });
    Reflect.defineProperty(newConstructor, routableSymbols.isSakuraApiRoutable, {
      value: true,
      writable: false
    });

    newConstructor[routableSymbols.sapi] = null;

    // Injects sapi as a shortcut property on routables pointing to newConstructor[routableSymbols.sapi]
    Reflect.defineProperty(newConstructor, 'sapi', {
      configurable: false,
      enumerable: false,
      get: () => newConstructor[routableSymbols.sapi]
    });

    // Injects sapi as a shortcut property on routables pointing to newConstructor[routableSymbols.sapi]
    Reflect.defineProperty(newConstructor.prototype, 'sapi', {
      configurable: false,
      enumerable: false,
      get: () => newConstructor[routableSymbols.sapi]
    });

    // Injects sapiConfig as a shortcut property on routables pointing to newConstructor[routableSymbols.sapi].config
    Reflect.defineProperty(newConstructor, 'sapiConfig', {
      configurable: false,
      enumerable: false,
      get: () => (newConstructor[routableSymbols.sapi] || {} as any).config
    });

    // Injects sapiConfig as a shortcut property on routables pointing to newConstructor[routableSymbols.sapi].config
    Reflect.defineProperty(newConstructor.prototype, 'sapiConfig', {
      configurable: false,
      enumerable: false,
      get: () => (newConstructor[routableSymbols.sapi] || {} as any).config
    });

    // if a model is present, then add a method that allows that model to be retrieved
    if (options.model) {
      newConstructor.prototype[routableSymbols.model] = () => {
        return newConstructor[routableSymbols.sapi].getModelByName(options.model.name);
      };
    }

    return newConstructor;

    //////////
    function addRouteHandler(method: HttpMethod,
                             handler: Handler,
                             routes: ISakuraApiClassRoute[],
                             beforeAll: Handler[],
                             afterAll: Handler[],
                             constructorProxy: any) {

      if (!options.suppressApi && !options.exposeApi) {
        routes.push(generateRoute(method, handler, beforeAll, afterAll, constructorProxy));
        return;
      }

      if (options.exposeApi && options.exposeApi.indexOf(method) > -1) {
        routes.push(generateRoute(method, handler, beforeAll, afterAll, constructorProxy));
        return;
      }

      const isSuppressed = options.suppressApi && (typeof options.suppressApi === 'boolean')
        ? options.suppressApi
        : (options.suppressApi as HttpMethod[] || []).indexOf(method) > -1;

      if (!isSuppressed && !options.exposeApi) {
        routes.push(generateRoute(method, handler, beforeAll, afterAll, constructorProxy));
        return;
      }

    }

    function generateRoute(method: HttpMethod,
                           handler: Handler,
                           beforeAll: Handler[],
                           afterAll: Handler[],
                           constructorProxy: any): ISakuraApiClassRoute {

      const path = ((method === 'get' || method === 'put' || method === 'delete')
        ? `/${(options.baseUrl || (options.model as any).name.toLowerCase())}/:id`
        : `/${options.baseUrl || (options.model as any).name.toLowerCase()}`);

      const diModel = newConstructor[routableSymbols.sapi].getModelByName(options.model.name);

      const routerData: ISakuraApiClassRoute = {
        afterAll,
        beforeAll,
        f: handler.bind(diModel),
        httpMethod: httpMethodMap[method],
        method: handler.name,
        name: target.name,
        path,
        routable: constructorProxy
      };

      debug.normal(`\t\t\tbuiltin handler added: '%o'`, routerData);
      return routerData;
    }

    function bindHandlers(constructorProxy: any, handlers: Handler[] | Handler): Handler[] {
      const boundHandlers = [];

      if (!handlers) {
        return;
      }

      if (!Array.isArray(handlers)) {
        handlers = [handlers];
      }

      for (const handler of handlers) {
        boundHandlers.push(handler.bind(constructorProxy));
      }

      return boundHandlers;
    }
  };
}
