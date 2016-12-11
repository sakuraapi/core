import {
  addDefaultInstanceMethods,
  addDefaultStaticMethods
} from './helpers/defaultMethodHelpers';
import property = require("lodash/property");

// @Model
/**********************************************************************************************************************/
export interface IModel {
  create?: (any) => any;
  delete?: (any) => any;
  save?: (any) => any;
}

export class ModelOptions {
  suppressInjection?: string[]
}

export const modelSymbols = {
  isSakuraApiModel: Symbol('isSakuraApiModel')
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

        // isSakuraApiModel
        Reflect.defineProperty(c, modelSymbols.isSakuraApiModel, {
          value: true,
          writable: false
        });

        return c;
      }
    });

    addDefaultInstanceMethods(newConstructor, 'create', stub, options);
    addDefaultInstanceMethods(newConstructor, 'save', stub, options);
    addDefaultInstanceMethods(newConstructor, 'delete', stub, options);

    newConstructor.prototype.toJson = toJson;
    newConstructor.prototype.toJsonString = toJsonString;

    return newConstructor;
  };

  //////////
  function toJson() {
    let jsonFieldNames: Map<string, string> = Reflect.getMetadata(`sakuraApiJsonFieldNames`, this);
    jsonFieldNames = jsonFieldNames || new Map<string,string>();

    let obj = {};
    for (let prop of Object.getOwnPropertyNames(this)) {
      if (typeof this[prop] !== 'function') {
        obj[jsonFieldNames.get(prop) || prop] = this[prop];
      }
    }
    return obj;
  }

  function toJsonString(replacer?: (any) => any, space?: string | number) {
    return JSON.stringify(this.toJson(), replacer, space);
  }
}

// @Json
/**********************************************************************************************************************/
export function Json(fieldName: string) {

  return function (target: any, key: string) {

    let metaDataMap: Map<string, string> = Reflect.getMetadata(`sakuraApiJsonFieldNames`, target);
    if (!metaDataMap) {
      metaDataMap = new Map<string ,string>();
      Reflect.defineMetadata(`sakuraApiJsonFieldNames`, metaDataMap, target);
    }
    metaDataMap.set(key, fieldName);
  }
}


//////////
function stub(msg) {
  return msg;
}

