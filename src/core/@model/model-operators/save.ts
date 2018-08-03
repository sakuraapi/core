import { ReplaceOneOptions, UpdateWriteOpResult } from 'mongodb';
import { SapiMissingIdErr } from '../errors';
import { modelSymbols } from '../model';
import { SapiModelMixin } from '../sapi-model-mixin';
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
export async function save(this: InstanceType<ReturnType<typeof SapiModelMixin>>,
                           changeSet?: { [key: string]: any } | null,
                           options?: ReplaceOneOptions,
                           context = 'default'): Promise<UpdateWriteOpResult> {

  const constructor = this.constructor as ReturnType<typeof SapiModelMixin>;

  const col = constructor.getCollection();

  debug.normal(`.save called, dbName: '${constructor[modelSymbols.dbName]}', found?: ${!!col}, set: %O`, changeSet);

  if (!col) {
    throw new Error(`Database '${constructor[modelSymbols.dbName]}' not found`);
  }

  if (!(this as any).id) {
    throw new SapiMissingIdErr('Model missing id field, cannot save. Did you mean to use create?', this);
  }

  this.emitOnBeforeSave(context);

  const dbObj = changeSet || this.toDb(this);
  delete dbObj._id;
  delete dbObj.id;

  const result = await col.updateOne({_id: (this as any).id}, {$set: dbObj}, options);

  // update the current model if the update came in the form of a change set;
  if (changeSet) {
    const modelMappedChangeSet = constructor.fromDb(changeSet, {strict: true});

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
