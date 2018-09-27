import { NextFunction, Request, Response } from 'express';
import { IDbGetParams } from '../core/@model';
import { IRoutableLocals, routableSymbols } from '../core/@routable';
import { BAD_REQUEST, DUPLICATE_RESOURCE, NOT_FOUND, OK, SERVER_ERROR } from '../core/lib';
import { SanitizeMongoDB as Sanitize } from '../core/security';

const debug = {
  normal: require('debug')('sapi:handlers:basic')
};

/**
 * By default, when you provide the optional `model` property to [[IRoutableOptions]] in the [[Routable]] parameters,
 * SakuraApi creates a route for GET `{modelName}/:id` that returns either that document as a model or null if
 * nothing is found.
 *
 * You can constrain the results by providing a `fields` query string parameter.
 *
 * `fields` follows the same rules as (MongoDB field
 * projection)[https://docs.mongodb.com/manual/reference/glossary/#term-projection]
 */
export function getRouteHandler(req: Request, res: Response, next: NextFunction) {

  const model = res.locals.routable[routableSymbols.model]
    ? res.locals.routable[routableSymbols.model]()
    : null;
  const id = req.params.id;
  const resLocals = res.locals as IRoutableLocals;

  if (!model) {
    throw new Error(`${(this.constructor || {} as any).name || this.name} is attempting to use handler 'getRouteHandler',`
      + ` which requires ${(this.constructor || {} as any).name || this.name} to be bound to a model`);
  }

  let project = null;

  // validate query string parameters
  try {
    assignParameters.call(model);
  } catch (err) {
    debug.normal(`getRouteHandler threw error: ${err}`);
    return next();
  }

  debug.normal(`getRouteHandler called with id:'%o', field projection: %o`, id, project);

  model
    .getById(id, project)
    .then((result) => {
      const response = (result) ? result.toJson() : null;
      resLocals.status = OK;
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
        model.fromJsonToDb(
          Sanitize.whiteList$Keys(
            req.query.fields, allowedFields$Keys)
        )));
  }
}

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
export function getAllRouteHandler(req: Request, res: Response, next: NextFunction) {
  const model = res.locals.routable[routableSymbols.model]
    ? res.locals.routable[routableSymbols.model]()
    : null;
  const resLocals = res.locals as IRoutableLocals;

  if (!model) {
    throw new Error(`${(this.constructor || {} as any).name || this.name} is attempting to use handler 'getAllRouteHandler',`
      + ` which requires ${(this.constructor || {} as any).name || this.name} to be bound to a model`);
  }

  const params: IDbGetParams = {
    filter: null,
    limit: null,
    project: null,
    skip: null
  };

  // validate query string parameters
  try {
    assignParameters.call(model);
  } catch (err) {
    debug.normal(`getAllRouteHandler threw error: ${err}`);
    return next();
  }

  debug.normal(`.getAllRouteHandler called with params: %o`, params);

  model
    .get(params)
    .then((results) => {
      const response = [];

      for (const result of results) {
        response.push(result.toJson());
      }

      resLocals.send(OK, response);
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
        model.fromJsonToDb(
          Sanitize.remove$where(req.query.where)
        )));

    const allowedFields$Keys = [];
    sanitizedUserInput(res, 'invalid_fields_parameter', () =>
      params.project = Sanitize.flattenObj(
        model.fromJsonToDb(
          Sanitize.whiteList$Keys(
            req.query.fields, allowedFields$Keys)
        )));

    if (req.query.skip !== undefined) {
      sanitizedUserInput(res, 'invalid_skip_parameter', () => {
        params.skip = Number.parseInt(req.query.skip, 10);
        if (Number.isNaN(params.skip)) {
          throw new SyntaxError('Unexpected token');
        }
      });
    }

    if (req.query.limit !== undefined) {
      sanitizedUserInput(res, 'invalid_limit_parameter', () => {
        params.limit = Number.parseInt(req.query.limit, 10);
        if (Number.isNaN(params.limit)) {
          throw new SyntaxError('Unexpected token');
        }
      });
    }
  }
}

