import {SakuraApi} from '../sakura-api';

/***
 * Integrators should extend their [[Injectable]] classes with this abstract class to get typing for the
 * `@`[[Injectable]] mixin functions that are injected. If you need to have a custom super class that cannot extend
 * this abstract class, it's sufficient for you to copy and paste these type definitions into your super class to
 * get the same typing.
 *
 * For example, let's say you had a super class SuperChicken that already extends some class you don't control... for
 * example, SuperHeroBirds. Since ES doesn't support multiple inheritance, you could just copy and past the
 * type definitions for `@`[[Injectable]] mixins into `SuperChicken`:
 * ### Example
 * <pre>
 * class SuperChicken extends SuperHeroBirds {
 *   static sapi?: SakuraApi;
 *   sapi?: SakuraApi;
 *   sapiConfig?: any;
 *   static sapiConfig?: any;
 * }
 *
 * Annoying? Yes. See: https://github.com/Microsoft/TypeScript/issues/4881
 */
export abstract class SakuraApiInjectable {
  static sapi?: SakuraApi;
  static sapiConfig?: any;

  sapi?: SakuraApi;
  sapiConfig?: any;
}
