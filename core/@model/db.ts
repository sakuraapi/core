/** @module core/@model/db */

/**
 * The symbols used by Reflect to store `@Db()` metadata for use by `@Module`.
 */
export const dbSymbols = {
  optionsPropertyName: Symbol('sakuraApiDbOptionsPropertyName'),
  sakuraApiDbByFieldName: Symbol('sakuraApiDbByFieldName'),
  sakuraApiDbByPropertyName: Symbol('sakuraApiDbByPropertyName')
};

export interface IDbOptions {
  field?: string;
  private?: boolean;
}

export function Db(options?: IDbOptions) {
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
