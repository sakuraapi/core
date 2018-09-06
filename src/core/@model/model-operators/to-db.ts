import { shouldRecurse } from '../../lib';
import { dbSymbols, IDbOptions } from '../db';
import { idSymbols } from '../id';
import { modelSymbols } from '../model';
import { debug } from './index';

/**
 * @instance Builds and returns a change set object with its fields mapped based on decorators like [[Db]]. The
 * resulting change set object is what's persisted to the database.
 * @param changeSet The change set. For example:
 * <pre>
 * {
 *     firstName: "George"
 * }
 * </pre>
 * This change set would cause only the `firstName` field to be updated. If the `set` parameter is not provided,
 * `toDb` will assume the entire [[Model]] is the change set (obeying the various decorators like [[Db]]).
 *
 * Nested objects are supported. Each property that is an object (except for ObjectID properties) needs to have its
 * own class declared. The properties classes that represent sub-documents, obey the `@`[[Db]] and `@`[[Json]] decorator
 * rules.
 *
 * @returns {{_id: (any|ObjectID|number)}}
 */
export function toDb(changeSet?: any): object {
  const constructor = this[modelSymbols.constructor] || this;

  debug.normal(`.toDb called, target '${(constructor || {} as any).name}'`);

  changeSet = changeSet || this;
  return mapModelToDb.call(this, changeSet);
}

function mapModelToDb(model) {

  const dbo = {} as any;
  if (!model) {
    return;
  }

  const dbOptionsByPropertyName: Map<string, IDbOptions> = Reflect.getMetadata(dbSymbols.dbByPropertyName, model);

  // iterate over each property
  const keys = Object.getOwnPropertyNames(model);

  for (const key of keys) {

    const map = keyMapper.call(this, key, model[key], dbOptionsByPropertyName) || {} as any;
    const subModel = map.model;

    if (!map.newKey) {
      // field is not mapped with @Db or @Id, and model is not promiscuous, skip it
      continue;
    }

    let value;
    if (subModel || shouldRecurse(model[key])) {

      if (Array.isArray(model[key])) {
        const values = [];
        for (const src of model[key]) {
          values.push(mapModelToDb.call(this, src));
        }
        value = values;

      } else if (map.newKey !== undefined) {

        value = mapModelToDb.call(this, model[key]);

      }

    } else if (map.newKey !== undefined) {

      // if a newKey (db key) has been defined, then set the value to the source [key] so that
      // result[map.newKey] will get source[key] - otherwise, result[map.newKey] will be undefined.
      value = model[key];

    }

    dbo[map.newKey] = value;
  }

  return dbo;
}

function keyMapper(key, value, dbMeta): { model: any, newKey: string } {
  const constructor = this[modelSymbols.constructor] || this;
  const modelOptions = constructor[modelSymbols.modelOptions];

  if (!dbMeta) {
    dbMeta = constructor[dbSymbols.dbByPropertyName];
  }

  let fieldName: string;
  const idProperty = Reflect.getMetadata(idSymbols.idByPropertyName, this);

  if (idProperty && idProperty === key) { // if this is an @Id field

    fieldName = '_id';

  } else if (dbMeta && dbMeta.get) { // if there's @Db meta data on the property
    const dbOptions = (dbMeta.get(key)) as IDbOptions;

    if ((dbOptions || {}).field) {
      // if there's specifically a @Db('fieldName') - i.e., there's a declared field name
      fieldName = dbOptions.field;
    } else if (dbOptions) {
      // if there's at least an @Db on the property, use the property name for the field name
      fieldName = key;
    }
  }

  // if the model's promiscuous use the property name for the field name if @Db wasn't found...
  // otherwise leave the field out of the results
  if (!fieldName && ((modelOptions.dbConfig || {}).promiscuous || (modelOptions || {} as any).promiscuous)) {
    fieldName = key;
  }

  return {
    model: (dbMeta) ? (dbMeta.get(key) || {}).model || null : null,
    newKey: fieldName
  };
}
