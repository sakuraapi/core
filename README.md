# SakuraApi
SakuraAPI is a collaborative effort to develop an appropriately opinionated NodeJS API framework utilizing modern technologies like TypeScript and emerging ECMAscript standards.

What is appropriately opinionated is a matter of opinion. ;)

At the moment, this project is an experiment to explore various ideas with my team.

How to interact with others on this project:

* Gitter: https://gitter.im/sakuraapi
* Open an Issue: https://github.com/sakuraapi/api/issues

## Dependencies:

* TypeScript >= 2.0
* NodeJS >= 7.0

(among other things)

Why NodeJS 7+? Because it has ECMAScript 2015 features we wanted, and SakuraApi is about emerging standards, not past ones.

## Standards & Process

* Semantic Versioning
* Contributions: Fork the project; work off a feature branch; do a pull request back to develop (pull updates frequently to keep up)
* Before heading off to work on something, considering collaborating first by either (1) opening an issue or (2) starting a conversation on gitter that leads to (1)
* All work should be done against an issue (https://github.com/sakuraapi/api/issues) that's been moved to "Selected" in https://github.com/sakuraapi/api/projects/1.

## What's with the name?

J.P. (https://github.com/etsuo) is half Japanese and he has fond memories of cherry blossoms in Japan... and he likes sakura mochi. No, he doesn't speak Japanese, much to his mother's disappointment.

# Working with the SakuraApi codebase

```
npm install
npm test
```

It's a framework / library, so there isn't an `npm start`.

# Who should use this?

No one for anything other than contributing or experimenting. This is pretty ground-floor stuff, and you have no way of knowing whether or not we get
bored with this two months from now. It's a bad idea to use this framework for any "real" work until it reaches 1.0.0 (Deo volente et ceteris paribus).

# environment

SakuraApi looks for a `config/` folder in the root of your server project.

It cascades the values found in the following order (the last taking precedence over the former):

1. environment.json
1. environment.ts
1. environment.{env}.json
1. environment.{env}.ts
1. system environmental variables

Where `{env}` is replaced by what's set in the environmental variable `NODE_ENV`. For example, if your set
`NODE_ENV=dev` when you start your server, the system will load:

1. environment.json
1. environment.ts
1. environment.dev.json
1. environment.dev.ts
1. system environmental variables

## config

There are some properties in the environmental config that are used by the system if they're present:

```
{
  server: {
    address: string,      // '127.0.0.1'
    port: number          // 3000
  }
}
```

# Using SakuraAPI

See: https://github.com/sakuraapi/starter

Setup a basic project:

```
mkdir {project}
cd {project}
npm init
npm install sakuraapi --save
mkdir config
cd {config}
touch environment.json
```

You'll want to edit the {project}/config/environment.json file:

```
{
  server: {
    address: string,      // '127.0.0.1'
    port: number          // 3000
  }
}
```

You'll probably also want to `git init` in your project root.

Your `{project}/package.json` should look something like this:

```
{
  "name": "starter",
  "version": "0.0.0",
  "description": "A starter project for SakuraAPI",
  "private": true,
  "main": "./dist/index.js",
  "scripts": {
    "build": "tsc",
    "start": "npm run build && nodemon .",
    "test": "echo \"Error: no test specified\" && exit 1",
    "tsc": "tsc"
  },
  "author": "You",
  "license": "MIT",
  "dependencies": {
    "colors": "^1.1.2",
    "express": "^4.14.0",
    "sakuraapi": "^0.1.0"
  },
  "devDependencies": {
    "@types/colors": "^0.6.33",
    "@types/es6-promise": "0.0.32",
    "@types/express": "^4.0.34",
    "@types/node": "^6.0.51",
    "nodemon": "^1.11.0",
    "typescript": "^2.0.10"
  }
}
```

Make sure to run `npm install` after you update your `{project}/package.json`.

Your `{project}/tsconfig.json` should look something like this:

```
{
  "compilerOptions": {
    "module": "commonjs",
    "target": "es5",
    "noImplicitAny": false,
    "outDir": "dist",
    "sourceMap": false,
    "removeComments": true,
    "noLib": false,
    "declaration": true,
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true
  },
  "exclude": [
    "node_modules",
    "scripts",
    "dist"
  ]
}
```

Once you've done that, your basic `{project}/index.ts` file should look something like this:

```
import {
  Routable,
  Route,
  SakuraApi
}                   from 'sakuraapi';
import * as colors  from 'colors';
import * as express from 'express';

@Routable({
  baseUrl: 'api'
})
class Hello {

  @Route({
    path: 'greeting',
    method: 'get'
  })
  getGreeting(req: express.Request, res: express.Response) {
    res.status(200).json({
      greeting: 'Hello World'
    });
  }
}

(function boot() {
  let sapi = SakuraApi.instance;
  sapi
    .listen()
    .catch((err) => {
      console.log(`Error: ${err}`.red);
    });
})();
```


# @Routable and @Route

You define a class decordated with `@Routable()` to define your routes for SakuraApi. For example:

## @Routable

```
@Routable()
class RelatedRouteHandlers() {
}
```

`@Routable()` takes an `RoutableClassOptions` object for its configuration.

Options:

* `autoRoute` (true | false) [default: true]: a value of false tells `@Routable` to not automatically add the classes
   routes to `SakuraApi`'s ExpressJS router.
* `blackList` (string[]) [default: []]: an array of method names to black list. A black listed method with an `@Route` decorator will
   be ignored when `@Routable` is adding its `@Route` methods to the router.
* `baseUrl` (string) [default: '']: sets the base url shared by all `@Route` methods defined by this class.

## @Route

```
@Routable({
  baseUrl: 'users/'
})
class UserRoutes() {

  @Route()
  getUser(req: express.Request, res: express.Response) {
    res.status(200).json({userId: 123});
  }
}
```

`@Route()` takes an `RoutableMethodOptions` object for its configuration.

Options:

* `path` (string) [default: '']: the path after the `BaseUri` optionally defined in `@Routable` that routes to this handler method.
* `method` (string) [default: 'get']: the HTTP method for this path that routes to this handler method.
* `blackList` (boolean) [default: false]: whether or not this route should be excluded from the router.


# About the SakuraApi class

* It's a singleton.
* You get it's instance with `SakuraApi.instance`
* It creates the instance of `express();`
* You get access to the `express` object with `SakuraApi.instance.app`

