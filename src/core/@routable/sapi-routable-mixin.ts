import {NextFunction, Request, Response} from 'express';
import {Constructor} from '../helpers/constructor-type';
import {SakuraApi} from '../sakura-api';

/**
 * Integrators should extend their Models with this Mixin to get type checking.
 *
 *  * ### Example
 * <pre>
 * class SuperChicken extends SapiRoutableMixin() {
 * }
 * </pre>
 *
 * See [[SapiModelMixin]] for more details.
 */
export function SapiRoutableMixin<T extends Constructor<{}>>(Base?: T) {
  Base = Base || class {
  } as any;

  return class extends Base {
    constructor(...args: any[]) {
      super(...args);
    }

    static getRouteHandler?: (req: Request, res: Response, next: NextFunction) => void;
    static getAllRouteHandler?: (req: Request, res: Response, next: NextFunction) => void;
    static putRouteHandler?: (req: Request, res: Response, next: NextFunction) => void;
    static postRouteHandler?: (req: Request, res: Response, next: NextFunction) => void;
    static deleteRouteHandler?: (req: Request, res: Response, next: NextFunction) => void;

    static sapi?: SakuraApi;
    static sapiConfig?: any;

    sapi?: SakuraApi;
    sapiConfig?: any;
  };
}
