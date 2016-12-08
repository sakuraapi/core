import {construct} from './construct';

export class ModelOptions {

}

export function Model(options?: ModelOptions): any {
  options = options || {};

  return function (target: any) {
    // the new constructor behaviour
    let newConstructor: any = function (...args) {
      let c = construct(target, args);

      Object.getOwnPropertyNames(Object.getPrototypeOf(this))
        .forEach((methodName) => {
        });

      Object.defineProperty(c, 'sakuraApiModel', {
        value: true,
        writable: false
      });

      return c;
    };

    // copy prototype so intanceof operator still works
    newConstructor.prototype = target.prototype;

    // return new constructor (will override original)
    return newConstructor;
  }
}
