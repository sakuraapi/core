import {
  Collection,
  CollectionInsertOneOptions,
  CollectionOptions,
  Cursor,
  Db,
  DeleteWriteOpResultObject,
  InsertOneWriteOpResult,
  ObjectID,
  ReplaceOneOptions,
  UpdateWriteOpResult
} from 'mongodb';
import {IDbGetParams, IFromDbOptions} from './';
/***
 * Integrators should extend their [[Model]] classes with this abstract class to get typing for the `@`[[Model]] mixin
 * functions that are injected. If you need to have a custom super class that cannot extend this abstract class,
 * it's sufficient for you to copy and paste these type definitions into your super class to get the same typing.
 *
 * For example, let's say you had a super class SuperChicken that already extends some class you don't control... for
 * example, SuperHeroBirds. Since ES doesn't support multiple inheritance, you could just copy and past the
 * type definitions for `@`[[Model]] mixins into `SuperChicken`:
 *
 * ### Example
 * <pre>
 * class SuperChicken extends SuperHeroBirds {
 *   static fromDb?: <T>(this: { new(): T }, json: any, options?: IFromDbOptions) => T;
 *
 *   static fromJson?: <T>(this: { new(...any): T }, json: object, ...constructorArgs: any[]) => T;
 *   static fromJsonToDb?: (json: any) => any;
 *
 *   static fromDbArray?: <T>(this: { new(): T }, jsons: object[], ...constructorArgs) => T[];
 *   static fromJsonArray?: <T>(this: { new(): T }, jsons: object[], ...constructorArgs: any[]) => T[];
 *
 *   static get?: <T>(this: { new (): T }, params: IDbGetParams) => Promise<T[]>;
 *   static getById?: <T>(this: { new (): T }, id: string | ObjectID, project?: any) => Promise<T>;
 *   static getCollection?: () => Collection;
 *   static getCursor?: (filter: any, project?: any) => Cursor<any>;
 *   static getCursorById?: (id, project?: any) => Cursor<any>;
 *   static getDb?: () => Db;
 *   static getOne?: <T>(this: { new (): T }, filter: any, project?: any) => Promise<T>;
 *
 *   static mapJsonToDb?: (json: object) => object;
 *
 *   static removeAll?: (filter: any, options?: CollectionOptions) => Promise<DeleteWriteOpResultObject>;
 *   static removeById?: (id: ObjectID, options?: CollectionOptions) => Promise<DeleteWriteOpResultObject>;
 *
 *   _id?: ObjectID; // tslint:disable-line
 *   id?: ObjectID;
 *
 *   create?: (options?: CollectionInsertOneOptions) => Promise<InsertOneWriteOpResult>;
 *
 *   getCollection?: () => Collection;
 *   getDb?: () => Db;
 *
 *   remove?: (filter: any | null, options?: CollectionOptions) => Promise<DeleteWriteOpResultObject>;
 *   save?: (set?: { [key: string]: any } | null, options?: ReplaceOneOptions) => Promise<UpdateWriteOpResult>;
 *
 *   toDb?: (changeSet?: object) => any;
 *   toJson?: (projection?: any) => any;
 *   toJsonString?: (replacer?: () => any | Array<string | number>, space?: string | number) => string;
 *
 *   ///
 *   // your class implementation continues on here...
 * }
 * </pre>
 * Pain in the arse? Sure. Unfortunately, TypeScript interfaces don't allow you to define static interface
 * members.
 */
export abstract class SakuraApiModel {
  static fromDb?: <T>(this: { new(): T }, json: any, options?: IFromDbOptions) => T;
  // tslint:disable-next-line:variable-name
  static fromJson?: <T>(this: { new(...any): T }, json: object, ...constructorArgs: any[]) => T;
  static fromJsonToDb?: (json: any) => any;

  static fromDbArray?: <T>(this: { new(): T }, jsons: object[], options?: IFromDbOptions) => T[];
  static fromJsonArray?: <T>(this: { new(): T }, jsons: object[], ...constructorArgs: any[]) => T[];

  static get?: <T>(this: { new (): T }, params: IDbGetParams) => Promise<T[]>;
  static getById?: <T>(this: { new (): T }, id: string | ObjectID, project?: any) => Promise<T>;
  static getByEmail?: <T>(this: { new (): T }, email: string, project?: any) => Promise<T>;
  static getCollection?: () => Collection;
  static getCursor?: (filter: any, project?: any) => Cursor<any>;
  static getCursorById?: (id, project?: any) => Cursor<any>;
  static getCursorByEmail?: (email, project?: any) => Cursor<any>;
  static getDb?: () => Db;
  static getOne?: <T>(this: { new (): T }, filter: any, project?: any) => Promise<T>;

  static mapJsonToDb?: (json: object) => object;

  static removeAll?: (filter: any, options?: CollectionOptions) => Promise<DeleteWriteOpResultObject>;
  static removeById?: (id: ObjectID, options?: CollectionOptions) => Promise<DeleteWriteOpResultObject>;

  _id?: ObjectID; // tslint:disable-line
  id?: ObjectID;

  create?: (options?: CollectionInsertOneOptions) => Promise<InsertOneWriteOpResult>;

  getCollection?: () => Collection;
  getDb?: () => Db;

  remove?: (filter: any | null, options?: CollectionOptions) => Promise<DeleteWriteOpResultObject>;
  save?: (set?: { [key: string]: any } | null, options?: ReplaceOneOptions) => Promise<UpdateWriteOpResult>;

  toDb?: (changeSet?: object) => any;
  toJson?: (projection?: any) => any;
  toJsonString?: (replacer?: () => any | Array<string | number>, space?: string | number) => string;
}