export function putRouteHandler(req: Request, res: Response, next: NextFunction) {
  const model = res.locals.routable[routableSymbols.model]
    ? res.locals.routable[routableSymbols.model]()
    : null;
  const id = req.params.id;
  const resLocals = res.locals as IRoutableLocals;

  if (!model) {
    throw new Error(`${(this.constructor || {} as any).name || this.name} is attempting to use handler 'putRouteHandler',`
      + ` which requires ${(this.constructor || {} as any).name || this.name} to be bound to a model`);
  }

  if (!req.body || typeof req.body !== 'object') {
    resLocals
      .send(BAD_REQUEST, {
        body: req.body,
        error: 'invalid_body'
      });
    return next();
  }

  if (!id) {
    resLocals
      .send(BAD_REQUEST, {
        body: req.body,
        error: 'invalid_body_missing_id'
      });
    return next();
  }

  const changeSet = model.fromJsonToDb(req.body);

  debug.normal(`.putRouteHandler called with id: '%O' changeSet: %O`, id, changeSet);

  model
    .getById(id)
    .then((obj) => {
      if (!obj) {
        resLocals.status = NOT_FOUND;
        return next();
      }

      obj
        .save(changeSet)
        .then((result) => {
          resLocals
            .send(OK, {
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

export function postRouteHandler(req: Request, res: Response, next: NextFunction) {
  const model = res.locals.routable[routableSymbols.model]
    ? res.locals.routable[routableSymbols.model]()
    : null;
  const resLocals = res.locals as IRoutableLocals;

  if (!model) {
    throw new Error(`${(this.constructor || {} as any).name || this.name} is attempting to use handler 'postRouteHandler',`
      + ` which requires ${(this.constructor || {} as any).name || this.name} to be bound to a model`);
  }

  if (!req.body || typeof req.body !== 'object') {
    resLocals
      .send(BAD_REQUEST, {
        body: req.body,
        error: 'invalid_body'
      });
    return next();
  }

  const obj = model.fromJson(req.body);

  debug.normal(`.postRouteHandler called with obj: %O`, obj);

  obj
    .create()
    .then((result) => {
      resLocals
        .send(OK, {
          count: result.insertedCount,
          id: result.insertedId
        });
      next();
    })
    .catch((err) => {
      if (err.name === 'MongoError') {
        switch (err.code) {
          case 11000:
            err.status = DUPLICATE_RESOURCE;
            resLocals.send(DUPLICATE_RESOURCE, {
              error: 'duplicate_resource'
            });
            break;
          default:
            err.status = SERVER_ERROR;
            resLocals.send(SERVER_ERROR, {
              error: 'internal_server_error'
            });
        }
      } else {
        err.status = SERVER_ERROR;
        resLocals.send(SERVER_ERROR, {
          error: 'internal_server_error'
        });
      }

      // TODO add some kind of error handling
      if (err.status === SERVER_ERROR) {
        console.log(err); // tslint:disable-line:no-console
      }

      next();
    });
}

export function deleteRouteHandler(req: Request, res: Response, next: NextFunction) {
  const model = res.locals.routable[routableSymbols.model]
    ? res.locals.routable[routableSymbols.model]()
    : null;
  const resLocals = res.locals as IRoutableLocals;

  const id = req.params.id;
  if (!model) {
    throw new Error(`${(this.constructor || {} as any).name || this.name} is attempting to use handler 'deleteRouteHandler',`
      + ` which requires ${(this.constructor || {} as any).name || this.name} to be bound to a model`);
  }

  debug.normal(`.deleteRouteHandler called with id: '%O'`, id);

  model
    .removeById(id)
    .then((result) => {
      resLocals.send(OK, {
        n: (result.result || {}).n || 0
      });
      next();
    })
    .catch((err) => {
      err.status = SERVER_ERROR;
      resLocals.send(SERVER_ERROR, {
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
        .send(BAD_REQUEST, {
          details: err.message,
          error: errMessage
        }, res);
      (err as any).status = BAD_REQUEST;
    } else {
      res
        .locals
        .send(SERVER_ERROR, {
          error: 'internal_server_error'
        }, res);
      (err as any).status = SERVER_ERROR;
      // TODO some kind of error logging here
      console.log(err); // tslint:disable-line:no-console
    }

    throw err;
  }
}
