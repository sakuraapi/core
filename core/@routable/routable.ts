import {
  Handler,
  NextFunction,
  Request,
  Response
} from 'express';

import * as path from 'path';
import 'reflect-metadata';
import {
  IDbGetParams,
  modelSymbols,
  SakuraApiModel
} from '../@model';
import {addDefaultStaticMethods} from '../helpers';
import {SanitizeMongoDB as Sanitize} from '../security/mongo-db';
import debug = require('debug');

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
  model?: object;

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
  path: string;                    // the class's baseUrl (if any) + the route's path
                                   // tslint:disable-next-line: variable-name
  f: Handler;                      // the function that handles the route in Express.use
  httpMethod: string;              // the http verb (e.g., GET, PUT, POST, DELETE)
  method: string;                  // the classes's method name that handles the route (the name of f)
  beforeAll: Handler[] | Handler;  // route handlers that run before all routes for an @Routable Class
  afterAll: Handler[] | Handler;   // route handlers that run after all routes for an @Routable Class
  before?: Handler[] | Handler;     // route handlers that run before this route for an @Route Method
  after?: Handler[] | Handler;      // route handlers that run after this route for an @Route Method
  name: string;                    // the name of the constructor that added this route
}

/**
 * The symbols used by `Reflect` to store `@Routeable` metadata.
 */
export const routableSymbols = {
  changeSapi: Symbol('changeSapi'),
  debug: Symbol('debug'),
  isSakuraApiRoutable: Symbol('isSakuraApiRoutable'),
  routes: Symbol('routes'),
  sapi: Symbol('sapi')
};

/**
 *
 * A map of the valid built into [[Routable]].
 * Key = handler name used in in before/beforeAll/after/afterAll
 * Value = [
 *    string,  // [[Routable]] function name (these are all static) - this is what you use in before/after options
 *             // in [[Route]]
 *    boolean, // true = throw error if option.Model missing
 *    boolean  // skip bind (see: bindHandlers embedded function in [[Routable]]
 */
