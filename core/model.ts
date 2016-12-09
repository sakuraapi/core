import {applyClassProperties} from './helpers/applyClassProperties';

export class ModelOptions {

}

export const modelSymbols = {
  sakuraApiModel: Symbol('sakuraApiModel')
};


export function Model(options?: ModelOptions): any {
  options = options || {};

  return function (target: any) {

    // the new constructor behaviour
    let newConstructor: any = function (...args) {
      let proxyHandlers = {
        get: getInstanceProxyHandler
      };

      let c = new Proxy(Reflect.construct(target, args), proxyHandlers);

      Reflect.defineProperty(c, modelSymbols.sakuraApiModel, {
        value: true,
        writable: false
      });

      return c;
    };

    applyClassProperties(newConstructor, target);

    // apply any missing standard methods
    if (!Reflect.has(newConstructor, 'get')) {
      newConstructor.get = stub;
    }

    return newConstructor;
  }
}

//////////
function getInstanceProxyHandler(object: any, property: any) {

  if (Reflect.has(object, property)) {
    return Reflect.get(object, property);
  } else if (typeof  property === 'string') {
    switch (property) {
      case 'save':
        return stub;
      case 'deleteById':
        return stub;
      default:
        // TODO account for properties versus functions
        throw new TypeError(`${property} is not a function [SakuraApi]`);
    }
  }
}

function getMeta(context: (any) => any): {
  hasMethod: (string) => boolean,
  hasProperty: (string) => boolean
} {

  let meta: any = {};

  let methods: any = Object.getOwnPropertyNames(Reflect.getPrototypeOf(context));
  let properties: any = Object.getOwnPropertyNames(context);
  let symbols: any = Object.getOwnPropertySymbols(context);

  console.log(Object.getOwnPropertySymbols(context));

  meta.hasMethod = function (property: string): boolean {
    return this.indexOf(property) > -1;
  }.bind(methods);

  meta.hasProperty = function (property: string): boolean {
    return this.indexOf(property) > -1;
  }.bind(properties);

  return meta;
}

function stub(msg) {
  return msg;
}

