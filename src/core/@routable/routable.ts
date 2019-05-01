import { Handler } from 'express';
import 'reflect-metadata';
import { v4 } from 'uuid';
import {
  deleteRouteHandler,
  getAllRouteHandler,
  getRouteHandler,
  postRouteHandler,
  putRouteHandler
} from '../../handlers';
import { getDependencyInjections } from '../@injectable';
import { modelSymbols } from '../@model';
import { urljoin } from '../lib';
import { IAuthenticatorConstructor } from '../plugins';

const debug = {
  normal: require('debug')('sapi:routable')
};

export type ApiMethod = 'get' | 'getAll' | 'put' | 'post' | 'delete';
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
 * Interface defining the valid options for the `@`[[Routable]] decorator.
 */
export interface IRoutableOptions {

  /**
   * An array or single instance of [[IAuthenticatorConstructor]]. [[SakuraApi]] works through the authenticators
   * left to right. If all of them fail, the first failure is returned. If and `@`[[Route]] method defines
   * authenticators, those will be handled first (they're appended to the left of the array for that route).
   */
  authenticator?: IAuthenticatorConstructor[] | IAuthenticatorConstructor;

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
   *    res.sendStatus(OK);
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
  exposeApi?: ApiMethod[];

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
  suppressApi?: ApiMethod[] | boolean;

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
   * The array of authenticators to apply to the route's middleware
   */
  authenticators: IAuthenticatorConstructor[];
  /**
   * the class's baseUrl (if any) + the route's path
   */
  path: string;
  /**
   * the function that handles the route in Express.use
   */
  f: Handler;
  /**
   * Array of HTTP verbs supported by this route (e.g., GET, PUT, POST, DELETE)
   */
  httpMethods: string[];
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
  authenticators: Symbol('authenticators'),
  changeSapi: Symbol('changeSapi'),
  id: Symbol('routableId'),
  isSakuraApiRoutable: Symbol('isSakuraApiRoutable'),
  model: Symbol('model'),
  routes: Symbol('routes'),
  sapi: Symbol('sapi')
};

/**
 * An attempt was made to use [[SakuraApi.getRoutable]] with a parameter that isn't decorated with `@`[[Model]].
 */
export class RoutablesMustBeDecoratedWithRoutableError extends Error {
  constructor(target: any) {
    const targetName = (target || {} as any).name
      || ((target || {} as any).constructor || {} as any).name
      || typeof target;

    super(`Invalid attempt to get ${targetName}; must be decorated with @Routable`);
  }
}

/**
 * Thrown when an attempt is made to use an object as a Routable, which has not been registered with the dependency
 * injection system. You register models when you are instantiating the instance of [[SakuraApi]] for your
 * application.
 */
