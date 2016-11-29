import * as _  from 'lodash';
import * as fs from 'fs';


export class SakuraApiConfig {

  constructor() {
  }

  load(path?: string): any {
    path = path || 'config/environment.json';

    let config = {};
    let baseConfig = {};
    let baseTsConfig = {};

    // environment.json
    try {
      baseConfig = JSON.parse(fs.readFileSync(path, {encoding: 'utf8'}));
    } catch (err) {
      handleLoadError(err, path, false);
    }

    // environment.ts
    let tsPath = changeFileExtension(path, 'ts');
    try {
      baseTsConfig = require(`${process.cwd()}/${tsPath}`);
    } catch (err) {
      handleLoadError(err, path, true);
    }

    let env = process.env.NODE_ENV;
    let envConfig = {};
    let envTsConfig = {};
    if (env && env.NODE_ENV !== '') {
      // environment.{env}.json
      let pathParts = path.split('/');
      let fileParts = pathParts[pathParts.length - 1].split('.');

      fileParts.splice(fileParts.length - 1, 0, env);
      pathParts[pathParts.length - 1] = fileParts.join('.');
      path = pathParts.join('/');

      try {
        envConfig = JSON.parse(fs.readFileSync(path, {encoding: 'utf8'}));
      } catch (err) {
        handleLoadError(err, path, true);
      }

      path = changeFileExtension(path, 'ts');

      // environment.{env}.ts
      try {
        envTsConfig = require(`${process.cwd()}/${path}`);
      } catch (err) {
        handleLoadError(err, path, true);
      }
    }

    _.merge(config, baseConfig, baseTsConfig, envConfig, envTsConfig, process.env);
    return config;

    //////////
    function changeFileExtension(path: string, newExtension: string) {
      let pathParts = path.split('/');
      let fileParts = pathParts[pathParts.length - 1].split('.');
      fileParts[fileParts.length - 1] = newExtension;

      pathParts[pathParts.length - 1] = fileParts.join('.');
      return pathParts.join('/');
    }

    function handleLoadError(err: Error, path: string, noDefault: boolean) {
      if (err['code'] === 'ENOENT') {
        // NOOP: the config file is empty, just default to {}
        return;
      } else if (err.message.startsWith('Cannot find module')) {
        // NOOP: a ts config file wasn't found
        return;
      } else if (err.message === 'Unexpected end of JSON input') {
        let e = new Error(err.message);
        e['code'] = 'INVALID_JSON_EMPTY';
        e['path'] = path;
        throw e;
      } else if (err.message.startsWith('Unexpected token')) {
        let e = new Error(err.message);
        e['code'] = 'INVALID_JSON_INVALID';
        e['path'] = path;
        throw e;
      } else {
        throw err;
      }
    }
  }
}
