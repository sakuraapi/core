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

/***
 * Integrators should extend their Model classes with this abstract class to get typing for the `@`[[Model]] mixin
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
 *   public static fromDb?: <T>(this: { new (): T }, json: object, ...constructorArgs: any[]) => T;
 *   public static fromDbArray?: <T>(this: { new(): T }, jsons: any[], ...constructorArgs) => T[];
 *   public static fromJson?: <T>(this: { new(): T }, json: any, ...constructorArgs: any[]) => T;
 *   public static fromJsonArray?: <T>(this: { new(): T }, json: any, ...constructorArgs: any[]) => T[];
 *   public static get?: <T>(this: { new (): T }, filter: any, project?: any) => Promise<T[]>;
 *   public static getById?: <T>(this: { new (): T }, id: string, project?: any) => Promise<T>;
 *   public static getCollection?: () => Collection;
 *   public static getCursor?: (filter: any, project?: any) => Cursor<any>;
 *   public static getCursorById?: (id, project?: any) => Cursor<any>;
 *   public static getDb?: () => Db;
 *   public static getOne?: <T>(this: { new (): T }, filter: any, project?: any) => Promise<T>;
 *   public static removeAll?: (filter: any, options?: CollectionOptions) => Promise<DeleteWriteOpResultObject>;
 *   public static removeById?: (id: ObjectID, options?: CollectionOptions) => Promise<DeleteWriteOpResultObject>
 *   public _id?: ObjectID;
 *   public create?: (options?: CollectionInsertOneOptions) => Promise<InsertOneWriteOpResult>;
 *   public getCollection?: () => Collection;
 *   public getDb?: () => Db;
 *   public remove?: (filter: any | null, options?: CollectionOptions) => Promise<DeleteWriteOpResultObject>;
 *   public save?: (set?: { [key: string]: any } | null, options?: ReplaceOneOptions) => Promise<UpdateWriteOpResult>;
 *   public toDb?: (changeSet?: object) => object;
 *   public toJson?: () => object;
 *   public toJsonString?: (replacer?: () => any | Array<string | number>, space?: string | number) => string;
 *
 *   ///
 *   // your class implementation continues on here...
 * }
 * </pre>
 * Pain in the arse? Sure. Unfortunately, TypeScript interfaces don't allow you to define static interface
 * members.
 */
export abstract class SakuraApiModel {
  public static fromDb?: <T>(this: { new(): T }, json: object, ...constructorArgs: any[]) => T;
  public static fromJson?: <T>(this: { new(): T }, json: object, ...constructorArgs: any[]) => T;

  public static fromDbArray?: <T>(this: { new(): T }, jsons: object[], ...constructorArgs) => T[];
  public static fromJsonArray?: <T>(this: { new(): T }, jsons: object[], ...constructorArgs: any[]) => T[];

  public static get?: <T>(this: { new (): T }, filter: any, project?: any) => Promise<T[]>;
  public static getById?: <T>(this: { new (): T }, id: string | ObjectID, project?: any) => Promise<T>;
  public static getCollection?: () => Collection;
  public static getCursor?: (filter: any, project?: any) => Cursor<any>;
  public static getCursorById?: (id, project?: any) => Cursor<any>;
  public static getDb?: () => Db;
  public static getOne?: <T>(this: { new (): T }, filter: any, project?: any) => Promise<T>;

  public static removeAll?: (filter: any, options?: CollectionOptions) => Promise<DeleteWriteOpResultObject>;
  public static removeById?: (id: ObjectID, options?: CollectionOptions) => Promise<DeleteWriteOpResultObject>;

  public _id?: ObjectID; // tslint:disable-line
  public id?: ObjectID;

  public create?: (options?: CollectionInsertOneOptions) => Promise<InsertOneWriteOpResult>;

  public getCollection?: () => Collection;
  public getDb?: () => Db;

  public remove?: (filter: any | null, options?: CollectionOptions) => Promise<DeleteWriteOpResultObject>;
  public save?: (set?: { [key: string]: any } | null, options?: ReplaceOneOptions) => Promise<UpdateWriteOpResult>;

  public toDb?: (changeSet?: object) => object;
  public toJson?: () => object;
  public toJsonString?: (replacer?: () => any | Array<string | number>, space?: string | number) => string;
}
