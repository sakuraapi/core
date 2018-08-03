import { beforeCreateSymbols, OnBeforeCreate } from '../before-create';
import { SapiModelMixin } from '../sapi-model-mixin';

/**
 * Triggers a Model's onBeforeCreate
 * @param target the target SakuraApi model
 * @param context the save context
 */
export async function emitOnBeforeCreate(this: InstanceType<ReturnType<typeof SapiModelMixin>>, context = 'default'): Promise<void> {
  const beforCreateMap: Map<string, OnBeforeCreate[]> = Reflect.getMetadata(beforeCreateSymbols.functionMap, this);
  const beforeCreateContextMap = (beforCreateMap) ? beforCreateMap.get(context) || [] : [];
  const beforeCreateStarMap = (beforCreateMap) ? beforCreateMap.get('*') || [] : [];
  for (const f of beforeCreateContextMap) {
    await f.bind(this)(this, context);
  }
  for (const f of beforeCreateStarMap) {
    await f.bind(this)(this, '*');
  }
}
