import * as debugInit from 'debug';
import {v4} from 'uuid';
import {SakuraApi} from '../sakura-api';

const debug = debugInit('sapi:Injectable');

export const injectableSymbols = {
  id: Symbol('injectableId'),
  isSakuraApiInjectable: Symbol('isSakuraApiInjectable'),
  sapi: Symbol('sapi')
};

export class NonInjectableConstructorParameterError extends Error {
  constructor(target: any, source: any) {

    const targetName = (target || {} as any).name
      || ((target || {} as any).constructor || {} as any).name
      || typeof  target;

    const sourceName = (source || {} as any).name
      || ((source || {} as any).constructor || {} as any).name
      || typeof  source;

    const message = `Unable to inject ${targetName} into ${sourceName}. Only classes decorated with '@Injectable' can`
      + ` be passed into the ${sourceName} constructor.`;
    super(message);
  }
}

export class ProvidersMustBeDecoratedWithInjectableError extends Error {
  constructor(target: any) {
    const targetName = (target || {} as any).name
      || ((target || {} as any).constructor || {} as any).name
      || typeof target;

    super(`Invalid attempt to get ${targetName} must be decorated with @Injectable`);
  }
}

export class ProviderNotRegistered extends Error {
  constructor(target: any) {
    const targetName = (target || {} as any).name
      || ((target || {} as any).constructor || {} as any).name
      || typeof target;

    super(`${targetName} is not registered as a provider with SakuraApi`);
  }
}

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

    // Injected by SakuraApi in `.mapModels`
    newConstructor[injectableSymbols.sapi] = null;

    return newConstructor;
  };
}

export function getDependencyInjections(target: any, t: any, sapi: SakuraApi) {
  const expectedDiArgs = Reflect.getMetadata('design:paramtypes', t);

  const diArgs = [];

  for (const arg of expectedDiArgs || []) {
    debug(`injecting ${arg.name} into ${target.name}`);

    const isInjectable = !!arg[injectableSymbols.isSakuraApiInjectable];
    if (typeof arg !== 'function' || !isInjectable) {
      throw new NonInjectableConstructorParameterError(arg, target);
    }

    debug('\t getting provider from sapi');
    diArgs.push(sapi.getProvider(arg));
  }

  return diArgs;
}
