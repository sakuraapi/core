import * as debugInit from 'debug';
import {v4}           from 'uuid';
import {SakuraApi}    from '../sakura-api';

const debug = debugInit('sapi:Injectable');

export const injectableSymbols = {
  id: Symbol('injectableId'),
  isSakuraApiInjectable: Symbol('isSakuraApiInjectable'),
  sapi: Symbol('sapi')
};

/**
 * Thrown when you try to inject a parameter into the constructor of a [[Model]], [[Routable]] or [[Injectable]]
 * decorated class that has not been decorated with `@`[[Injectable]].
 */
export class NonInjectableConstructorParameterError extends Error {
  constructor(target: any, source: any) {

    const targetName = (!target) ? target : (target || {}).name
      || ((target || {}).constructor || {}).name
      || typeof target;

    const sourceName = (source || {}).name
      || ((source || {}).constructor || {}).name
      || typeof source;

    const baseMessage = `Unable to inject ${targetName} into ${sourceName}. Only classes decorated with '@Injectable' can` +
      ` be passed into the ${sourceName} constructor.`;

    const message = (target)
      ? baseMessage
      : `It's possible you have a circular dependency. ${baseMessage}`;

    super(message);
  }
}

/**
 * An attempt was made to use [[SakuraApi.getProvider]] with a parameter that isn't decorated with `@`[[Injectable]].
 */
export class ProvidersMustBeDecoratedWithInjectableError extends Error {
  constructor(target: any) {
    const targetName = (target || {} as any).name
      || ((target || {} as any).constructor || {} as any).name
      || typeof target;

    super(`Invalid attempt to get ${targetName} must be decorated with @Injectable`);
  }
}

/**
 * Thrown when an attempt is made to use an object as a Provider, which has not been registered with the dependency
 * injection system. You register providers when you are instantiating the instance of [[SakuraApi]] for your
 * application.
 */
export class ProviderNotRegistered extends Error {
  constructor(target: any) {
    const targetName = (target || {} as any).name
      || ((target || {} as any).constructor || {} as any).name
      || typeof target;

    super(`${targetName} is not registered as a provider with SakuraApi`);
  }
}

/**
 * @decorator Decorates a class to add injectable functionality which allows that class to be defined in the constructor of
 * other `Injectable` decorated class constructors as well as the constructors of [[Model]]s and [[Routable]]s. These
 * injectable classes are then "provided" by the dependency injection system at the time of instantiation for that
 * object.
 *
 * ### Example
 * <pre>
 *  <span>@</span>Injectable()
 *  export class SomeService {
 *    constructor(private someOtherService: SomeOtherService) {
 *    }
 *    superMethod() { return 'hello world'; }
 *  }
 * </pre>
 * <pre>
 *  <span>@</span>Routable()
 *  export class SomeApi() {
 *    constructor(private someService:SomeService) {
 *      console.log(this.someService.superMethod());
 *    }
 *  }
 * </pre>
 *
 * When instantiating your application's instance of [[SakuraApi]], don't forget to pass each provider into the provider
 * array, or it won't be available to the dependency injection system.
 *
 * @returns {(object) => any}
 */
export function Injectable(): (object) => any {

  return (target: any) => {
    // -----------------------------------------------------------------------------------------------------------------
    // Developer notes:
    //
    // The newConstructor proxy implements logic that needs to take place upon constructions
    // =================================================================================================================
    const newConstructor = new Proxy(target, {
      construct: (t, args, nt) => {
        const expectedDiArgs = Reflect.getMetadata('design:paramtypes', t);

        const diArgs = getDependencyInjections(target, t, target[injectableSymbols.sapi]);

        const c = Reflect.construct(t, diArgs, nt);
        // instance overrides
        return c;
      }
    });

    Reflect.defineProperty(newConstructor, injectableSymbols.id, {
      value: v4(),
      writable: false
    });

    Reflect.defineProperty(newConstructor, injectableSymbols.isSakuraApiInjectable, {
      value: true,
      writable: false
    });

    Reflect.defineProperty(newConstructor.prototype, injectableSymbols.isSakuraApiInjectable, {
      value: true,
      writable: false
    });

    // Injects sapi as a shortcut property on injectables pointing to newConstructor[injectableSymbols.sapi]
    Reflect.defineProperty(newConstructor, 'sapi', {
      configurable: false,
      enumerable: false,
      get: () => newConstructor[injectableSymbols.sapi]
    });

    // Injects sapi as a shortcut property on injectables pointing to newConstructor[injectableSymbols.sapi]
    Reflect.defineProperty(newConstructor.prototype, 'sapi', {
      configurable: false,
      enumerable: false,
      get: () => newConstructor[injectableSymbols.sapi]
    });

    // Injects sapiConfig as a shortcut property on injectables pointing to newConstructor[injectableSymbols.sapi].config
    Reflect.defineProperty(newConstructor, 'sapiConfig', {
      configurable: false,
      enumerable: false,
      get: () => (newConstructor[injectableSymbols.sapi] || {} as any).config
    });

    // Injects sapiConfig as a shortcut property on injectables pointing to newConstructor[injectableSymbols.sapi].config
    Reflect.defineProperty(newConstructor.prototype, 'sapiConfig', {
      configurable: false,
      enumerable: false,
      get: () => (newConstructor[injectableSymbols.sapi] || {} as any).config
    });

    // Injected by SakuraApi in `.mapModels`
    newConstructor[injectableSymbols.sapi] = null;

    return newConstructor;
  };
}

/**
 * Used internally by the Dependency Injection System.
 * @param target
 * @param t
 * @param {SakuraApi} sapi
 * @returns {Array}
 * @internal This is not meant for use outside of the internals of the API; the API can change at any time.
 */
export function getDependencyInjections(target: any, t: any, sapi: SakuraApi) {
  const expectedDiArgs = Reflect.getMetadata('design:paramtypes', t);

  const diArgs = [];

  for (const arg of expectedDiArgs || []) {
    if (!arg) {
      throw new NonInjectableConstructorParameterError(arg, target);
    }

    debug(`injecting %s into %s`, arg.name, target.name);

    const isInjectable = !!arg[injectableSymbols.isSakuraApiInjectable];
    if (typeof arg !== 'function' || !isInjectable) {
      throw new NonInjectableConstructorParameterError(arg, target);
    }

    debug('\t getting provider from sapi');
    diArgs.push(sapi.getProvider(arg));
  }

  return diArgs;
}
