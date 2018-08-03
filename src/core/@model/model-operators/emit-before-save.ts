import { beforeSaveSymbols, OnBeforeSave } from '../before-save';
import { dbSymbols } from '../db';
import { SapiModelMixin } from '../sapi-model-mixin';

/**
 * Triggers a Model's onBeforeSave
 * @param context the save context
 */
export async function emitBeforeSave(this: InstanceType<ReturnType<typeof SapiModelMixin>>, context = 'default'): Promise<void> {

  // call @BeforeSaves for this model
  const beforSaveMap: Map<string, OnBeforeSave[]> = Reflect.getMetadata(beforeSaveSymbols.functionMap, this);
  const beforeSaveContextMap = (beforSaveMap) ? beforSaveMap.get(context) || [] : [];
  const beforeSaveStarMap = (beforSaveMap) ? beforSaveMap.get('*') || [] : [];
  for (const f of beforeSaveContextMap) {
    await f.bind(this)(this, context);
  }
  for (const f of beforeSaveStarMap) {
    await f.bind(this)(this, '*');
  }

  const dbMeta = this.constructor[dbSymbols.dbByPropertyName];
  // call for child models
  const keys = Object.keys(this);
  for (const key of keys) {

    const model: ReturnType<typeof SapiModelMixin> = (dbMeta)
      ? (dbMeta.get(key) || {} as any).model
      : null;

    if (model) {
      if (Array.isArray(this[key])) {
        for (const childModel of this[key] as Array<InstanceType<ReturnType<typeof SapiModelMixin>>>) {
          if (typeof childModel.emitBeforeSave === 'function') {
            await childModel.emitBeforeSave(context);
          }
        }
      } else {
        const property = this[key] as InstanceType<ReturnType<typeof SapiModelMixin>>;
        if (typeof property.emitBeforeSave === 'function') {
          await property.emitBeforeSave(context);
        }
      }
    }
  }
}
