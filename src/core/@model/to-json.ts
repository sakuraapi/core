import { IContext } from '../helpers';

export const formatToJsonSymbols = {
  functionMap: Symbol('functionMap')
};

export type ToJsonHandler = (json: any, model: any, context: IContext) => any;

export function ToJson(context = 'default') {
  return (target: any, key: string, value: TypedPropertyDescriptor<any>) => {
    const f = function(...args: any[]) {
      return value.value.apply(this, args);
    };

    const meta = getMetaDataMap(target, formatToJsonSymbols.functionMap);

    let formatters: ToJsonHandler[] = meta.get(context);
    if (!formatters) {
      formatters = [];
      meta.set(context, formatters);
    }

    formatters.push(f);

    return {
      value: f
    };
  };

  /////
  function getMetaDataMap(source, symbol): Map<string, ToJsonHandler[]> {
    let map: Map<string, ToJsonHandler[]> = Reflect.getMetadata(symbol, source);

    if (!map) {
      map = new Map<string, ToJsonHandler[]>();
      Reflect.defineMetadata(symbol, map, source);
    }

    return map;
  }
}
