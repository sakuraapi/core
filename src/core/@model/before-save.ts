export const beforeSaveSymbols = {
  functionMap: Symbol('functionMap')
};

export type OnBeforeSave = (model: any, context: string) => Promise<void>;

export function BeforeSave(context = 'default') {

  return (target: any, key: string, value: TypedPropertyDescriptor<any>) => {
    const f = function(...args: any[]) {
      return value.value.apply(this, args);
    };

    const meta = getMetaDataMap(target, beforeSaveSymbols.functionMap);

    let savers: OnBeforeSave[] = meta.get(context);
    if (!savers) {
      savers = [];
      meta.set(context, savers);
    }

    savers.push(f);

    return {
      value: f
    };

  };

  /////
  function getMetaDataMap(source, symbol): Map<string, OnBeforeSave[]> {
    let map: Map<string, OnBeforeSave[]> = Reflect.getMetadata(symbol, source);

    if (!map) {
      map = new Map<string, OnBeforeSave[]>();
      Reflect.defineMetadata(symbol, map, source);
    }

    return map;
  }
}
