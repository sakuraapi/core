import {Handler} from 'express';
import debug = require('debug');

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
   *    res.sendStatus(200);
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
      Reflect.defineMetadata(`before.${key}`, options.before, target);
      Reflect.defineMetadata(`after.${key}`, options.after, target);
    }

    return {
      value: f
    };
  };
}
