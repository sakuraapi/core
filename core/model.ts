import {
  addDefaultInstanceMethods,
  addDefaultStaticMethods
} from './helpers/defaultMethodHelpers';

export class ModelOptions {

}

export const modelSymbols = {
  sakuraApiModel: Symbol('sakuraApiModel')
};

export function Model(options?: ModelOptions): any {
  options = options || {};

  return function (target: any) {

    // add default static methods
    addDefaultStaticMethods(target, 'get', stub);

    // decorate the constructor
    let newConstructor = new Proxy(target, {
      construct: function (t, args, nt) {
        let c = Reflect.construct(t, args, nt);

        Reflect.defineProperty(c, modelSymbols.sakuraApiModel, {
          value: true,
          writable: false
        });

        addDefaultInstanceMethods(c, 'save', stub);
        addDefaultInstanceMethods(c, 'deleteById', stub);

        return c;
      }
    });

    return newConstructor;
  }
}

//////////
function stub(msg) {
  return msg;
}

