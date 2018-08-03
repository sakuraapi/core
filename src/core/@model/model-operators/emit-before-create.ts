import { beforeCreateSymbols, OnBeforeCreate } from '../before-create';
import { dbSymbols } from '../db';
import { SapiModelMixin } from '../sapi-model-mixin';

/**
 * Triggers a Model's onBeforeCreate
 * @param context the save context
 */
export async function emitBeforeCreate(this: InstanceType<ReturnType<typeof SapiModelMixin>>, context = 'default'): Promise<void> {

  // call @BeforeCreate for this model
  const beforCreateMap: Map<string, OnBeforeCreate[]> = Reflect.getMetadata(beforeCreateSymbols.functionMap, this);
  const beforeCreateContextMap = (beforCreateMap) ? beforCreateMap.get(context) || [] : [];
  const beforeCreateStarMap = (beforCreateMap) ? beforCreateMap.get('*') || [] : [];
  for (const f of beforeCreateContextMap) {
    await f.bind(this)(this, context);
  }
  for (const f of beforeCreateStarMap) {
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
          if (typeof childModel.emitBeforeCreate === 'function') {
            await childModel.emitBeforeCreate(context);
          }
        }
      } else {
        const property = this[key] as InstanceType<ReturnType<typeof SapiModelMixin>>;
        if (typeof property.emitBeforeCreate === 'function') {
          await property.emitBeforeCreate(context);
        }
      }
    }
  }
}
