/**
 * The symbols used by Reflect to store `@Db()` metadata for use by `@Module`. These symbols are not considered
 * part of the API contract and may change or be removed without notice on patch releases.
 */
export const dbSymbols = {
  dbByFieldName: Symbol('sakuraApiDbByFieldName'),
  dbByPropertyName: Symbol('sakuraApiDbByPropertyName'),
  hasNewChildOption: Symbol('sakuraApiHasNewChildOption'),
  propertyName: Symbol('sakuraApiDbOptionsPropertyName')
};

export interface IDbOptions {
  /**
   * An optional constructor function (ES6 Class) that is used to instantiate the property.
   */
  model?: any;

  /**
   * The database field name that is mapped to and from this property by [[Model]].[[toDb]] and [[Model]].[[fromDb]].
   *
   * ### Example
   * <pre>
   *    <span>@</span>Model({...})
   *    export class SomeModel {
   *        <span>@</span>Db({
   *          field: 'fn'
   *        })
   *        firstName: string = '';
   *    }
   * </pre>
   *
   * Explanation: `firstName` property of the `@Model` is mapped to the `fn` field of the database.
   */
  field?: string;

  /**
   * Prevents this property from being marshaled to json by the built in `toJson` method that is attached to
   * `@Model` decorated classes.
   *
   * ### Example
   * <pre>
   *    <span>@</span>Model({...})
   *    export class SomeModel {
   *        <span>@</span>Db({
   *          private: true
   *        })
   *        firstName: string = '';
   *    }
   * </pre>
   *
   * Explanation: the `firstName` property will be mapped to the `firstName` property of a database document, but
   * it will not be included in the output of `someModel.toJson()`.
   */
  private?: boolean;
}

/**
 * @decorator `@Db` decorates fields in a class decorated by `@`[[Model]].
 * @param dbOptions When a string is provided, this sets the [[IDbOptions.field]].
 * @returns Used by the framework to reflect on the `@Db` properties defined.
 */
export function Db(dbOptions?: IDbOptions | string): (target: any, key: string) => void {
  const options = (typeof dbOptions === 'string')
    ? {field: dbOptions}
    : (!dbOptions) ? {} : dbOptions;

  return (target: any, key: string) => {
    options[dbSymbols.propertyName] = key;

    const mapByPropertyName = getMetaDataMap(target, dbSymbols.dbByPropertyName);
    const mapByFieldName = getMetaDataMap(target, dbSymbols.dbByFieldName);

    mapByPropertyName.set(key, options);
    mapByFieldName.set(options.field || key, options);
  };

  //////////

  // Lazy adds the metadata map to the object if it's missing then returns it, otherwise, it returns the existing map
  function getMetaDataMap(target, symbol): Map<string, IDbOptions> {

    let map: Map<string, IDbOptions> = Reflect.getMetadata(symbol, target);

    if (!map) {
      map = new Map<string, IDbOptions>();
      Reflect.defineMetadata(symbol, map, target);
      target.constructor[symbol] = map;
    }

    return map;
  }
}
