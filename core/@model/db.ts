/**
 * The symbols used by Reflect to store `@Db()` metadata for use by `@Module`. These symbols are not considered
 * part of the API contract and may change or be removed without notice on patch releases.
 */
export const dbSymbols = {
  optionsPropertyName: Symbol('sakuraApiDbOptionsPropertyName'),
  sakuraApiDbByFieldName: Symbol('sakuraApiDbByFieldName'),
  sakuraApiDbByPropertyName: Symbol('sakuraApiDbByPropertyName')
};

export interface IDbOptions {
  /**
   * The name of the field in the database that is mapped to this property when retrieving this document from the
   * database and persisting this document back to the database.
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
   * it will not be included in the output of `someModel.toJson()`. [[Model.modelsymbols]]
   */
  private?: boolean;
}

/**
 * @decorator `@Db` decorates fields in a class decorated by `@`[[Model]].
 * @param options Sets the database options for the property.
 * @returns Used by the framework to reflect on the `@Db` properties defined.
 */
export function Db(options?: IDbOptions): (target: any, key: string) => void {
  options = options || {};

  return (target: any, key: string) => {
    options[dbSymbols.optionsPropertyName] = key;

    let metaMapByPropertyName: Map<string, IDbOptions>
      = Reflect.getMetadata(dbSymbols.sakuraApiDbByPropertyName, target);

    if (!metaMapByPropertyName) {
      metaMapByPropertyName = new Map<string, IDbOptions>();
      Reflect.defineMetadata(dbSymbols.sakuraApiDbByPropertyName, metaMapByPropertyName, target);
    }

    let metaMapByFieldName: Map<string, IDbOptions> = Reflect.getMetadata(dbSymbols.sakuraApiDbByFieldName, target);
    if (!metaMapByFieldName) {
      metaMapByFieldName = new Map<string, IDbOptions>();
      Reflect.defineMetadata(dbSymbols.sakuraApiDbByFieldName, metaMapByFieldName, target);
    }

    metaMapByPropertyName.set(key, options);
    metaMapByFieldName.set(options.field || key, options);
  };
}
