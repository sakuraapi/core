import {
  ReplaceOneOptions,
  UpdateWriteOpResult
} from 'mongodb';
import {
  beforeSaveSymbols,
  OnBeforeSave
} from '../before-save';
import { SapiMissingIdErr } from '../errors';
import { modelSymbols } from '../model';
import { debug } from './index';

/**
 * @instance Performs a MongoDB updateOne if the current [[Model]] has an Id.
 * @param changeSet Expects properties to already be mapped to db field names. Limits the update to just
 * the fields included in the changeset. For example a changeset of:
 * <pre>
 * {
 *     firstName: "George"
 * }
 * </pre>
 * would cause only the `firstName` field to be updated. If the `changeSet` parameter is not provided,
 * `save` will assume the entire [[Model]] is the changeset (obeying the various decorators like [[Db]]).
 * @param options The MongoDB ReplaceOneOptions. If you want to set this, but not the `set`, then pass null into `set`.
 * @param context The optional context to use for things like @BeforeSave or @BeforeCreate
 * @returns {any}
 */
export async function save(changeSet?: { [key: string]: any } | null,
                           options?: ReplaceOneOptions,
                           context = 'default'): Promise<UpdateWriteOpResult> {

  const constructor = this.constructor;

  const col = constructor.getCollection();

  debug.normal(`.save called, dbName: '${constructor[modelSymbols.dbName]}', found?: ${!!col}, set: %O`, changeSet);

  if (!col) {
    throw new Error(`Database '${constructor[modelSymbols.dbName]}' not found`);
  }

  if (!this.id) {
    return Promise.reject(new SapiMissingIdErr('Model missing id field, cannot save. Did you mean ' +
      'to use create?', this));
  }

  // @BeforeSave()
  const beforSaveMap: Map<string, OnBeforeSave[]> = Reflect.getMetadata(beforeSaveSymbols.functionMap, this);
  const beforeSaveContextMap = (beforSaveMap) ? beforSaveMap.get(context) || [] : [];
  const beforeSaveStarMap = (beforSaveMap) ? beforSaveMap.get('*') || [] : [];
  for (const f of beforeSaveContextMap) {
    await f.bind(this)(this, context);
  }
  for (const f of beforeSaveStarMap) {
    await f.bind(this)(this, '*');
  }

  const dbObj = changeSet || this.toDb(this);
  delete dbObj._id;
  delete dbObj.id;

  const result = await col.updateOne({_id: this.id}, {$set: dbObj}, options);

  if (changeSet) {
    const modelMappedChangeSet = this.constructor.fromDb(changeSet, {strict: true});

    const keys = Object.getOwnPropertyNames(modelMappedChangeSet);
    for (const key of keys) {
      if (key === '_id' || key === 'id') {
        continue;
      }
      this[key] = modelMappedChangeSet[key];
    }
  }
  return result;
}
