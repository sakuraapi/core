import { v4 } from 'uuid';
import { getDependencyInjections } from '../@injectable';
import { addDefaultInstanceMethods, addDefaultStaticMethods } from '../lib';
import { idSymbols } from './id';
import {
  create,
  fromDb,
  fromDbArray,
  fromJson,
  fromJsonArray,
  fromJsonToDb,
  get,
  getById,
  getCollection,
  getCursor,
  getCursorById,
  getDb,
  getOne,
  remove,
  removeAll,
  removeById,
  save,
  toDb,
  toJson,
  toJsonString
} from './model-operators';

export interface IMongoDBCollation {
  locale: string;
  caseLevel?: boolean;
  caseFirst?: string;
  strength?: number;
  numericOrdering?: boolean;
  alternate?: string;
  maxVariable?: string;
  backwards?: boolean;
}

/**
 * Interface defining the properties used for retrieving records from the DB
 * - comment: https://docs.mongodb.com/manual/reference/method/cursor.comment/
 * - filter: a normal mongodb filter that gets applied to a cursor
 * - limit: https://docs.mongodb.com/manual/reference/method/cursor.limit/
 * - project: a normal mongodb projection that gets applied to a cursor
 * - skip: https://docs.mongodb.com/manual/reference/method/cursor.skip/
 * - sort: https://docs.mongodb.com/manual/reference/method/cursor.sort/
 */
export interface IDbGetParams {
  collation?: IMongoDBCollation;
  comment?: string;
  filter?: any;
  limit?: number;
  project?: any;
  skip?: number;
  sort?: any;
}

/**
 * Interface defining the valid properties for options passed to [[toDb]].
 */
export interface IFromDbOptions {
  /**
   * If set to true, the resulting model will only have the properties for fields present in the document returned from
   * the database
   */
  strict?: boolean;
}

/**
 * Interface defining the properties for the `@`[[Model]]({})` decorator.
 */
export interface IModelOptions {
  /**
   * The database to which this @Model object is bound
   */
  dbConfig?: {
    /**
     * Optionally set the default MongoDB collation for this model.
     * For valid settings see:
     * https://docs.mongodb.com/manual/reference/collation-locales-defaults/#collation-languages-locales
     */
    collation?: IMongoDBCollation;
    /**
     * The name of the collection in the database referenced in `db` that represents this model.
     */
    collection: string;

    /**
     * The name of the database for this model which is used to retrieve the `MongoDB` `Db` object from
     * [[SakuraMongoDbConnection]]. I.e, whatever name you used in your congifuration of [[SakuraMongoDbConnection]]
     * for the database connection for this model, use that name here.
     */
    db: string;

    /**
     * If true, fields without an Explicit @Db will still be written to the Db and used to rehydrate objects `fromDb`.
     */
    promiscuous?: boolean;
  };

  /**
   * Returns the cipher key to be used by @Json decorated properties with [[IJsonOption.encrypt]] === true. Provide
   * a function that returns the key as a string. The function will be given the context of `this` of the model
   * from which it is being called.
   */
  cipherKey?: () => string;

  /**
   * Prevents the injection of CRUD functions (see [[Model]] function).
   */
  suppressInjection?: string[];
}

/**
 * A collection of symbols used internally by [[Model]].
 */
export const modelSymbols = {
  cipherKey: Symbol('cipherKey'),
  constructor: Symbol('constructor'),
  dbCollation: Symbol('dbCollation'),
  dbCollection: Symbol('dbCollection'),
  dbName: Symbol('dbName'),
  fromDb: Symbol('fromDb'),
  fromDbArray: Symbol('fromDbArray'),
  fromJson: Symbol('fromJson'),
  fromJsonArray: Symbol('fromJsonArray'),
  fromJsonToDb: Symbol('fromJsonToDb'),
  id: Symbol('GUID id for model DI'),
  isSakuraApiModel: Symbol('isSakuraApiModel'),
  modelOptions: Symbol('modelOptions'),
  sapi: Symbol('sapi'),
  toDb: Symbol('toDb'),
  toJson: Symbol('toJson'),
  toJsonString: Symbol('toJsonString')
};

/**
 * An attempt was made to use [[SakuraApi.getModel]] with a parameter that isn't decorated with `@`[[Model]].
 */
export class ModelsMustBeDecoratedWithModelError extends Error {
  constructor(target: any) {
    const targetName = (target || {} as any).name
      || ((target || {} as any).constructor || {} as any).name
      || typeof target;

    super(`Invalid attempt to get ${targetName} must be decorated with @Model`);
  }
}

/**
 * Thrown when an attempt is made to use an object as a Model, which has not been registered with the dependency
 * injection system. You register models when you are instantiating the instance of [[SakuraApi]] for your
 * application.
 */
