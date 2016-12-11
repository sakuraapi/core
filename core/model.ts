import {
  addDefaultInstanceMethods,
  addDefaultStaticMethods
} from './helpers/defaultMethodHelpers';

export interface IModel {
  create?: (any) => any;
  delete?: (any) => any;
  save?: (any) => any;
}

export class ModelOptions {
  suppressInjection?: string[]
}

export const modelSymbols = {
  sakuraApiModel: Symbol('sakuraApiModel')
};

export function Model(options?: ModelOptions): any {
  options = options || {};

  return function (target: any) {

    // add default static methods
    addDefaultStaticMethods(target, 'get', stub, options);
    addDefaultStaticMethods(target, 'getById', stub, options);
    addDefaultStaticMethods(target, 'delete', stub, options);

    // decorate the constructor
    let newConstructor = new Proxy(target, {
      construct: function (t, args, nt) {
        let c = Reflect.construct(t, args, nt);

        Reflect.defineProperty(c, modelSymbols.sakuraApiModel, {
          value: true,
          writable: false
        });
        
        return c;
      }
    });

    addDefaultInstanceMethods(newConstructor, 'create', stub, options);
    addDefaultInstanceMethods(newConstructor, 'save', stub, options);
    addDefaultInstanceMethods(newConstructor, 'delete', stub, options);

    return newConstructor;
  }
}

//////////
function stub(msg) {
  return msg;
}

