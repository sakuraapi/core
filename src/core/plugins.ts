import {
  Handler,
  Request,
  Response
} from 'express';
import { v4 } from 'uuid';
import { modelSymbols } from './@model';
import { OK } from './lib';
import { SakuraApi } from './sakura-api';

/**
 * For internal use. Do not rely on this - it can change at any time.
 * @internal
 */
export const authenticatorPluginSymbols = {
  id: Symbol('id'),
  isAuthenticator: Symbol('isAuthenticator'),
  sapi: Symbol('sapi')
};

/**
 * Implemented by authenticators that are passed into [[Routable]] or [[Route]] `authentication` option.
 *
 * Authenticators are returned by authentication plugins. Authenticators should implement
 * [[IAuthenticator]] and [[IAuthenticatorConstructor]].
 *
 * Provides authentication behavior per the specifics of the plugin that provided the IAuthenticator(s)
 * via [[SakuraApiPluginResult.authenticators]].
 *
 * An authenticator's `authenticate` method returns [[AuthenticatorPluginResult]].
 *
 * By convention, authenticators fall through until one of them returns true, otherwise, the first failure is returned.
 * You should follow this convention or make it really clear in your documentation for your plugin if you're not
 * following this convention.
 */
export interface IAuthenticator {
  authenticate: (req: Request, res: Response) => Promise<AuthenticatorPluginResult>;
}

/**
 * Should be implemented by Classes (constructor functions) that are decorated with `@`[[AuthenticatorPlugin]]
 */
export interface IAuthenticatorConstructor {
  // this exists simply to help TypeScript
}

/**
 * The interface for plugin definitions expected by [[SakuraApi]]'s [[SakuraApiOptions.plugins]].
 */
export interface SakuraApiPlugin {
  /**
   * Options passed into the plugin (see documentation for the plugin).
   */
  options?: any;
  /**
   * If the plugin includes middleware handlers, this is the order in which they'll be included. See
   * [[SakuraApi.addMiddleware]]
   */
  order?: number;
  /**
   * A SakuraApi plugin that conforms to the interface (SakuraApi, any) => SakuraApiPluginResult;
   */
  plugin: (sapi: SakuraApi, options: any) => SakuraApiPluginResult;
}

/**
 * The interface of an object returned from a SakuraApi plugin (for example native-authentication-authority)
 */
export interface SakuraApiPluginResult {

  /**
   * Authenticators made available for `@`[[Route]] and `@`[[Routable]] authentication.
   */
  authenticators?: IAuthenticator[];
  /**
   * Route handlers that get called before any specific route handlers are called. This is for plugins that
   * inspect all incoming requests before they're passed off to specific route handlers.
   */
  middlewareHandlers?: Handler[];
  /**
   * `@`[[Model]] decorated models for the plugin.
   */
  models?: any[];
  /**
   * `@`[[Injectable]] decorated services for the plugin.
   */
  providers?: any[];
  /**
   * `@`[[Routable]] decorated models for the plugin.
   */
  routables?: any[];
}

/**
 * The result returned from [[AuthenticationHandler]]
 */
export interface AuthenticatorPluginResult {
  data: {
    [key: string]: any
  };
  error?: Error;
  status: number;
  success: boolean;
}

/**
 * Used by [[Authenticator]]
 */
export type AuthenticationHandler = (req: Request, res: Response) => Promise<AuthenticatorPluginResult>;

/**
 * An attempt was made to use [[SakuraApi.getProvider]] with a parameter that isn't decorated with `@`[[Injectable]].
 */
export class AuthenticatorsMustBeDecoratedWithAuthenticatorPluginError extends Error {
  constructor(target: any) {
    const targetName = (target || {} as any).name
      || ((target || {} as any).constructor || {} as any).name
      || typeof target;

    super(`Invalid attempt to get ${targetName}, must be decorated with @AuthenticatorPlugin`);
  }
}

/**
 * Thrown when an attempt is made to use an object as an Authenticator, which has not been registered with the dependency
 * injection system. You register Authenticators when you are instantiating the instance of [[SakuraApi]] for your
 * application.
 */
export class AuthenticatorNotRegistered extends Error {
  constructor(target: any) {
    const targetName = (target || {} as any).name
      || ((target || {} as any).constructor || {} as any).name
      || typeof target;

    super(`${targetName} is not registered as an Authenticator with SakuraApi`);
  }
}

/**
 * `@`AuthenticatorPlugin decorates AuthAuthentication plugin classes. These classes should
 * have the following shape:
 * ```
 * @AuthenticatorPlugin()
 * export class AuthAudience {
 *
 *   constructor(private handlers: Handler[]) {
 *   }
 *
 *   authenticate(req: Request, res: Response, next: NextFunction) {
 *      // do auth checks here. Throw if
 *   }
 * }
 * ```
 */
export function AuthenticatorPlugin(): (any) => any {
  // -------------------------------------------------------------------------------------------------------------------
  // Developer notes:
  //
  // `target` represents the constructor function that is being reflected upon by the `@Routable` decorator. It is
  // decorated via a Proxy and becomes `newConstrutor` <- this is the decorated constructor function resulting
  // from the `@Routable` decorator.
  //
  // To add an instance member: newConstructor.prototype.newFunction = () => {}
  // to add a static member: newConstructor.newFunction = () => {}
  // ===================================================================================================================
  return (target: any) => {

    const newConstructor = new Proxy(target, {
      construct: (t, args, nt) => {
        const c = Reflect.construct(t, args, nt);

        // helps make it easier to tell if you're dealing with two different instances of AuthenticatorPlugin
        c[authenticatorPluginSymbols.id] = v4();

        return c;
      }
    });

    newConstructor[authenticatorPluginSymbols.id] = v4();
    newConstructor[authenticatorPluginSymbols.sapi] = null; // injected by [[SakuraApi.registerAuthenticators]]

    Reflect.defineProperty(newConstructor.prototype, authenticatorPluginSymbols.isAuthenticator, {
      value: true,
      writable: false
    });

    Reflect.defineProperty(newConstructor, authenticatorPluginSymbols.isAuthenticator, {
      value: true,
      writable: false
    });

    Reflect.defineProperty(newConstructor.prototype, 'sapi', {
      configurable: false,
      enumerable: false,
      get: () => newConstructor[modelSymbols.sapi]
    });

    Reflect.defineProperty(newConstructor, 'sapiConfig', {
      configurable: false,
      enumerable: false,
      get: () => (newConstructor[modelSymbols.sapi] || {} as any).config
    });

    Reflect.defineProperty(newConstructor.prototype, 'sapiConfig', {
      configurable: false,
      enumerable: false,
      get: () => (newConstructor[modelSymbols.sapi] || {} as any).config
    });

    return newConstructor;
  };
}

/**
 * Automatically injected into SakuraApi on instantiation. Allows for anonymous access if passed into `@Routable` or
 * `@Router` `authenticators` property. Remember, authenticators work from left to right; if you put this first in your
 * chain, everything will be allowed through on that/those route(s).
 */
@AuthenticatorPlugin()
export class Anonymous implements IAuthenticator, IAuthenticatorConstructor {

  /**
   * Called by SakuraApi when checking authentication using this authenticator. You don't have to do anything
   * with this. It's automagic.
   * @param {e.Request} req
   * @param {e.Response} res
   * @returns {Promise<AuthenticatorPluginResult>}
   */
  async authenticate(req: Request, res: Response): Promise<AuthenticatorPluginResult> {
    return {data: {}, status: OK, success: true};
  }
}