export class ModelNotRegistered extends Error {
  constructor(target: any) {
    const targetName = (target || {} as any).name
      || ((target || {} as any).constructor || {} as any).name
      || typeof target;

    super(`${targetName} is not registered as a model with SakuraApi`);
  }
}

/**
 * Decorator applied to classes that represent models for SakuraApi.
 *
 * ### Example
 * <pre>
 *
 * <span>@</span>Model()
 * class User {
 *    firstName: string = '';
 *    lastName: string = '';
 * }
 * </pre>
 *
 * ### Injection of CRUD & Utility Functions
 * `@`[[Model]] injects functions that are used by SakuraApi, but can also be used by the
 * integrator. Injected functions include:
 * * *static*:
 *   * [[fromDb]]
 *   * [[fromDbArray]]
 *   * [[fromJson]]
 *   * [[fromJsonArray]]
 *   * [[fromJsonToDb]]
 *   * [[get]]
 *   * [[getById]]
 *   * [[getCursor]]
 *   * [[getCursorById]]
 *   * [[getDb]]
 *   * [[getOne]]
 *   * [[removeAll]]
 *   * [[removeById]]
 *   * sapi: the `@`[[Routable]]'s instance of [[SakuraApi]] that was injected during SakuraApi construction
 *   * sapiConfig: the `@`[[Routable]]'s [[SakuraApi]] config (this is a shortcut to sapi.config)
 * * *instance*:
 *   * [[create]]
 *   * [[remove]]
 *   * [[save]]
 *   * [[toJson]]
 *   * [[toJsonString]]
 *
 * Injected functions can be changed to point to a custom function references without breaking SakuraApi. They're
 * mapped for the integrators convenience. If the integrator wants to actually change the underlying behavior that
 * SakuraApi uses, then the new function should be assigned to the appropriate symbol ([[modelSymbols]]).
 */
