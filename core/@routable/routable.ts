import {SakuraApi} from '../sakura-api';

import * as path from 'path';
import 'reflect-metadata';

import debug = require('debug');

/**
 * Interface defining the valid properties for the `@Routable({})` decorator ([[Routable]]).
 */
export interface IRoutableClassOptions {
  /**
   * Array of strings defining which routes are ignored during route setup. Defaults to `[]`.
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
   * Boolean value (defaults to true) that tells SakuraApi whether or not to automatically bind this `@Routable`'s
   * routes to the express router. If you turn this off, you will have to manually pass this class definition into
   * [[SakuraApi.route]].
   */
  autoRoute?: boolean;
}

/**
 * Interface defining the valid properties for the `@Route({})` decorator ([[Route]]).
 */
export interface IRoutableMethodOptions {
  /**
   * String defining the endpoint of the route after the baseUrl set in [[RoutableClassOptions.baseUrl]]. The default
   * is `''`.
   *
   * ### Example
   * <pre>
   * <span>@</span>Routable({
   *    baseUrl: 'user'
   * })
   * class User {
   *  <span>@</span>Route({
   *    path: '/:useId',
   *    method: 'get'
   *  })
   *  postNewUser(req, res) {
   *    res.sendStatus(200);
   *  }
   * }
   * </pre>
   *
   * The above example binds the `postNewUser` route handler to respond to `GET` requests directed to the `/user/123`
   * endpoint (assuming the `:userId` was passed in as `123`).
   */
  path?: string;
  /**
   * String defining the HTTP method for which this route handler will respond. See the example for
   * [[RoutableMethodOptions.path]].
   *
   * Valid methods are: `['get', 'post', 'put', 'delete', 'head']`.
   */
  method?: string;
  /**
   * Boolean value that sets this route to blacklisted when set to true. This is a quick way to turn off a route when
   * testing. The default value is false.
   */
  blackList?: boolean;
}

/**
 * Internal to SakuraApi's [[Routable]]. This can chance without notice since it's not an official part of the API.
 */
interface ISakuraApiClassRoutes {
  path: string;       // the class's baseUrl (if any) + the route's path
                      // tslint:disable-next-line: variable-name
  f: (any) => any;    // the function that handles the route in Express.use
  httpMethod: string; // the http verb (e.g., GET, PUT, POST, DELETE)
  method: string;     // the classes's method name that handles the route (the name of f)
}

/**
 * The symbols used by `Reflect` to store `@Routeable` metadata.
 */
export const routableSymbols = {
  sakuraApiClassRoutes: Symbol('sakuraApiClassRoutes')
};

/**
 * Decorator applied to classes that represent routing logic for SakuraApi.
 *
 * ### Example
 * <pre>
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
 * ### Automagical Behavior
 * Keep in mind that `@Routable` will instantiate the class and pass it to [[SakuraApi.route]],
 * unless you set the [[RoutableClassOptions.autoRoute]] to false.
 */
export function Routable(options?: IRoutableClassOptions): any {
  options = options || {};
  options.blackList = options.blackList || [];
  options.baseUrl = options.baseUrl || '';

  options.autoRoute = (typeof options.autoRoute === 'boolean') ? options.autoRoute : true;

  return (target: any) => {

    debug('sapi:route')(`@Routable decorated '${target.name}' with options ${JSON.stringify(options)}`);

    const newConstructor = new Proxy(target, {
      construct: (t, args, nt) => {
        const c = Reflect.construct(t, args, nt);

        const metaData: ISakuraApiClassRoutes[] = [];

        Object
          .getOwnPropertyNames(Object.getPrototypeOf(c))
          .forEach((methodName) => {

            if (!Reflect.getMetadata(`hasRoute.${methodName}`, c)) {
              return;
            }

            if (options.blackList.indexOf(methodName) > -1) {
              return;
            }

            let endPoint = path
              .join(options.baseUrl, Reflect.getMetadata(`path.${methodName}`, c))
              .replace(/\/$/, '');

            if (!endPoint.startsWith('/')) {
              endPoint = '/' + endPoint;
            }

            const data: ISakuraApiClassRoutes = {
              f: Reflect.getMetadata(`function.${methodName}`, c)
                        .bind(c),
              httpMethod: Reflect.getMetadata(`httpMethod.${methodName}`, c),
              method: methodName,
              path: endPoint
            };

            metaData.push(data);
          });

        c[routableSymbols.sakuraApiClassRoutes] = metaData;

        if (options.autoRoute) {
          SakuraApi.instance.route(c);
        }

        return c;
      }
    });

    if (options.autoRoute) {
      // tslint:disable-next-line: no-unused-expression
      new newConstructor();
    }

    return newConstructor;
  };
}

/**
 * Decorator applied to methods within an `@Routable` decorated class that designates that method as a route handler.
 *
 * By default, a route that isn't provided a [[RoutableMethodOptions.method]] option, will default to `GET`. The
 * [[RoutableMethodOptions.path]] defaults to ''.
 *
 * See [[Routable]] for an example of how to use `@Route`.
 */
export function Route(options?: IRoutableMethodOptions) {
  options = options || {};
  options.path = options.path || '';
  options.method = options.method || 'get';
  options.blackList = options.blackList || false;

  const methods = ['get', 'post', 'put', 'delete', 'head'];

  return (target: any, key: string, value: TypedPropertyDescriptor<any>) => {

    debug('sapi:route')(`@Route decorated '${key}' with options ${JSON.stringify(options)}`);

    if (methods.indexOf(options.method) < 0) {
      throw new Error(`@route(...)${(target.constructor || {}).name}.${key} had its 'method' `
        + `property set to '${options.method}', which is invalid. Valid options are: ${methods.join(', ')}`);
    }

    const f = function(...args: any[]) {
      return value.value.apply(this, args);
    };

    if (!options.blackList) {
      Reflect.defineMetadata(`hasRoute.${key}`, true, target);
      Reflect.defineMetadata(`path.${key}`, options.path, target);
      Reflect.defineMetadata(`function.${key}`, f, target);
      Reflect.defineMetadata(`httpMethod.${key}`, options.method.toLowerCase(), target);
    }

    return {
      value: f
    };
  };
}
