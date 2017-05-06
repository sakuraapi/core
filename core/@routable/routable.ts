import {
  Request,
  Response
} from 'express';
import {
  IDbGetParams,
  modelSymbols
} from '../@model/model';
import {addDefaultInstanceMethods} from '../helpers/defaultMethodHelpers';
import {SakuraApi} from '../sakura-api';
import {SanitizeMongoDB as Sanitize} from '../security/mongo-db';

import * as path from 'path';
import 'reflect-metadata';

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
 * Interface defining the valid properties for the `@Routable({})` decorator ([[Routable]]).
 */
export interface IRoutableOptions {
  /**
   * Tells SakuraApi whether or not to automatically bind this `@Routable`'s routes to the express router. If you turn
   * this off, you will have to manually pass this class definition into [[SakuraApi.route]]. If this is not set
   * SakuraApi assumes this is true.
   */
  autoRoute?: boolean;

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
   * An array of strings of which APIs to expose. Valid values include:
   */
  exposeApi?: HttpMethod[];

  /**
   *
   */
  suppressApi?: HttpMethod[];

  /**
   * A class that is decorated with `@`[[Model]] for which this `@Routable` class will automatically create CRUD
   * route handlers.
   */
  model?: object;
}

/**
 * Internal to SakuraApi's [[Routable]]. This can change without notice since it's not an official part of the API.
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
  debug: Symbol('debug'),
  sakuraApiClassRoutes: Symbol('sakuraApiClassRoutes')
};

/**
 * Decorator applied to classes that represent routing logic for SakuraApi.
 *
 * ### Example
 * <pre>
 * import sapi from '../index'; // your app's reference to its instance of SakuraApi
 *
 * <span>@</span>Routable(sapi, {
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
export function Routable(sapi: SakuraApi, options?: IRoutableOptions): any {
  options = options || {};
  options.blackList = options.blackList || [];
  options.baseUrl = options.baseUrl || '';

  options.autoRoute = (typeof options.autoRoute === 'boolean') ? options.autoRoute : true;

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
    if (!sapi) {
      throw new Error(`A valid instance of SakuraApi must be provided to the @Routable class '${target.name}'`);
    }

    if (options.model && !options.model[modelSymbols.isSakuraApiModel]) {
      throw new Error(`${target.name} is not decorated by @Model and therefore cannot be used as a model for`
        + ` @Routable`);
    }

    if (options.exposeApi && !Array.isArray(options.exposeApi)) {
      throw new Error(`If @Routable '${target.name}' defines an 'exposeApi' option, that option must be an array of`
        + ` valid strings`);
    }

    if (options.suppressApi && !Array.isArray(options.suppressApi)) {
      throw new Error(`If @Routable '${target.name}' defines a 'suppressApi' option, that option must be an array of`
        + ` valid strings`);
    }

    if ((options.suppressApi || options.exposeApi && !options.model)) {
      throw new Error(`If @Routable '${target.name}' defines a 'suppressApi' or 'exposeApi' option, then a model`
        + ` option with a valid @Model must also be provided`);
    }

    debug('sapi:Routable')(`@Routable decorated '${target.name}' with options ${JSON.stringify(options)}`);

    // -----------------------------------------------------------------------------------------------------------------
    // Developer notes:
    //
    // The constructor proxy implements logic that needs to take place upon constructions
    // =================================================================================================================
    const newConstructor = new Proxy(target, {
      construct: (t, args, nt) => {

        const c = Reflect.construct(t, args, nt);

        const metaData: ISakuraApiClassRoutes[] = [];

        // add routes decorated with @Route (integrator's custom routes)
        for (const methodName of Object.getOwnPropertyNames(Object.getPrototypeOf(c))) {
          if (!Reflect.getMetadata(`hasRoute.${methodName}`, c)) {
            continue;
          }

          if (options.blackList.indexOf(methodName) > -1) {
            continue;
          }

          let endPoint = path
            .join(options.baseUrl, Reflect.getMetadata(`path.${methodName}`, c))
            .replace(/\/$/, '');

          if (!endPoint.startsWith('/')) {
            endPoint = '/' + endPoint;
          }

          const data: ISakuraApiClassRoutes = {
            f: Reflect
              .getMetadata(`function.${methodName}`, c)
              .bind(c),
            httpMethod: Reflect.getMetadata(`httpMethod.${methodName}`, c),
            method: methodName,
            path: endPoint
          };

          metaData.push(data);
        }

        // add generated routes for Model
        if (options.model) {
          addRouteHandler('get', getRouteHandler, c, metaData);
          addRouteHandler('getAll', getAllRouteHandler, c, metaData);
          addRouteHandler('put', putRouteHandler, c, metaData);
          addRouteHandler('post', postRouteHandler, c, metaData);
          addRouteHandler('delete', deleteRouteHandler, c, metaData);
        }

        c[routableSymbols.sakuraApiClassRoutes] = metaData;

        if (options.autoRoute) {
          sapi.route(c);
        }

        return c;
      }
    });

    newConstructor[routableSymbols.debug] = {
      normal: debug('sapi:Routable')
    };
    newConstructor.prototype[routableSymbols.debug] = newConstructor[routableSymbols.debug];

    // -----------------------------------------------------------------------------------------------------------------
    // Developer note:
    // If autoRoute (which is the default), then an instance of the @Routable class is instantiated to cause the routes
    // to be setup. This makes it so that the integrator doesn't have to manually import and instantiate these @Routable
    // classes on his or her own.
    // =================================================================================================================
    if (options.autoRoute) {
      newConstructor[routableSymbols.debug].normal(`${target.name} instantiating`);
      // tslint:disable-next-line: no-unused-expression
      new newConstructor();
    }

    return newConstructor;

    /////
    function addRouteHandler(method: HttpMethod,
                             handler: (req: Express.Request, res: Express.Response) => void,
                             c: any,
                             metaData: ISakuraApiClassRoutes[]) {

      if (!options.suppressApi && !options.exposeApi) {
        metaData.push(generateRoute(method, handler, c));
      }

      if (options.suppressApi && options.suppressApi.indexOf(method) > -1) {
        metaData.push(generateRoute(method, handler, c));
      }

      if (options.exposeApi && options.exposeApi.indexOf(method) > -1) {
        metaData.push(generateRoute(method, handler, c));
      }
    }

    function generateRoute(method: HttpMethod,
                           handler: (req: Express.Request, res: Express.Response) => void,
                           c: any): ISakuraApiClassRoutes {

      const path = ((method === 'get' || method === 'put' || method === 'delete')
        ? `/${(options.baseUrl || (options.model as any).name.toLowerCase())}/:id`
        : `/${options.baseUrl || (options.model as any).name.toLowerCase()}`);

      const data: ISakuraApiClassRoutes = {
        f: handler.bind(options.model),
        httpMethod: httpMethodMap[method],
        method: handler.name,
        path
      };

      addDefaultInstanceMethods(newConstructor, handler.name, handler);
      return data;
    }
  };
}

// tslint:disable:max-line-length
/**
 * By default, when you provide the optional `model` property to [[IRoutableOptions]] in the [[Routable]] parameters,
 * SakuraApi creates a route for GET `{modelName}/:id` that returns an either that document as a model or null if nothing
 * is found.
 *
 * You an constrain the results by providing a `fields` query string parameter.
 *
 * `fields` follows the same rules as (MongoDB field projection)[https://docs.mongodb.com/manual/reference/glossary/#term-projection]
 */
