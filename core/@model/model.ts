import {Db} from 'mongodb';
import {
  addDefaultInstanceMethods,
  addDefaultStaticMethods
} from '../helpers/defaultMethodHelpers';
import {jsonSymbols} from './json';
import {privateSymbols} from './private';

/**
 * Interface used by classes that are decorated with `@Model` ([[Model]]) to prevent
 * TypeScript type errors since TypeScript isn't aware that these methods were injected
 * by `@Model()`.
 */
export interface IModel {
  create?: (any) => any;
  delete?: (any) => any;
  save?: (any) => any;
  toJson?: (any) => any;
  toJsonString?: (any) => string;
}

/**
 * Interface defining the valid properties for the `@Model({})` decorator ([[Model]]).
 */
export interface ModelOptions {
  /**
   * The database to which this @Model object is bound
   */
  dbConfig?: {
    /**
     * The name of the database for this model which is used to retrieve the `MongoDB` `Db` object from
     * [[SakuraMongoDbConnection]]. I.e, whatever name you used in your congifuration of [[SakuraMongoDbConnection]]
     * for the database connection for this model, use that name here.
     */
    db?: string;

    /**
     * The name of the collection in the database referenced in `db` that represents this model.
     */
    collection?: string;
  }
  /**
   * Prevents the injection of CRUD functions (see [[Model]] function).
   */
  suppressInjection?: string[];
}

/**
 * A collection of symbols used internally by [[Model]].
 */
export const modelSymbols = {
  fromJson: Symbol('fromJson'),
  fromJsonArray: Symbol('fromJsonArray'),
  isSakuraApiModel: Symbol('isSakuraApiModel'),
  toJson: Symbol('toJson'),
  toJsonString: Symbol('toJsonString')
};

/**
 * Decorator applied to classes that represent models for SakuraApi.
 *
 * ### Example
 * <pre>
 * <span>@</span>Model()
 * class User {
 *    firstName: string = '';
 *    lastName: string = '';
 * }
 * </pre>
 *
 * ### Injection
 * #### Metadata
 * `@Model` injects metadata for the class being decorated that's used by
 * SakuraApi to support its functionality.
 *
 * #### CRUD Functions
 * `@Model` injects functions that are used by SakuraApi, but can also be used by the
 * integrator. Injected functions include:
 * * *static*:
 *   * get
 *   * getById
 *   * delete
 * * *instance*:
 *   * create
 *   * save
 *   * delete
 *
 * #### Utility Functions
 * * *static*:
 *   * **`fromJson<T>(json: any, ...constructorArgs: any[]): T`** - takes a json object and returns an instantiated object
 * of the proper type. It also takes a variadic array of parameters that are passed on to the object's constructor.
 *   * *static*: **`fromJsonArray<T>(json: any, ...constructorArgs: any[]): T[]`** - takes an array of json objects and returns an
 * array of instantiated objects of the property type. It also takes a variadic array of parameters that are passed onto the
 * object's constructor.
 * * *instance*:
 *   * **`toJson()`** - returns the current object as json, respecting the various decorators like [[Private]]
 * and [[Json]].
 *   * **`toJsonString`** - works just like the aforementioned `toJson` but returns a string instead of a json object.
 *
 * These utility functions can be changed to point to a custom function references without breaking SakuraApi. They're
 * mapped for the integrators convenience. If the integrator wants to actually change the underlying behavior that
 * SakuraApi uses, then the new function should be assigned to the appropriate symbol ([[modelSymbols]]).
 */