export const builtInHandlers = new Map<string, [string, boolean, boolean]>([
  ['getHandler', ['getRouteHandler', true, true]],
  ['getAllHandler', ['getAllRouteHandler', true, true]],
  ['putHandler', ['putRouteHandler', true, true]],
  ['postHandler', ['postRouteHandler', true, true]],
  ['deleteHandler', ['deleteRouteHandler', true, true]]
]);

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
 * ### Automagical Behavior
 * Keep in mind that `@Routable` will instantiate the class and pass it to [[SakuraApi.route]],
 * unless you set the [[RoutableClassOptions.autoRoute]] to false.
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
    debug('sapi:routable')(`@Routable decorating '${target.name}' with options: ${JSON.stringify(options)}`);
    debug('sapi:routable')(`\t@Routable options.model set to ${(options.model || {} as any).name}`);

    if (options.model && !options.model[modelSymbols.isSakuraApiModel]) {
      throw new Error(`${target.name} is not decorated by @Model and therefore cannot be used as a model for`
        + ` @Routable`);
    }

    if ((options.suppressApi || options.exposeApi) && !options.model) {
      throw new Error(`If @Routable '${target.name}' defines a 'suppressApi' or 'exposeApi' option, then a model`
        + ` option with a valid @Model must also be provided`);
    }

    // -----------------------------------------------------------------------------------------------------------------
    // Developer notes:
    //
    // The constructor proxy implements logic that needs to take place upon constructions
    // =================================================================================================================
    debug('sapi:routable')(`\tproxying constructor`);
    const newConstructor = new Proxy(target, {
      construct: (t, args, nt) => {
        debug('sapi:routable')(`\tconstructing ${target.name}`);

        const c = Reflect.construct(t, args, nt);

        const routes: ISakuraApiClassRoute[] = [];

        const beforeAll = bindHandlers(c, options.beforeAll, ['beforeAll']);
        const afterAll = bindHandlers(c, options.afterAll, ['afterAll']);

        // add the method to the @Routable class
        if (options.model) {
          debug('sapi:routable')(`\t\tbound to model, adding built in handlers`);

          addDefaultStaticMethods(c, getRouteHandler.name, getRouteHandler, options);
          addDefaultStaticMethods(c, getAllRouteHandler.name, getAllRouteHandler, options);
          addDefaultStaticMethods(c, putRouteHandler.name, putRouteHandler, options);
          addDefaultStaticMethods(c, postRouteHandler.name, postRouteHandler, options);
          addDefaultStaticMethods(c, deleteRouteHandler.name, deleteRouteHandler, options);
        }

        debug('sapi:routable')(`\t\tprocessing methods for '${target.name}'`);
        // add routes decorated with @Route (integrator's custom routes)
        for (const methodName of Object.getOwnPropertyNames(Object.getPrototypeOf(c))) {

          if (!Reflect.getMetadata(`hasRoute.${methodName}`, c)) {
            continue;
          }

          if (options.blackList.indexOf(methodName) > -1) {
            debug('sapi:routable')(`\t\t\t${methodName} is black listed; skipping`);
            continue;
          }

          debug('sapi:routable')(`\t\t\t${methodName}`);
          const beforeMeta = Reflect.getMetadata(`before.${methodName}`, c);
          const afterMeta = Reflect.getMetadata(`after.${methodName}`, c);

          const before = bindHandlers(c, beforeMeta, [methodName, 'before']);
          const after = bindHandlers(c, afterMeta, [methodName, 'after']);

          let endPoint = path
            .join(options.baseUrl, Reflect.getMetadata(`path.${methodName}`, c))
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
              .getMetadata(`function.${methodName}`, c)
              .bind(c),
            httpMethod: Reflect.getMetadata(`httpMethod.${methodName}`, c),
            method: methodName,
            name: target.name,
            path: endPoint
          };

          debug('sapi:routable')(`\t\t\thandler added: '%o'`, routerData);
          routes.push(routerData);
        }

        // add generated routes for Model
        if (options.model) {
          debug('sapi:routable')(`\t\tbound to model, adding default routes`);

          addRouteHandler('get', getRouteHandler, routes, beforeAll, afterAll);
          addRouteHandler('getAll', getAllRouteHandler, routes, beforeAll, afterAll);
          addRouteHandler('put', putRouteHandler, routes, beforeAll, afterAll);
          addRouteHandler('post', postRouteHandler, routes, beforeAll, afterAll);
          addRouteHandler('delete', deleteRouteHandler, routes, beforeAll, afterAll);
        }

        // set the routes property for the @Routable class
        c[routableSymbols.routes] = routes;

        return c;
      }
    });
    
    newConstructor[routableSymbols.debug] = {
      normal: debug('sapi:routable')
    };
    newConstructor.prototype[routableSymbols.debug] = newConstructor[routableSymbols.debug];

    // isSakuraApiModel hidden property is attached to let other parts of the framework know that this is an @Model obj
    Reflect.defineProperty(newConstructor.prototype, routableSymbols.isSakuraApiRoutable, {
      value: true,
      writable: false
    });
    Reflect.defineProperty(newConstructor, routableSymbols.isSakuraApiRoutable, {
      value: true,
      writable: false
    });

    return newConstructor;

    //////////
    function addRouteHandler(method: HttpMethod,
                             handler: Handler,
                             routes: ISakuraApiClassRoute[],
                             beforeAll: Handler[],
                             afterAll: Handler[]) {

      if (!options.suppressApi && !options.exposeApi) {
        routes.push(generateRoute(method, handler, beforeAll, afterAll));
        return;
      }

      const isSuppressed = options.suppressApi && (typeof options.suppressApi === 'boolean')
        ? options.suppressApi
        : (options.suppressApi as HttpMethod[]).indexOf(method) > -1;

      if (!isSuppressed) {
        routes.push(generateRoute(method, handler, beforeAll, afterAll));
        return;
      }

      if (options.exposeApi && options.exposeApi.indexOf(method) > -1) {
        routes.push(generateRoute(method, handler, beforeAll, afterAll));
        return;
      }
    }

    function generateRoute(method: HttpMethod,
                           handler: Handler,
                           beforeAll: Handler[],
                           afterAll: Handler[]): ISakuraApiClassRoute {

      const path = ((method === 'get' || method === 'put' || method === 'delete')
        ? `/${(options.baseUrl || (options.model as any).name.toLowerCase())}/:id`
        : `/${options.baseUrl || (options.model as any).name.toLowerCase()}`);

      const routerData: ISakuraApiClassRoute = {
        afterAll,
        beforeAll,
        f: handler.bind(options.model),
        httpMethod: httpMethodMap[method],
        method: handler.name,
        name: target.name,
        path
      };

      debug('sapi:routable')(`\t\t\tbuiltin handler added: '%o'`, routerData);
      return routerData;
    }

    // Make sure that each handler is bound to the context of the @Routable class - this makes it possible to have
    // static methods in the @Routable class that still have access to the `this` context of the instsantiated
    // @Routable class
    //
    // In the cases where the hander is a built in handler (e.g., getRouteHandler), the context is bound to
    // options.model.
    function bindHandlers(c: any, handlers: Handler[] | Handler, location: string[]): Handler[] {

      if (!handlers) {
        return;
      }

      if (!Array.isArray(handlers)) {
        handlers = [handlers];
      }

      const skipBindNames = applyBuiltInHandlers(handlers, c);

      const boundHandlers = [];
      let index = 0;
      for (const handler of handlers) {
        try {

          if (skipBindNames.indexOf(handler.name) === -1) {
            boundHandlers.push(handler.bind(c));
          } else {
            boundHandlers.push(handler.bind(options.model));
          }

          index++;
        } catch (err) {
          if (err.message === `Cannot read property 'bind' of undefined`) {
            throw new TypeError(`Unable to bind to undefined handler index ${index} in array `
              + `${JSON.stringify(handlers)} in ${target.name}:${location.join('.')}`);
          }
          throw err;
        }
      }
      return boundHandlers;
    }

    function applyBuiltInHandlers(handlers: any[], c: any): string[] {
      if (!handlers) {
        return;
      }

      const skipBindNames = [];
      for (let x = 0; x < handlers.length; x++) {
        if (typeof handlers[x] === 'string') {
          const v = builtInHandlers.get(handlers[x]);
          if (!v) {
            throw new Error(`${target.name} is attempting to use an invalid built in handler ${handlers[x]}`);
          }

          const handlerName = v[0];
          const modelRequired = v[1];
          const skipBind = v[2];

          if (modelRequired && !options.model) {
            throw new Error(`${target.name} is attempting to use built in handler ${handlerName}, which requires `
              + `${target.name} to be bound to a model`);
          }

          handlers[x] = c[handlerName];

          if (skipBind) {
            skipBindNames.push(handlerName);
          }
        }
      }

      return skipBindNames;
    }
  };
}