export function Model(modelOptions?: IModelOptions): (object) => any {
  modelOptions = modelOptions || {} as IModelOptions;

  // -------------------------------------------------------------------------------------------------------------------
  // Developer notes:
  //
  // `target` represents the constructor function that is being reflected upon by the `@Model` decorator. It is
  // decorated via a Proxy and becomes `newConstrutor` <- this is the decorated constructor function resulting
  // from the `@Model` decorator.
  //
  // To add an instance member: newConstructor.prototype.newFunction = () => {}
  // to add a static member: newConstructor.newFunction = () => {}
  // ===================================================================================================================
  return (target: any) => {
    // -----------------------------------------------------------------------------------------------------------------
    // Developer notes:
    //
    // The constructor proxy implements logic that needs to take place upon constructions
    // =================================================================================================================
    const newConstructor = new Proxy(target, {
      construct: (t, args, nt) => {

        const diArgs = getDependencyInjections(target, t, target[modelSymbols.sapi]);

        const c = Reflect.construct(t, diArgs, nt);

        const idProperty = Reflect.getMetadata(idSymbols.idByPropertyName, c);
        if (!idProperty && modelOptions.dbConfig) {
          throw new Error(`Model ${target.name} defines 'dbConfig' but does not have an @Id decorated properties`);
        }

        // map _id to id
        newConstructor.prototype._id = undefined;

        Reflect.defineProperty(c, idProperty, {
          configurable: true,
          enumerable: true,
          get: () => c._id,
          set: (v) => c._id = v
        });

        // Check to make sure that if the @Model object has dbConfig upon construction, that it actually
        // has those properties defined. Otherwise, throw an error to help the integrator know what s/he's doing
        // wrong.
        if (modelOptions.dbConfig) {
          if (!target[modelSymbols.dbName]) {
            throw new Error(`If you define a dbConfig for a model, you must define a db. Model: ${target.name}`);
          }

          if (!target[modelSymbols.dbCollection]) {
            throw new Error(`If you define a dbConfig for a model, you must define a collection. Model: ${target.name}`);
          }
        }

        if (modelOptions.cipherKey) {
          c[modelSymbols.cipherKey] = modelOptions.cipherKey.call(c);
        }

        return c;
      }
    });

    // DI unique identifier
    Reflect.defineProperty(newConstructor, modelSymbols.id, {
      value: v4(),
      writable: false
    });

    // isSakuraApiModel hidden property is attached to let other parts of the framework know that this is an @Model obj
    Reflect.defineProperty(newConstructor.prototype, modelSymbols.isSakuraApiModel, {
      value: true,
      writable: false
    });

    Reflect.defineProperty(newConstructor, modelSymbols.isSakuraApiModel, {
      value: true,
      writable: false
    });

    // make a copy of the model options available to the decorated objected
    newConstructor[modelSymbols.modelOptions] = modelOptions;
    // tag instances with the constructor function for the class to make it easier to determine when `this`
    // is pointing to an instance of the class or the class constructor.
    newConstructor.prototype[modelSymbols.constructor] = newConstructor;

    newConstructor[modelSymbols.dbName] = (modelOptions.dbConfig || {} as any).db || null;
    newConstructor[modelSymbols.dbCollection] = (modelOptions.dbConfig || {} as any).collection || null;
    newConstructor[modelSymbols.dbCollation] = (modelOptions.dbConfig || {} as any).collation || null;

    // -----------------------------------------------------------------------------------------------------------------
    // Developer notes:
    //
    // Instance method injection... TypeScript won't know these are part of the type of the object being constructed
    // since they're dynamically injected. Extend Models with SapiModelMixin to overcome this.
    //
    //  example:
    //    @Model()
    //    class Example extends SapiModelMixin() {}
    // =================================================================================================================

    // Inject static methods
    addDefaultStaticMethods(newConstructor, removeAll, modelOptions);
    addDefaultStaticMethods(newConstructor, removeById, modelOptions);
    addDefaultStaticMethods(newConstructor, get, modelOptions);
    addDefaultStaticMethods(newConstructor, getOne, modelOptions);
    addDefaultStaticMethods(newConstructor, getById, modelOptions);
    addDefaultStaticMethods(newConstructor, getCursor, modelOptions);
    addDefaultStaticMethods(newConstructor, getCursorById, modelOptions);
    addDefaultStaticMethods(newConstructor, getCollection, modelOptions);
    addDefaultStaticMethods(newConstructor, getDb, modelOptions);

    // Various internal methods are exposed to the integrator,
    // but allow the integrator to replace this functionality without
    // breaking the internal functionality
    newConstructor.fromDb = fromDb;
    newConstructor[modelSymbols.fromDb] = fromDb;

    newConstructor.fromDbArray = fromDbArray;
    newConstructor[modelSymbols.fromDbArray] = fromDbArray;

    newConstructor.fromJson = fromJson;
    newConstructor[modelSymbols.fromJson] = fromJson;

    newConstructor.fromJsonArray = fromJsonArray;
    newConstructor[modelSymbols.fromJsonArray] = fromJsonArray;

    newConstructor.fromJsonToDb = fromJsonToDb;
    newConstructor[modelSymbols.fromJsonToDb] = fromJsonToDb;

    newConstructor.dbLocale = (newConstructor[modelSymbols.dbCollation] || {} as any).locale;
    newConstructor.prototype.dbLocale = (newConstructor[modelSymbols.dbCollation] || {} as any).locale;

    newConstructor[modelSymbols.sapi] = null; // injected by [[SakuraApi.registerModels]]

    // Injects sapi as a shortcut property on models pointing to newConstructor[modelSymbols.sapi]
    Reflect.defineProperty(newConstructor, 'sapi', {
      configurable: false,
      enumerable: false,
      get: () => newConstructor[modelSymbols.sapi]
    });

    // Injects sapi as a shortcut property on models pointing to newConstructor[modelSymbols.sapi]
    Reflect.defineProperty(newConstructor.prototype, 'sapi', {
      configurable: false,
      enumerable: false,
      get: () => newConstructor[modelSymbols.sapi]
    });

    // Injects sapiConfig as a shortcut property on models pointing to newConstructor[modelSymbols.sapi].config
    Reflect.defineProperty(newConstructor, 'sapiConfig', {
      configurable: false,
      enumerable: false,
      get: () => (newConstructor[modelSymbols.sapi] || {} as any).config
    });

    // Injects sapiConfig as a shortcut property on models pointing to newConstructor[modelSymbols.sapi].config
    Reflect.defineProperty(newConstructor.prototype, 'sapiConfig', {
      configurable: false,
      enumerable: false,
      get: () => (newConstructor[modelSymbols.sapi] || {} as any).config
    });

    // -----------------------------------------------------------------------------------------------------------------
    // Developer notes:
    //
    // Instance method injection... TypeScript won't know these are part of the type of the object being constructed
    // since they're dynamically injected. Extend Models with SapiModelMixin to overcome this.
    //
    //  example:
    //    @Model()
    //    class Example extends SapiModelMixin() {}
    // =================================================================================================================

    // Inject default instance methods for CRUD if not already defined by integrator
    addDefaultInstanceMethods(newConstructor, create, modelOptions);
    addDefaultInstanceMethods(newConstructor, getCollection, modelOptions);
    addDefaultInstanceMethods(newConstructor, getDb, modelOptions);
    addDefaultInstanceMethods(newConstructor, remove, modelOptions);
    addDefaultInstanceMethods(newConstructor, save, modelOptions);

    newConstructor.prototype.toDb = toDb;
    newConstructor.prototype[modelSymbols.toDb] = toDb;

    newConstructor.prototype.toJson = toJson;
    newConstructor.prototype[modelSymbols.toJson] = toJson;

    newConstructor.prototype.toJsonString = toJsonString;
    newConstructor.prototype[modelSymbols.toJsonString] = toJsonString;

    return newConstructor;
  };
}
