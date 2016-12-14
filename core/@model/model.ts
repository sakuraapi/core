import {
  addDefaultInstanceMethods,
  addDefaultStaticMethods
}                            from '../helpers/defaultMethodHelpers';
import {jsonSymbols}         from './json';
import {privateSymbols}      from './private';

export interface IModel {
  create?: (any) => any;
  delete?: (any) => any;
  save?: (any) => any;
  toJson?: (any) => any;
  toJsonString?: (any) => string;
}

export class ModelOptions {
  suppressInjection?: string[]
}

export const modelSymbols = {
  fromJson: Symbol('fromJson'),
  fromJsonArray: Symbol('fromJsonArray'),
  isSakuraApiModel: Symbol('isSakuraApiModel'),
  toJson: Symbol('toJson'),
  toJsonString: Symbol('toJsonString')
};

export function Model(options?: ModelOptions): any {
  options = options || {};

  return function (target: any) {
    // add default static methods
    addDefaultStaticMethods(target, 'get', stub, options);
    addDefaultStaticMethods(target, 'getById', stub, options);
    addDefaultStaticMethods(target, 'delete', stub, options);

    // Various internal methods are exposed to the integrator,
    // but allow the integrator to replace this functionality without
    // breaking the internal functionality
    target.fromJson = fromJson;
    target[modelSymbols.fromJson] = fromJson;

    target.fromJsonArray = fromJsonArray;
    target[modelSymbols.fromJsonArray] = fromJsonArray;

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

    // Inject default instance methods for CRUD if not already defined by integrator
    addDefaultInstanceMethods(newConstructor, 'create', stub, options);
    addDefaultInstanceMethods(newConstructor, 'save', stub, options);
    addDefaultInstanceMethods(newConstructor, 'delete', stub, options);

    newConstructor.prototype.toJson = toJson;
    newConstructor.prototype[modelSymbols.toJson] = toJson;

    newConstructor.prototype.toJsonString = toJsonString;
    newConstructor.prototype[modelSymbols.toJsonString] = toJsonString;

    /////
    function fromJson<T>(json: any, ...constructorArgs: any[]): T {
      if (!json || typeof json !== 'object') {
        return null;
      }

      let obj = new newConstructor(...constructorArgs);

      let propertyNamesByJsonFieldName: Map<string, string> = Reflect.getMetadata(jsonSymbols.sakuraApiJsonFieldToPropertyNames, obj);

      for (let field of Object.getOwnPropertyNames(json)) {
        let prop = (propertyNamesByJsonFieldName) ? propertyNamesByJsonFieldName.get(field) : null;
        if (prop) {
          obj[prop] = json[field]; // an @Json alias field
        } else if (Reflect.has(obj, field)) {
          obj[field] = json[field]; // a none @Json alias field
        }
      }

      return obj;
    }

    function fromJsonArray<T>(json: any, ...constructorArgs: any[]): T[] {
      let result = [];

      if (Array.isArray(json)) {
        for (let item of json) {
          result.push(target[modelSymbols.fromJson](item, ...constructorArgs));
        }
      }

      return result;
    }

    function toJson() {
      let jsonFieldNamesByProperty: Map<string, string> = Reflect.getMetadata(jsonSymbols.sakuraApiJsonPropertyToFieldNames, this);
      jsonFieldNamesByProperty = jsonFieldNamesByProperty || new Map<string,string>();

      let privateFields: Map<string, string> = Reflect.getMetadata(privateSymbols.sakuraApiPrivatePropertyToFieldNames, this);

      let obj = {};
      for (let prop of Object.getOwnPropertyNames(this)) {
        if (typeof this[prop] !== 'function') {

          let override = (privateFields) ? privateFields.get(prop) : null;
          if (override && typeof this[override] === 'function' && !this[override]()) {
            continue;
          } else if (override && !this[override]) {
            continue;
          }
          obj[jsonFieldNamesByProperty.get(prop) || prop] = this[prop];
        }
      }

      return obj;
    }

    function toJsonString(replacer?: (any) => any, space?: string | number) {
      return JSON.stringify(this[modelSymbols.toJson](), replacer, space);
    }

    return newConstructor;
  };
}

//////////
function stub(msg) {
  return msg;
}

