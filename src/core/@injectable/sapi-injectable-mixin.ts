import {Constructor} from '../helpers/constructor-type';
import {SakuraApi} from '../sakura-api';

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
export function SapiInjectableMixin<T extends Constructor<{}>>(Base?: T) {
  Base = Base || class {
  } as any;

  return class extends Base {
    constructor(...args: any[]) {
      super(...args);
    }

    static sapi: SakuraApi;
    static sapiConfig: any;

    sapi: SakuraApi;
    sapiConfig: any;
  };
}
