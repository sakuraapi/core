# SakuraApi
SakuraAPI is a collaborative effort to develop an appropriately opinionated NodeJS API framework utilizing modern technologies like TypeScript and emerging ECMAscript standards.

What is appropriately opinionated is a matter of opinion. ;)

At the moment, this project is an experiment to explore various ideas with my team.

## Goals

* Anyone looking at a SakuraApi based project should be able to get a quick feel for what's going on, if they're familiar with SakuraApi. The structure is opinionated enough that disparate projects will feel familiar (assuming the developer didn't go out of their way to be non-standard).
* SakuraApi is built using modern and emerging web standards. If there is some reason your system cannot use Node 7+ or TypeScript 2+, then this isn't the right project for you. Currently there are no plans to expose a pure ECMAScript version of the framework.
* Implementing a new model or route in a SakuraApi project should be ergonomic - it shouldn't require that you remember to change settings in various files spread throughout your project.
* SakuraApi should encourage good API development practices through how developers implement it. In other words, using SakuraApi as intended should result in an API that's pretty close to best practices.
* SakuraApi should facilitate interacting with the database, but the developer should not be abstracted away from the database.
  * Many of the database abstractions in current frameworks actually make it harder to develop because you can't use you existing knowledge to solve non-trivial db queries. Sometimes the more advanced features of a db aren't event supported yet.
  * Part of this means that interacting with databases will not be treated generically. The framework will initially expose support features for MongoDB. Later, if demand exists, other databases will be supported. Those new databases will have their own nuances and you will not be able to flip a few switches and have you API switch from a NoSQL Document Store to a properly architected Relational Database or Graph Database. It's our opinion that those sorts of features are great for trivial projects but inadequate for any sizable projects that require deep integration with the various data stores that have been selected for each of their unique strengths.

## How to interact with others on this project:

* Open an Issue: https://github.com/sakuraapi/api/issues
* Google Forum: https://groups.google.com/forum/#!forum/sakuraapi
* Gitter: https://gitter.im/sakuraapi

## Dependencies:

* TypeScript >= 2.0
* NodeJS >= 7.0

(among other things)

Why NodeJS 7+? Because it has ECMAScript 2015 features we wanted, and SakuraApi is about emerging standards, not past ones.

## Standards & Process

* Semantic Versioning
* Contributions: Fork the project; work off a feature branch; do a pull request back to develop (pull updates frequently to keep up)
* Before heading off to work on something, considering collaborating first by either (1) opening an issue or (2) starting a conversation on gitter or in the Google forum that leads to back to (1)
* All work should be done against an issue (https://github.com/sakuraapi/api/issues)

## Community and Conduct

Everyone should be treated with respect. Though candor is encouraged, being mean will not be tolerated.

## What's with the name?

[J.P.](https://github.com/etsuo) is half Japanese and he has fond memories of cherry blossoms in Japan... he also likes sakura mochi. No, he doesn't speak Japanese, much to his mother's disappointment.

# Working with the SakuraApi codebase

```
npm install
npm test
```

It's a framework / library, so there isn't an `npm start`. You can look at the [starter](https://github.com/sakuraapi/starter) project to get an ostensive feel for how the api is used.

# Who should use this API?

At the moment, no one for anything other than contributing or experimenting. This is pretty ground-floor stuff, and you have no way of knowing whether or not we get
bored with this two months from now. It's a bad idea to use this framework for any "real" work until it reaches 1.0.0 (Deo volente et ceteris paribus).

# environment

SakuraApi looks for a `config/` folder in the root of your api project.

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
Naturally, anything you define is available to you. You get access to the configuration through `SakuraApi.instsance.config`.

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

You can create a route handler in `{project}/model/user.ts`:
```
import {
  Routable,
  Route
}                   from 'sakuraapi';
import * as express from 'express';

@Routable({
  baseUrl: 'api'
})
class User {
  presidents = [{
    firstName: 'George',
    lastName: 'Washington'
  }, {
    firstName: 'John',
    lastName: 'Adams'
  }];

  constructor() {
  }

  @Route({
    path: 'user',
    method: 'get'
  })
  getUsers(req: express.Request, res: express.Response) {
    res.status(200).json(this.presidents);
  }

  @Route({
    path: 'user/:id',
    method: 'get'
  })
  getUser(req: express.Request, res: express.Response) {
    let id = Number(req.params.id);

    if (id && id - 1 < this.presidents.length && id > 0) {
      res.status(200).json(this.presidents[id - 1]);
    } else {
      res.sendStatus(404);
    }
  }
}
```

Once you've done that, your basic `{project}/index.ts` file should look something like this:

```
import {SakuraApi}       from 'sakuraapi';
import                   './model/user';
import                   'colors';
import * as bodyParser   from 'body-parser'

(function boot() {
  let sapi = SakuraApi.instance;

  sapi.addMiddleware(bodyParser.json());

  sapi
    .listen()
    .catch((err) => {
      console.log(`Error: ${err}`.red);
    });
})();

```


# @Routable and @Route

You declare a class decorated with `@Routable()` to define your routes for SakuraApi. For example:

## @Routable

```
@Routable()
class RelatedRouteHandlers() {
}
```

`@Routable()` takes an `RoutableClassOptions` object for its configuration.

### Options:

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

### Options:

* `path` (string) [default: '']: the path after the `BaseUri` optionally defined in `@Routable` that routes to this handler method.
* `method` (string) [default: 'get']: the HTTP method for this path that routes to this handler method.
* `blackList` (boolean) [default: false]: whether or not this route should be excluded from the router.


# About the SakuraApi class

* It's a singleton.
* You get its instance with `SakuraApi.instance`
* It creates the instance of `express();` used by your API
* You get access to the `express` object with `SakuraApi.instance.app`
