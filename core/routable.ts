import 'reflect-metadata';
import {SakuraApi}            from './sakura-api';
import * as path              from 'path';

export class RoutableClassOptions {
  blackList?: string[];
  baseUrl?: string;
  autoRoute?: boolean;
}

export class RoutableMethodOptions {
  path?: string;
  method?: string;
  blackList?: boolean;
}

export class SakuraApiClassRoutes {
  path: string;       // the class's baseUrl (if any) + the route's path
  f: (any) => any;    // the function that handles the route in Express.use
  httpMethod: string; // the http verb (e.g., GET, PUT, POST, DELETE)
  method: string;     // the classes's method name that handles the route (the name of f)
}

export const routableSymbols = {
  sakuraApiClassRoutes: Symbol('sakuraApiClassRoutes')
};

export function Routable(options?: RoutableClassOptions): any {
  options = options || {};
  options.blackList = options.blackList || [];
  options.baseUrl = options.baseUrl || '';

  options.autoRoute = (typeof options.autoRoute === 'boolean') ? options.autoRoute : true;

  return function (target: any) {

    let newConstructor = new Proxy(target, {
      construct: function (t, args, nt) {
        let c = Reflect.construct(t, args, nt);

        let metaData: SakuraApiClassRoutes[] = [];

        Object
          .getOwnPropertyNames(Object.getPrototypeOf(c))
          .forEach(function (methodName) {

            if (!Reflect.getMetadata(`hasRoute.${methodName}`, c)) {
              return;
            }

            if (options.blackList.indexOf(methodName) > -1) {
              return;
            }

            let endPoint = path.join(options.baseUrl, Reflect.getMetadata(`path.${methodName}`, c)).replace(/\/$/, "");
            if (!endPoint.startsWith('/')) {
              endPoint = '/' + endPoint;
            }

            let data: SakuraApiClassRoutes = {
              path: endPoint,
              f: Reflect.getMetadata(`function.${methodName}`, c).bind(c),
              httpMethod: Reflect.getMetadata(`httpMethod.${methodName}`, c),
              method: methodName
            };

            metaData.push(data);
          });

        c[routableSymbols.sakuraApiClassRoutes] = metaData;

        if (options.autoRoute) {
          SakuraApi.instance.route(c);
        }

        return c;
      }
    });

    if (options.autoRoute) {
      new newConstructor();
    }

    return newConstructor;
  }
}

export function Route(options?: RoutableMethodOptions) {
  options = options || {};
  options.path = options.path || '';
  options.method = options.method || 'get';
  options.blackList = options.blackList || false;

  const methods = ['get', 'post', 'put', 'delete', 'head'];

  return function (target: any, key: string, value: TypedPropertyDescriptor<any>) {

    if (methods.indexOf(options.method) < 0) {
      throw new Error(`@route(...)${(target.constructor || {}).name}.${key} had its 'method' `
        + `property set to '${options.method}', which is invalid. Valid options are: ${methods.join(', ')}`);
    }

    let f = function (...args: any[]) {
      return value.value.apply(this, args);
    };

    if (!options.blackList) {
      Reflect.defineMetadata(`hasRoute.${key}`, true, target);
      Reflect.defineMetadata(`path.${key}`, options.path, target);
      Reflect.defineMetadata(`function.${key}`, f, target);
      Reflect.defineMetadata(`httpMethod.${key}`, options.method.toLowerCase(), target);
    }

    return {
      value: f
    }
  }
}
