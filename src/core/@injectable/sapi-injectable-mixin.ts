import {Constructor} from '../helpers/constructor-type';
import {SakuraApi}   from '../sakura-api';

/***
 * Integrators should extend their Injectables with this Mixin to get type checking
 *
 * ### Example
 * <pre>
 * class SuperChicken extends SapiInjectableMixin() {
 * }
 * </pre>
 *
 * See [[SapiModelMixin]] for more information.
 */
export function SapiInjectableMixin<T extends Constructor<{}>>(base?: T) {
  base = base || class {
  } as T;

  return class extends base {
    static sapi: SakuraApi;
    static sapiConfig: any;

    sapi: SakuraApi;
    sapiConfig: any;

    constructor(...args: any[]) {
      super(...args);
    }
  };
}
