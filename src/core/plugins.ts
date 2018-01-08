import {
  Handler,
  Request,
  Response
}                     from 'express';
import {v4}           from 'uuid';
import {modelSymbols} from './@model/model';
import {SakuraApi}    from './sakura-api';

/**
 * Passed into [[Routable]] or [[Route]] `authentication` option. Provides authentication behavior per the
 * specifics of the plugin that provided the IAuthenticator(s) via [[SakuraApiPluginResult.authenticators]].
 *
 * An authenticator returns boolean true if the user is authenticated. It returns false if the user is not authenticated
 * or it returns an object that will be returned to the client. If the object has a status property, that will be
 * returned as the HTTP code upon failing to authenticate.
 *
 * Authenticators fall through until one of them returns true, otherwise, the first failure is returned.
 */
export interface IAuthenticator {
  authenticate: (req: Request, res: Response) => Promise<AuthenticatorPluginResult>;
}

export interface IAuthenticatorConstructor {
  // new(...params: any[]): IAuthenticatorConstructor;
}

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
  },
  error?: Error,
  status: number,
  success: boolean,
}

/**
 * Used by [[Authenticator]]
 */
export type AuthenticationHandler = (req: Request, res: Response) => Promise<AuthenticatorPluginResult>;

export const authenticatorPluginSymbols = {
  id: Symbol('id'),
  isAuthenticator: Symbol('isAuthenticator'),
  sapi: Symbol('sapi')
};

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