// tslint:enable:max-line-length
function getRouteHandler(req: Request, res: Response) {
  const id = req.params.id;

  let project = null;

  // validate query string parameters
  try {
    assignParameters.call(this);
  } catch (err) {
    return;
  }

  this
    .getById(id, project)
    .then((result) => {
      const response = (result) ? result.toJson() : null;

      res
        .status(200)
        .json(response);

    })
    .catch((err) => {
      // TODO add logging system here
      console.log(err); // tslint:disable-line:no-console
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
 * `fields` follows the same rules as (MongoDB field projection)[https://docs.mongodb.com/manual/reference/glossary/#term-projection]
 *
 * `where` queries are stripped of any `$where` fields. Giving the client the direct ability to define `$where`
 * queries is a bad idea. If you want to do this, you'll have to implement your own route handler.
 */
// tslint:enable:max-line-length
function getAllRouteHandler(req: Request, res: Response) {

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
    return;
  }

  this
    .get(params)
    .then((results) => {

      const response = [];

      for (const result of results) {
        response.push(result.toJson());
      }

      res
        .status(200)
        .json(response);
    })
    .catch((err) => {
      // TODO add logging system here
      console.log(err); // tslint:disable-line:no-console
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

    const limit = req.query.limit || null;
  }
}

function putRouteHandler(req: Request, res: Response) {
  throw new Error('Not Implemented');
}

function postRouteHandler(req: Request, res: Response) {

  if (!req.body || typeof req.body !== 'object') {
    res
      .status(400)
      .json({
        body: req.body,
        error: 'invalid_body'
      });
    return;
  }

  const obj = this.fromJson(req.body);
  obj
    .create()
    .then((result) => {
      res
        .status(200)
        .json({
          count: result.insertedCount,
          id: result.insertedId
        });
    })
    .catch((err) => {
      // TODO add some kind of error handling
      console.log(err); // tslint:disable-line:no-console
    });
}

function deleteRouteHandler(req: Request, res: Response) {

  this
    .removeById(req.params.id)
    .then((result) => {
      res
        .status(200)
        .json({
          n: (result.result || {}).n || 0
        });
    })
    .catch((err) => {
      err.status = 500;
      res
        .status(500)
        .json({
          error: 'internal_server_error'
        });
      // TODO add logging here
      console.log(err); // tslint:disable-line:no-console
    });
}

/**
 * @internal Do not use - may change without notice.
 */
function sanitizedUserInput(res: Response, errMessage: string, fn: () => any) {
  try {
    fn();
  } catch (err) {
    if (err instanceof SyntaxError && err.message && err.message.startsWith('Unexpected token')) {
      res
        .status(400)
        .json({
          details: err.message,
          error: errMessage
        });

      (err as any).status = 400;
    } else {
      res
        .status(500)
        .json({
          error: 'internal_server_error'
        });
      (err as any).status = 500;

      // TODO some kind of error logging here
      console.log(err); // tslint:disable-line:no-console

    }
    throw err;
  }
}