export class RoutableNotRegistered extends Error {
  constructor(target: any) {
    const targetName = (target || {} as any).name
      || ((target || {} as any).constructor || {} as any).name
      || typeof target;

    super(`${targetName} is not registered as a routable api with SakuraApi`);
  }
}

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
 *      res.status(OK).json(someModel.toJson());
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

        // Replace constructor params with their @Injectable singleton instances
        const diArgs = getDependencyInjections(target, t, target[routableSymbols.sapi]);

        const constructorProxy = Reflect.construct(t, diArgs, nt);

        // (1) process beforeAll, afterAll and @Route routes
        const beforeAll = bindHandlers(constructorProxy, options.beforeAll);
        const afterAll = bindHandlers(constructorProxy, options.afterAll);
        const routes: ISakuraApiClassRoute[] = addRoutesForRouteMethods(constructorProxy, beforeAll, afterAll);

        // (2) if there's a model, then conditionally add generated routes for that Model
        if (options.model) {
          debug.normal(`\t\tbound to model, adding default routes`);

          addModelBasedRouteHandlers('get', getRouteHandler, routes, beforeAll, afterAll, constructorProxy);
          addModelBasedRouteHandlers('getAll', getAllRouteHandler, routes, beforeAll, afterAll, constructorProxy);
          addModelBasedRouteHandlers('put', putRouteHandler, routes, beforeAll, afterAll, constructorProxy);
          addModelBasedRouteHandlers('post', postRouteHandler, routes, beforeAll, afterAll, constructorProxy);
          addModelBasedRouteHandlers('delete', deleteRouteHandler, routes, beforeAll, afterAll, constructorProxy);
        }

        // set the routes property for the @Routable class
        constructorProxy[routableSymbols.routes] = routes;

        return constructorProxy;
      }
    });

    // DI unique identifier
    Reflect.defineProperty(newConstructor, routableSymbols.id, {
      value: v4(),
      writable: false
    });

    decorateWithAuthenticators(newConstructor);
    decorateWithIdentity(newConstructor);
    decorateWithSapi(newConstructor);

    // if a model is present, then add a method that allows that model to be retrieved
    if (options.model) {
      newConstructor.prototype[routableSymbols.model] = () => {
        return newConstructor[routableSymbols.sapi].getModel(options.model);
      };
    }

    return newConstructor;

    //////////
    function addRoutesForRouteMethods(constructorProxy: any, beforeAll: Handler[], afterAll: Handler[]): ISakuraApiClassRoute[] {
      const routes: ISakuraApiClassRoute[] = [];

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

        const routeAuthenticators = Reflect.getMetadata(`authenticators.${methodName}`, constructorProxy);
        const authenticators = [...routeAuthenticators, ...newConstructor[routableSymbols.authenticators]];

        const afterMeta = Reflect.getMetadata(`after.${methodName}`, constructorProxy);
        const after = bindHandlers(constructorProxy, afterMeta);
        const beforeMeta = Reflect.getMetadata(`before.${methodName}`, constructorProxy);
        const before = bindHandlers(constructorProxy, beforeMeta);

        let endPoint = urljoin([options.baseUrl, Reflect.getMetadata(`path.${methodName}`, constructorProxy)])
          .replace(/\/$/, '');

        if (!endPoint.startsWith('/')) {
          endPoint = '/' + endPoint;
        }

        const httpMethods = Reflect.getMetadata(`httpMethod.${methodName}`, constructorProxy);
        const routerData: ISakuraApiClassRoute = {
          after,
          afterAll,
          authenticators,
          before,
          beforeAll,
          f: Reflect
            .getMetadata(`function.${methodName}`, constructorProxy)
            // @Route handlers are bound to the context of the instance of the @Routable object
            .bind(constructorProxy),
          httpMethods,
          method: methodName,
          name: target.name,
          path: endPoint,
          routable: constructorProxy
        };

        debug.normal(`\t\t\thandler added: '%o'`, routerData);
        routes.push(routerData);
      }

      return routes;
    }

    function addModelBasedRouteHandlers(method: ApiMethod, handler: Handler, routes: ISakuraApiClassRoute[],
                                        beforeAll: Handler[], afterAll: Handler[], constructorProxy: any) {

      if (!options.suppressApi && !options.exposeApi) {
        routes.push(createModelRoute(method, handler, beforeAll, afterAll, constructorProxy));
        return;
      }

      if (options.exposeApi && options.exposeApi.indexOf(method) > -1) {
        routes.push(createModelRoute(method, handler, beforeAll, afterAll, constructorProxy));
        return;
      }

      const isSuppressed = options.suppressApi && (typeof options.suppressApi === 'boolean')
        ? options.suppressApi
        : (options.suppressApi as ApiMethod[] || []).indexOf(method) > -1;

      if (!isSuppressed && !options.exposeApi) {
        routes.push(createModelRoute(method, handler, beforeAll, afterAll, constructorProxy));
        return;
      }

    }

    function createModelRoute(method: ApiMethod, handler: Handler, beforeAll: Handler[], afterAll: Handler[],
                              constructorProxy: any): ISakuraApiClassRoute {

      const routePath = ((method === 'get' || method === 'put' || method === 'delete')
        ? `/${(options.baseUrl || (options.model as any).name.toLowerCase())}/:id`
        : `/${options.baseUrl || (options.model as any).name.toLowerCase()}`);

      const diModel = newConstructor[routableSymbols.sapi].getModel(options.model);

      const routerData: ISakuraApiClassRoute = {
        afterAll,
        authenticators: newConstructor[routableSymbols.authenticators],
        beforeAll,
        f: handler.bind(diModel),
        httpMethods: [httpMethodMap[method]],
        method: handler.name,
        name: target.name,
        path: routePath,
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

  function decorateWithAuthenticators(target: any) {
    // make sure the authenticators option always exists as an array
    options.authenticator = options.authenticator || [];
    if (!Array.isArray(options.authenticator)) {
      options.authenticator = [options.authenticator];
    }

    target[routableSymbols.authenticators] = options.authenticator;
  }

  function decorateWithIdentity(target: any) {
    // isSakuraApiModel hidden property is attached to let other parts of the framework know that this is an @Model obj
    Reflect.defineProperty(target.prototype, routableSymbols.isSakuraApiRoutable, {
      value: true,
      writable: false
    });
    Reflect.defineProperty(target, routableSymbols.isSakuraApiRoutable, {
      value: true,
      writable: false
    });
  }

  function decorateWithSapi(target: any) {
    target[routableSymbols.sapi] = null;

    // Injects sapi as a shortcut property on routables pointing to newConstructor[routableSymbols.sapi]
    Reflect.defineProperty(target, 'sapi', {
      configurable: false,
      enumerable: false,
      get: () => target[routableSymbols.sapi]
    });

    // Injects sapi as a shortcut property on routables pointing to newConstructor[routableSymbols.sapi]
    Reflect.defineProperty(target.prototype, 'sapi', {
      configurable: false,
      enumerable: false,
      get: () => target[routableSymbols.sapi]
    });

    // Injects sapiConfig as a shortcut property on routables pointing to newConstructor[routableSymbols.sapi].config
    Reflect.defineProperty(target, 'sapiConfig', {
      configurable: false,
      enumerable: false,
      get: () => (target[routableSymbols.sapi] || {} as any).config
    });

    // Injects sapiConfig as a shortcut property on routables pointing to newConstructor[routableSymbols.sapi].config
    Reflect.defineProperty(target.prototype, 'sapiConfig', {
      configurable: false,
      enumerable: false,
      get: () => (target[routableSymbols.sapi] || {} as any).config
    });
  }
}
