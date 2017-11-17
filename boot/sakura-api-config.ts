import * as fs from 'fs';
import * as _ from 'lodash';
import {SakuraMongoDbConnection} from '../core/sakura-mongo-db-connection';

const debug = {
  normal: require('debug')('sapi:SakuraApiConfig'),
  verbose: require('debug')('sapi:SakuraApiConfig:verbose')
};

/**
 * SakuraApiConfig loads and manages the cascading configuration files of SakuraApi.
 *
 */
export class SakuraApiConfig {

  /**
   * Same as the instance method, but static, and it won't try to use the last loaded config since that
   * requires an instance.
   */
  static dataSources(config: { dbConnections?: any[] }): SakuraMongoDbConnection {
    config = config || {};

    if (!config.dbConnections) {
      debug.normal(`.dataSources, no config (config: ${!!config},`
        + `config.dbConnections: ${!!(config || {} as any).dbConnections})`);

      config.dbConnections = [];
    }

    if (!Array.isArray(config.dbConnections)) {
      throw new Error('Invalid dbConnections array. The "dbConnections" object should be an array');
    }

    const dbConns = new SakuraMongoDbConnection();

    debug.normal(`Adding ${config.dbConnections.length} dbConnections.`);
    for (const conn of config.dbConnections) {
      dbConns.addConnection(conn.name, conn.url, conn.mongoClientOptions);
    }

    return dbConns;
  }

  /**
   * The configuration that was loaded from the various json and ts files and the environmental
   * variables that were set at the time the configuration was last loaded.
   */
  config: any;

  /**
   * Instantiate SakuraApiConfig.
   */
  constructor() {
    debug.normal('.constructor');
  }

  /**
   * Looks for a `dbConnections` property in the root of config. If one is found, it expects the
   * following:
   * <pre>
   * {
   *     "dbConnections": [
   *         {
   *           "name": "someDb1",
   *           "url": "mongodb://localhost:1234/somedb1",
   *           "mongoClientOptions": {}
   *         },
   *         {
   *           "name": "someDb2",
   *           "url": "mongodb://localhost:1234/somedb2",
   *           "mongoClientOptions": {}
   *         }
   *     ]
   * }
   * </pre>
   * Where `someDb1` is the name of the connection that you can use for retrieving the connection with
   * [[SakuraMongoDbConnection.getDb]]('someDb1').
   */
  dataSources(config: any = this.config): SakuraMongoDbConnection {
    return SakuraApiConfig.dataSources(config);
  }

  /**
   * loads the config file specified by path. If no path is provided, load the path/filename defined in environmental
   * variable SAKURA_API_CONFIG, otherwise load `config/environment.json` from the root of the project.
   *
   *  SakuraApi looks for a config/ folder in the root of your api project.
   * It cascades the values found in the following order (the last taking precedence over the former):
   *
   * * environment.json
   * * environment.ts
   * * environment.{env}.json
   * * environment.{env}.ts
   * * system environmental variables
   *
   * Where `{env}` is replaced by what's set in the environmental variable `NODE_ENV`. For example, if your set
   * `NODE_ENV=dev` when you start your server, the system will load:
   *
   * * environment.json
   * * environment.ts
   * * environment.dev.json
   * * environment.dev.ts
   * * system environmental variables
   *
   * @param path
   * @returns {{}}
   */
  load(path?: string): any {

    path = path || process.env.SAKURA_API_CONFIG || 'config/environment.json';
    debug.normal(`.load path: '${path}'`);

    const config = {};
    let baseConfig = {};
    let baseJsConfig = {};

    // environment.json
    debug.normal(`loading environment.json`);
    try {
      baseConfig = JSON.parse(fs.readFileSync(path, {encoding: 'utf8'}));
      debug.normal(`loaded environment.json`);
      debug.verbose(baseConfig);
    } catch (err) {
      debug.normal(`${err}`);
      handleLoadError(err, path, false);
    }

    // environment.js
    const jsPath = changeFileExtension(path, 'js');
    debug.normal(`loading ${jsPath}`);
    try {
      baseJsConfig = require(`${process.cwd()}/${jsPath}`);
      debug.normal(`loaded ${jsPath}`);
      debug.verbose(baseConfig);
    } catch (err) {
      debug.normal(`${err}`);
      handleLoadError(err, path, true);
    }

    const env = process.env.NODE_ENV;
    let envConfig = {};
    let envJsConfig = {};
    if (env && env !== '') {
      // environment.{env}.json
      const pathParts = path.split('/');
      const fileParts = pathParts[pathParts.length - 1].split('.');

      fileParts.splice(fileParts.length - 1, 0, env);
      pathParts[pathParts.length - 1] = fileParts.join('.');
      path = pathParts.join('/');

      debug.normal(`loading ${path}`);
      try {
        envConfig = JSON.parse(fs.readFileSync(path, {encoding: 'utf8'}));
        debug.normal(`loaded ${path}`);
        debug.verbose(envConfig);
      } catch (err) {
        debug.normal(`${err}`);
        handleLoadError(err, path, true);
      }

      path = changeFileExtension(path, 'js');

      // environment.{env}.js
      debug.normal(`loading ${process.cwd()}/${path}`);
      try {
        envJsConfig = require(`${process.cwd()}/${path}`);
        debug.normal(`loaded ${process.cwd()}/${path}`);
        debug.verbose(envJsConfig);
      } catch (err) {
        debug.normal(`${err}`);
        handleLoadError(err, path, true);
      }
    }

    _.merge(config, baseConfig, baseJsConfig, envConfig, envJsConfig, process.env);
    this.config = config;

    debug.verbose('.load:\n%O', config);
    return config;

    //////////
    function changeFileExtension(targetPath: string, newExtension: string) {
      const pathParts = targetPath.split('/');
      const fileParts = pathParts[pathParts.length - 1].split('.');
      fileParts[fileParts.length - 1] = newExtension;

      pathParts[pathParts.length - 1] = fileParts.join('.');
      return pathParts.join('/');
    }

    function handleLoadError(err: Error, targetPath: string, noDefault: boolean) {
      if ((err as any).code === 'ENOENT') {
        // NOOP: the config file is empty, just default to {}
        debug.normal(`.load config file empty, defaulting to {} for path: '${targetPath}'`);
        return;
      } else if (err.message.startsWith('Cannot find module')) {
        // NOOP: a ts config file wasn't found
        debug.normal(`.load config file wasn't found, defaulting to {} for path: '${targetPath}'`);
        return;
      } else if (err.message === 'Unexpected end of JSON input') {
        const jsonInputErr = new Error(err.message);
        (jsonInputErr as any).code = 'INVALID_JSON_EMPTY';
        (jsonInputErr as any).path = targetPath;
        debug.normal(`.load path: '${targetPath}', error:`, err);
        throw jsonInputErr;
      } else if (err.message.startsWith('Unexpected token')) {
        const tokenErr = new Error(err.message);
        (tokenErr as any).code = 'INVALID_JSON_INVALID';
        (tokenErr as any).path = targetPath;
        debug.normal(`.load path: '${targetPath}', error:`, err);
        throw tokenErr;
      } else {
        debug.normal(`.load path: '${targetPath}', error:`, err);
        throw err;
      }
    }
  }
}
