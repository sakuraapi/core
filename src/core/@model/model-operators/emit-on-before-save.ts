import { beforeSaveSymbols, OnBeforeSave } from '../before-save';
import { SapiModelMixin } from '../sapi-model-mixin';

/**
 * Triggers a Model's onBeforeSave
 * @param target the target SakuraApi model
 * @param context the save context
 */
export async function emitOnBeforeSave(this: InstanceType<ReturnType<typeof SapiModelMixin>>, context = 'default'): Promise<void> {

  const beforSaveMap: Map<string, OnBeforeSave[]> = Reflect.getMetadata(beforeSaveSymbols.functionMap, this);
  const beforeSaveContextMap = (beforSaveMap) ? beforSaveMap.get(context) || [] : [];
  const beforeSaveStarMap = (beforSaveMap) ? beforSaveMap.get('*') || [] : [];
  for (const f of beforeSaveContextMap) {
    await f.bind(this)(this, context);
  }
  for (const f of beforeSaveStarMap) {
    await f.bind(this)(this, '*');
  }
}
