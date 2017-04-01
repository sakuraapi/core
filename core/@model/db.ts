/** @module core/@model/db */

/**
 * The symbols used by Reflect to store `@Db()` metadata for use by `@Module`.
 */
export const dbSymbols = {
  sakuraApiDbByPropertyName: Symbol('sakuraApiDbByPropertyName'),
  sakuraApiDbByFieldName: Symbol('sakuraApiDbByFieldName'),
  optionsPropertyName: Symbol('sakuraApiDbOptionsPropertyName')
};

export interface DbOptions {
  field?: string;
  private?: boolean;
}

export function Db(options?: DbOptions) {
  options = options || {};

  return function (target: any, key: string) {
    options[dbSymbols.optionsPropertyName] = key;

    let metaMapByPropertyName: Map<string, DbOptions> = Reflect.getMetadata(dbSymbols.sakuraApiDbByPropertyName, target);
    if (!metaMapByPropertyName) {
      metaMapByPropertyName = new Map<string, DbOptions>();
      Reflect.defineMetadata(dbSymbols.sakuraApiDbByPropertyName, metaMapByPropertyName, target);
    }

    let metaMapByFieldName: Map<string, DbOptions> = Reflect.getMetadata(dbSymbols.sakuraApiDbByFieldName, target);
    if (!metaMapByFieldName) {
      metaMapByFieldName = new Map<string, DbOptions>();
      Reflect.defineMetadata(dbSymbols.sakuraApiDbByFieldName, metaMapByFieldName, target);
    }

    metaMapByPropertyName.set(key, options);
    metaMapByFieldName.set(options.field || key, options);
  }
}
