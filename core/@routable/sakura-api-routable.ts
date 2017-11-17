import {NextFunction, Request, Response} from 'express';
import {SakuraApi} from '../sakura-api';

/***
 * Integrators should extend their [[Routable]] classes with this abstract class to get typing for the `@`[[Routable]]
 * mixin functions that are injected. If you need to have a custom super class that cannot extend this abstract class,
 * it's sufficient for you to copy and paste these type definitions into your super class to get the same typing.
 *
 * For example, let's say you had a super class SuperChicken that already extends some class you don't control... for
 * example, SuperHeroBirds. Since ES doesn't support multiple inheritance, you could just copy and past the
 * type definitions for `@`[[Routable]] mixins into `SuperChickenApi`:
 *
 * ### Example
 * <pre>
 * class SuperChickenApi extends SuperHeroBirdsApi {
 *   getRouteHandler?: (req: Request, res: Response, next: NextFunction) => void;
 *   getAllRouteHandler?: (req: Request, res: Response, next: NextFunction) => void;
 *   putRouteHandler?: (req: Request, res: Response, next: NextFunction) => void;
 *   postRouteHandler?: (req: Request, res: Response, next: NextFunction) => void;
 *   deleteRouteHandler?: (req: Request, res: Response, next: NextFunction) => void;
 *   static sapi?: SakuraApi;
 *   static sapiConfig?: any;
 *
 *   sapi?: SakuraApi;
 *   sapiConfig?: any;
 *
 *   ///
 *   // your class implementation continues on here...
 * }
 * </pre>
 * Annoying? Yes. See: https://github.com/Microsoft/TypeScript/issues/4881
 */
export abstract class SakuraApiRoutable {
  static getRouteHandler?: (req: Request, res: Response, next: NextFunction) => void;
  static getAllRouteHandler?: (req: Request, res: Response, next: NextFunction) => void;
  static putRouteHandler?: (req: Request, res: Response, next: NextFunction) => void;
  static postRouteHandler?: (req: Request, res: Response, next: NextFunction) => void;
  static deleteRouteHandler?: (req: Request, res: Response, next: NextFunction) => void;

  static sapi?: SakuraApi;
  static sapiConfig?: any;

  sapi?: SakuraApi;
  sapiConfig?: any;
}
