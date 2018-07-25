// tslint:disable:max-line-length
import {
  Collection,
  CollectionInsertOneOptions,
  CommonOptions,
  Cursor,
  Db,
  DeleteWriteOpResultObject,
  InsertOneWriteOpResult,
  ObjectID,
  ReplaceOneOptions,
  UpdateWriteOpResult
} from 'mongodb';
import { Constructor, IContext } from '../lib';
import { SakuraApi } from '../sakura-api';
import { IDbGetParams, IFromDbOptions } from './';
import { IMongoDBCollation } from './model';
import { IFromJsonOptions } from './model-operators';

/**
 * Integrators should extend their Models with this Mixin to get type checking.
 *
 * ### Example
 * <pre>
 * class SuperChicken extends SapiModelMixins() {
 * }
 * </pre>
 *
 * If your class inherits from a base class, you can:
 * ### Example
 * <pre>
 * class SuperChicken extends SapiModelMixins(BaseClass) {
 * }
 * </pre>
 *
 * * You can also mixin other mixins so long as they follow the patterns established here:
 * * https://www.typescriptlang.org/docs/handbook/mixins.html
 * * https://www.typescriptlang.org/docs/handbook/release-notes/typescript-2-2.html
 * * http://justinfagnani.com/2015/12/21/real-mixins-with-javascript-classes/
 *
 * You can override an injected method like this:
 * ### Example
 * <pre>
 * class SuperChicken extends SapiModelMixins(BaseClass) {
 * }
 *
 * (SuperChicken as any).getById(id:string | ObjectID, project?:any) => Promise<SuperChicken> {
 * ...
 * }
 *
 * (SuperChicken as any).prototype.remove(filter: any | null, options?: CommonOptions) => Promise<DeleteWriteOpResultObject> {
 * ...
 * }
 * </pre>
 *
 * Just remember to stick to the interface in case SakuraAPI is calling the method being overriden internally.
 */
export function SapiModelMixin<C extends Constructor<{}>>(base?: C) {
  base = base || class {
  } as C;

  return class extends base {

    static dbLocale: string;
    static sapi: SakuraApi;
    static sapiConfig?: any;

    static fromDb: <T>(this: { new(): T }, json: any, options?: IFromDbOptions) => T;
    static fromDbArray: <T>(this: { new(): T }, jsons: object[], options?: IFromDbOptions) => T[];
    static fromJson: <T>(this: { new(...params): T }, json: object, context?: string, options?: IFromJsonOptions) => T;
    static fromJsonArray: <T>(this: { new(): T }, jsons: object[]) => T[];
    static fromJsonToDb: (json: any, context?: string) => any;
    static get: <T>(this: { new(): T }, params?: IDbGetParams) => Promise<T[]>;
    static getById: <T>(this: { new(): T }, id: string | ObjectID, project?: any, collation?: IMongoDBCollation) => Promise<T>;
    static getCollection: () => Collection;
    static getCursor: (filter: any, project?: any, collation?: IMongoDBCollation) => Cursor<any>;
    static getCursorById: (id: ObjectID | string, project?: any, collation?: IMongoDBCollation) => Cursor<any>;
    static getDb: () => Db;
    static getOne: <T>(this: { new(): T }, filter: any, project?: any, collation?: IMongoDBCollation) => Promise<T>;
    static removeAll: (filter: any, options?: CommonOptions) => Promise<DeleteWriteOpResultObject>;
    static removeById: (id: ObjectID, options?: CommonOptions) => Promise<DeleteWriteOpResultObject>;

    _id: ObjectID;
    dbLocale: string;

    create: (options?: CollectionInsertOneOptions, context?: string) => Promise<InsertOneWriteOpResult>;
    getCollection: () => Collection;
    getDb: () => Db;
    toJson: (context?: string | IContext) => any;
    toJsonString: (replacer?: () => any | Array<string | number>, space?: string | number) => string;
    toDb: (changeSet?: object) => any;
    remove: (options?: CommonOptions) => Promise<DeleteWriteOpResultObject>;
    sapi: SakuraApi;
    sapiConfig?: any;
    save: (set?: { [key: string]: any } | null, options?: ReplaceOneOptions, context?: string) => Promise<UpdateWriteOpResult>;

    constructor(...args: any[]) {
      super(...args);
    }
  };
}

// tslint:enable:max-line-length