// tslint:disable:max-line-length
/**
 * By default, when you provide the optional `model` property to [[IRoutableOptions]] in the [[Routable]] parameters,
 * SakuraApi creates a route for GET `{modelName}/:id` that returns an either that document as a model or null if
 * nothing is found.
 *
 * You an constrain the results by providing a `fields` query string parameter.
 *
 * `fields` follows the same rules as (MongoDB field
 * projection)[https://docs.mongodb.com/manual/reference/glossary/#term-projection]
 */
// tslint:enable:max-line-length
function getRouteHandler(req: Request, res: Response, next: NextFunction) {
  const id = req.params.id;
  const resLocals = res.locals as IRoutableLocals;

  let project = null;

  // validate query string parameters
  try {
    assignParameters.call(this);
  } catch (err) {
    debug('sapi:routable')(`getRouteHandler threw error: ${err}`);
    return next();
  }

  debug('sapi:routable')(`getRouteHandler called with id:'%o', field projection: %o`, id, project);

  this
    .getById(id, project)
    .then((result) => {
      const response = (result) ? result.toJson() : null;
      resLocals.status = 200;
      resLocals.data = response;
      next();
    })
    .catch((err) => {
      // TODO add logging system here
      console.log(err); // tslint:disable-line:no-console
      next(err);
    });

  //////////
  function assignParameters() {
    const allowedFields$Keys = [];
    sanitizedUserInput(res, 'invalid_fields_parameter', () =>
      project = Sanitize.flattenObj(
        this.fromJsonToDb(
          Sanitize.whiteList$Keys(
            req.query.fields, allowedFields$Keys)
        )));
  }
}

// tslint:disable:max-line-length
/**
 * By default, when you provide the optional `model` property to [[IRoutableOptions]] in the [[Routable]] parameters,
 * SakuraApi creates a route for GET `{modelName}/` that returns an array of documents for that model or
 * for GET `baseUrl/` if [[Routable]] has a `baseUrl` defined.
 *
 * You can constrain the results by providing one or more of the following query string parameters:
 * * where={}
 * * fields={}
 * * skip=#
 * * limit=#
 *
 * `where` and `fields` must be valid json strings.
 *
 * For example:
 * `http://localhost/someModelName?where={"fn":"John", "ln":"Doe"}&fields={fn:0, ln:1}&limit=1&skip=0`
 *
 * This would return all documents where `fn` is 'John' and `ln` is 'Doe'. It would further limit the resulting fields
 * to just `fn` and it would only return 1 result, after skipping 0 of the results.
 *
 * The field names for `where` and `fields` are the @Json mapped names, so as to not expose internal names to the
 * client. You cannot include fields that are marked `@Db(private:true)` since these will not be marshalled
 * to json for the results.
 *
 * `fields` follows the same rules as (MongoDB field
 * projection)[https://docs.mongodb.com/manual/reference/glossary/#term-projection]
 *
 * `where` queries are stripped of any `$where` fields. Giving the client the direct ability to define `$where`
 * queries is a bad idea. If you want to do this, you'll have to implement your own route handler.
 */
