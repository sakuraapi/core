import * as debug from 'debug';
import { Handler } from 'express';
import { IAuthenticatorConstructor } from '../plugins';

export enum HttpMethod {'connect', 'delete', 'get', 'head', 'post', 'put', 'patch', 'trace'}

export type HttpMethods = 'connect' | 'delete' | 'get' | 'head' | 'post' | 'put' | 'patch' | 'trace' | '*';

// extract valid http methods array from enum
export const validHttpMethods = Object
  .keys(HttpMethod)
  .splice(Object.keys(HttpMethod).length / 2)
  .map((k) => k);

/**
 * Interface defining the valid properties for the `@`[[Route]] decorator.
 */
export interface IRoutableMethodOptions {

  /**
   * An array or single [[IAuthenticatorConstructor]]. [[SakuraApi]] works through the authenticators
   * left to right. If `@`[[Routable]] for this `@`[[Route]] defines authenticators, they will be appended to the
   * right of the array when handling the route (i.e., they'll happen after this routes authenticators).
   */
  authenticator?: IAuthenticatorConstructor[] | IAuthenticatorConstructor;

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
   *    res.sendStatus(OK);
   *  }
   * }
   * </pre>
   *
   * The above example binds the `postNewUser` route handler to respond to `GET` requests directed to the `/user/123`
   * endpoint (assuming the `:userId` was passed in as `123`).
   */
  path?: string;

  /**
   * Optionally defines the HTTP method to attach to this `@`[[Route]]'s handler. See the example for
   * [[RoutableMethodOptions.path]].
   *
   * Defaults to HTTP method 'GET' if not method is provided.
   */
  method?: HttpMethods | HttpMethods[] | HttpMethod | HttpMethod[];

  /**
   * Boolean value that sets this route to blacklisted when set to true. This is a quick way to turn off a route when
   * testing. The default value is false.
   */
  blackList?: boolean;
  /**
   * Takes an array of Express Handlers or a single Express Handler. The handler(s) will be called before
   * each `@Route` method in the `@Routable` class.
   *
   * If you want to use a class method, it has to be static. Why? Because when the `@`[[Route]] decorator is executed,
   * the instance of the `@`Routable class doesn't exist yet.
   *
   * NOTE: handlers are bound to the instance of `@`Routable at the time of execution, `this` is in the context of the
   * instance. So... even though you have to use the `static` hack, you still have and 'instance' method.
   *
   * ### Example
   * <pre>
   * <span>@</span>Routable({
   *    baseUrl: 'user'
   * })
   * class UserApi {
   *    instanceValue = true;
   *
   *    <span>@</span>Route({
   *    path: '/:useId',
   *    method: 'get',
   *    before: [UserApi.someHandler]
   *  })
   *  postNewUser(req, res, next) {
   *    res.sendStatus(OK);
   *    next();
   *  }
   *
   *  static someHandler(req, res, next) {
   *    assert(this.instanceValue);
   *  }
   * }
   * </pre>
   *
   * You can also use one of built in handlers. Those are located in `@sakuraapi/api/handlers`. Options include:
   *    - [[getAllRouteHandler]]
   *    - [[getRouteHandler]]
   *    - [[putRouteHandler]]
   *    - [[postRouteHandler]]
   *    - [[deleteRouteHandler]]
   */
  before?: [Handler] | Handler;

  /**
   * Takes an array of Express Handlers or a single Express Handler. The handler(s) will be called after
   * each `@Route` method in the `@Routable` class.
   *
   * See [[IRoutableMethodOptions.before]] for an explanation of how after works.
   */
  after?: [Handler] | Handler;
}

/**
 * Decorator applied to methods within an `@`[[Routable]] decorated class that designates that method as a route handler.
 *
 * By default, a route that isn't provided a [[RoutableMethodOptions.method]] option, will default to `GET`. The
 * [[RoutableMethodOptions.path]] defaults to ''.
 *
 * See [[Routable]] for an example of how to use `@Route`.
 */
export function Route(options?: IRoutableMethodOptions) {
  options = options || {};
  if (options.method === '' as any) {
    // this would be confusing. Typing should catch this; this prevents a user from doing method: '' as any;
    throw new Error('Route method option is an empty string. Provide a valid HTTP method');
  }

  options.path = options.path || '';
  options.method = options.method || ['get'];
  options.blackList = options.blackList || false;

  return (target: any, key: string, value: TypedPropertyDescriptor<any>) => {

    debug('sapi:route')(`@Route decorated '${key}' with options %o`, options);

    // normalize options.method to array of methods
    const methods = [];

    if (typeof options.method === 'string') {

      methods.push(options.method);

    } else if (!Array.isArray(options.method)) {

      throw new Error('Route method option must be HttpMethods, HttpMethods[], HttpMethod or an ' +
        `HttpMethods[]. Value was: ${options.method}, typeof ${typeof options.method}.`);

    } else if (options.method.length === 0) {

      throw new Error('Route method option is an empty array. Provide at least one HTTP method');

    } else {

      methods.push(...options.method);

    }

    for (let i = 0; i < methods.length; i++) {
      const method = methods[i];

      if (method !== '*' && validHttpMethods.indexOf(method) < 0) {
        throw new Error(`@route(...)${(target.constructor || {}).name}.${key} has its 'method' ` +
          `property set to '${options.method}' typeof '${typeof method}', which is invalid. Valid options are: ` +
          `${validHttpMethods.join(', ')}`);
      }

      methods[i] = method.toLowerCase();
    }

    const f = function(...args: any[]) {
      return value.value.apply(this, args);
    };

    if (!options.blackList) {

      options.authenticator = options.authenticator || [];
      if (!Array.isArray(options.authenticator)) {
        options.authenticator = [options.authenticator];
      }

      Reflect.defineMetadata(`after.${key}`, options.after, target);
      Reflect.defineMetadata(`authenticators.${key}`, options.authenticator, target);
      Reflect.defineMetadata(`before.${key}`, options.before, target);
      Reflect.defineMetadata(`function.${key}`, f, target);
      Reflect.defineMetadata(`hasRoute.${key}`, true, target);
      Reflect.defineMetadata(`httpMethod.${key}`, methods, target);
      Reflect.defineMetadata(`path.${key}`, options.path, target);
    }

    return {
      value: f
    };
  };
}