export function Model(options?: ModelOptions): any {
  options = options || <ModelOptions>{};

  return function (target: any) {
    // add default static methods
    addDefaultStaticMethods(target, 'get', crudGet, options);
    addDefaultStaticMethods(target, 'getById', crudGetById, options);
    addDefaultStaticMethods(target, 'delete', stub, options);

    // Various internal methods are exposed to the integrator,
    // but allow the integrator to replace this functionality without
    // breaking the internal functionality
    target.fromJson = fromJson;
    target[modelSymbols.fromJson] = fromJson;

    target.fromJsonArray = fromJsonArray;
    target[modelSymbols.fromJsonArray] = fromJsonArray;

    // decorate the constructor
    let newConstructor = new Proxy(target, {
      construct: function (t, args, nt) {
        let c = Reflect.construct(t, args, nt);

        // isSakuraApiModel
        Reflect.defineProperty(c, modelSymbols.isSakuraApiModel, {
          value: true,
          writable: false
        });

        c.db = ((options || <any>{}).dbConfig || <any>{}).db || null;
        c.collection = ((options || <any>{}).dbConfig || <any>{}).collection || null;

        return c;
      }
    });

    // Inject default instance methods for CRUD if not already defined by integrator
    addDefaultInstanceMethods(newConstructor, 'create', crudCreate, options);
    addDefaultInstanceMethods(newConstructor, 'save', crudSave, options);
    addDefaultInstanceMethods(newConstructor, 'delete', crudDelete, options);

    newConstructor.prototype.toJson = toJson;
    newConstructor.prototype[modelSymbols.toJson] = toJson;

    newConstructor.prototype.toJsonString = toJsonString;
    newConstructor.prototype[modelSymbols.toJsonString] = toJsonString;

    return newConstructor;

    /////
    function crudCreate(msg) {
      return msg;
    }

    function crudSave(set: any) {
      return new Promise((resolve, reject) => {
        (this.db as Db)
          .collection(this.collection)
          .updateOne(this.id, {$set: set || this})
          .then(resolve)
          .catch(reject);
      });
    }

    function crudDelete(msg) {
      return msg;
    }

    function crudGet(msg) {
      return msg
    }

    function crudGetById(msg) {
      return msg
    }

    function fromJson<T>(json: any, ...constructorArgs: any[]): T {
      if (!json || typeof json !== 'object') {
        return null;
      }

      let obj = new newConstructor(...constructorArgs);

      let propertyNamesByJsonFieldName: Map<string, string> = Reflect.getMetadata(jsonSymbols.sakuraApiJsonFieldToPropertyNames, obj);

      for (let field of Object.getOwnPropertyNames(json)) {
        let prop = (propertyNamesByJsonFieldName) ? propertyNamesByJsonFieldName.get(field) : null;
        if (prop) {
          obj[prop] = json[field]; // an @Json alias field
        } else if (Reflect.has(obj, field)) {
          obj[field] = json[field]; // a none @Json alias field
        }
      }

      return obj;
    }

    function fromJsonArray<T>(json: any, ...constructorArgs: any[]): T[] {
      let result = [];

      if (Array.isArray(json)) {
        for (let item of json) {
          result.push(target[modelSymbols.fromJson](item, ...constructorArgs));
        }
      }

      return result;
    }

    function toJson() {
      let jsonFieldNamesByProperty: Map<string, string> = Reflect.getMetadata(jsonSymbols.sakuraApiJsonPropertyToFieldNames, this);
      jsonFieldNamesByProperty = jsonFieldNamesByProperty || new Map<string,string>();

      let privateFields: Map<string, string> = Reflect.getMetadata(privateSymbols.sakuraApiPrivatePropertyToFieldNames, this);

      let obj = {};
      for (let prop of Object.getOwnPropertyNames(this)) {
        if (typeof this[prop] !== 'function') {

          let override = (privateFields) ? privateFields.get(prop) : null;
          if (override && typeof this[override] === 'function' && !this[override]()) {
            continue;
          } else if (override && !this[override]) {
            continue;
          }
          obj[jsonFieldNamesByProperty.get(prop) || prop] = this[prop];
        }
      }
      return obj;
    }

    function toJsonString(replacer?: (any) => any, space?: string | number) {
      return JSON.stringify(this[modelSymbols.toJson](), replacer, space);
    }
  };
}

//////////

/**
 * This is here to stub out the CRUD functionality since SakuraApi doesn't actually have DB integration yet.
 */
function stub(msg) {
  return msg;
}

