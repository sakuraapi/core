import {
  NextFunction,
  Request,
  Response
} from 'express';

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
 *   public getRouteHandler?: (req: Request, res: Response, next: NextFunction) => void;
 *   public getAllRouteHandler?: (req: Request, res: Response, next: NextFunction) => void;
 *   public putRouteHandler?: (req: Request, res: Response, next: NextFunction) => void;
 *   public postRouteHandler?: (req: Request, res: Response, next: NextFunction) => void;
 *   public deleteRouteHandler?: (req: Request, res: Response, next: NextFunction) => void;
 *
 *   ///
 *   // your class implementation continues on here...
 * }
 * </pre>
 * Pain in the arse? Sure. In the case of [[Routable]] classes, this could have been done with an interface. However,
 * if we add static methods in the future, as is the case with [[Model]] (see [[SakuraApiModel]]) then it would be
 * necessary to turn this into an abstract class, which would break backwards compatability, which would then warrant
 * a major release version bump, which seems silly for this contingency.
 */
export abstract class SakuraApiRoutable {
  public static getRouteHandler?: (req: Request, res: Response, next: NextFunction) => void;
  public static getAllRouteHandler?: (req: Request, res: Response, next: NextFunction) => void;
  public static putRouteHandler?: (req: Request, res: Response, next: NextFunction) => void;
  public static postRouteHandler?: (req: Request, res: Response, next: NextFunction) => void;
  public static deleteRouteHandler?: (req: Request, res: Response, next: NextFunction) => void;
}