// tslint:enable:max-line-length
function getAllRouteHandler(req: Request, res: Response, next: NextFunction) {
  const resLocals = res.locals as IRoutableLocals;

  const params: IDbGetParams = {
    filter: null,
    limit: null,
    project: null,
    skip: null
  };

  // validate query string parameters
  try {
    assignParameters.call(this);
  } catch (err) {
    debug('sapi:routable')(`getAllRouteHandler threw error: ${err}`);
    return next();
  }

  debug('sapi:routable')(`.getAllRouteHandler called with params: %o`, params);

  this
    .get(params)
    .then((results) => {
      const response = [];

      for (const result of results) {
        response.push(result.toJson());
      }

      resLocals.send(200, response);
      next();
    })
    .catch((err) => {
      // TODO add logging system here
      console.log(err); // tslint:disable-line:no-console
      next(err);
    });

  //////////
  function assignParameters() {
    sanitizedUserInput(res, 'invalid_where_parameter', () =>
      params.filter = Sanitize.flattenObj(
        this.fromJsonToDb(
          Sanitize.remove$where(req.query.where)
        )));

    const allowedFields$Keys = [];
    sanitizedUserInput(res, 'invalid_fields_parameter', () =>
      params.project = Sanitize.flattenObj(
        this.fromJsonToDb(
          Sanitize.whiteList$Keys(
            req.query.fields, allowedFields$Keys)
        )));

    if (req.query.skip !== undefined) {
      sanitizedUserInput(res, 'invalid_skip_parameter', () => {
        params.skip = Number.parseInt(req.query.skip);
        if (Number.isNaN(params.skip)) {
          throw new SyntaxError('Unexpected token');
        }
      });
    }

    if (req.query.limit !== undefined) {
      sanitizedUserInput(res, 'invalid_limit_parameter', () => {
        params.limit = Number.parseInt(req.query.limit);
        if (Number.isNaN(params.limit)) {
          throw new SyntaxError('Unexpected token');
        }
      });
    }
  }
}

function putRouteHandler(req: Request, res: Response, next: NextFunction) {
  const id = req.params.id;
  const resLocals = res.locals as IRoutableLocals;

  if (!req.body || typeof req.body !== 'object') {
    resLocals
      .send(400, {
        body: req.body,
        error: 'invalid_body'
      });
    return next();
  }

  if (!id) {
    resLocals
      .send(400, {
        body: req.body,
        error: 'invalid_body_missing_id'
      });
    return next();
  }

  const changeSet = this.fromJsonToDb(req.body);

  debug('sapi:routable')(`.putRouteHandler called with id: '%o' changeSet: %o`, id, changeSet);

  this
    .getById(id)
    .then((obj: SakuraApiModel) => {
      if (!obj) {
        resLocals.status = 404;
        return next();
      }

      obj
        .save(changeSet)
        .then((result) => {
          resLocals
            .send(200, {
              modified: (result.result || {} as any).nModified
            });
          next();
        });
    })
    .catch((err) => {
      // TODO add some kind of error handling
      console.log(err); // tslint:disable-line:no-console
    });
}

function postRouteHandler(req: Request, res: Response, next: NextFunction) {
  const resLocals = res.locals as IRoutableLocals;
  if (!req.body || typeof req.body !== 'object') {
    resLocals
      .send(400, {
        body: req.body,
        error: 'invalid_body'
      });
    return next();
  }

  const obj = this.fromJson(req.body);

  debug('sapi:routable')(`.postRouteHandler called with obj: %o`, obj);

  obj
    .create()
    .then((result) => {
      resLocals
        .send(200, {
          count: result.insertedCount,
          id: result.insertedId
        });
      next();
    })
    .catch((err) => {
      // TODO add some kind of error handling
      console.log(err); // tslint:disable-line:no-console
    });
}

function deleteRouteHandler(req: Request, res: Response, next: NextFunction) {
  const resLocals = res.locals as IRoutableLocals;

  const id = req.params.id;

  debug('sapi:routable')(`.deleteRouteHandler called with id: '%o'`, id);

  this
    .removeById(id)
    .then((result) => {
      resLocals.send(200, {
        n: (result.result || {}).n || 0
      });
      next();
    })
    .catch((err) => {
      err.status = 500;
      resLocals.send(500, {
        error: 'internal_server_error'
      });
      // TODO add logging here
      console.log(err); // tslint:disable-line:no-console
      next();
    });
}

/**
 * @internal Do not use - may change without notice.
 */
function sanitizedUserInput(res: Response, errMessage: string, fn: () => any) {
  try {
    fn();
  } catch (err) {

    if (err instanceof SyntaxError
      && err.message
      && (err.message.startsWith('Unexpected token') || err.message.startsWith('Unexpected end of JSON input'))) {
      res
        .locals
        .send(400, {
          details: err.message,
          error: errMessage
        }, res);
      (err as any).status = 400;
    } else {
      res
        .locals
        .send(500, {
          error: 'internal_server_error'
        }, res);
      (err as any).status = 500;
      // TODO some kind of error logging here
      console.log(err); // tslint:disable-line:no-console
    }

    throw err;
  }
}
