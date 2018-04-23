export const beforeCreateSymbols = {
  functionMap: Symbol('functionMap')
};

export type OnBeforeCreate = (model: any, context: string) => Promise<void>;

export function BeforeCreate(context = 'default') {

  return (target: any, key: string, value: TypedPropertyDescriptor<any>) => {
    const f = function(...args: any[]) {
      return value.value.apply(this, args);
    };

    const meta = getMetaDataMap(target, beforeCreateSymbols.functionMap);

    let creators: OnBeforeCreate[] = meta.get(context);
    if (!creators) {
      creators = [];
      meta.set(context, creators);
    }

    creators.push(f);

    return {
      value: f
    };

  };

  /////
  function getMetaDataMap(source, symbol): Map<string, OnBeforeCreate[]> {
    let map: Map<string, OnBeforeCreate[]> = Reflect.getMetadata(symbol, source);

    if (!map) {
      map = new Map<string, OnBeforeCreate[]>();
      Reflect.defineMetadata(symbol, map, source);
    }

    return map;
  }
}
