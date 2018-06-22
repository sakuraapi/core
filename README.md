# Status

|Branch     |Status     |
|-----------|-----------|
| Develop   |[![Build Status](https://travis-ci.org/sakuraapi/core.svg?branch=develop)](https://travis-ci.org/sakuraapi/core)| 
| Master    |[![Build Status](https://travis-ci.org/sakuraapi/core.svg?branch=master)](https://travis-ci.org/sakuraapi/core)|

`@sakuraApi/core` was previously [`@sakuraapi/api`](https://www.npmjs.com/package/@sakuraapi/api).  

# SakuraApi

SakuraAPI is a NodeJS API framework that utilizes modern and emerging webs standards like TypeScript and ES6 in a way that feels familiar to programmers that are responsible for full-stack MEAN development.

## Install

```sh
npm install @sakuraapi/core
```

## Docs

* API Documentation: https://sakuraapi.github.io/docs-core/
* Manual: https://github.com/sakuraapi/manual
* Updates: http://blog.sakuraapi.com

Rapid development is taking place; as a result, docs may be out of date.

## Examples

The example projects and some of the documentation has fallen behind, so the following is a quick sample of what a project utilizing SakuraApi looks like. Updated documentation and a getting started guide is coming.

### Setup a route

```ts
@Routable({
  baseUrl: 'users'
})
export class UserApi extends SakuraApiRoutable {

  constructor(private userService: UserService) {
  }

  @Route({
    method: 'get',
    path: '/'
  })
  async updateCardHandler(req: Request, res: Response, next: NextFunction) {
    const resLocals = res.locals as IRoutableLocals;
    
    try {
      const results:[] = await this.userService.getAll();
      
      resLocals.send(200, results);
    
    } catch(err) {
      resLocals.send(500, {
        error: 'SERVER_ERROR'
      });
    }
      next();
  }
}
```

This example setups a route `/api/users/` that responds to a GET request and uses the `UserService` provider to get the resulting array of user things.

### Setup a model

```ts
@Model({
  dbConfig: dbs.presidents
})
export class President extends SakuraApiModel {
  @Db('fn') @Json('fName')
  firstName: string;
  
  @Db('ln') @Json('lName')
  lastName: string;
}

```

This defines a model that can be marshalled to and from the database or from json. It allows you to alias the fields differently for your DB and JSON. It also supports a number of utility functions that facilitate manipulating the model (persisting it, getting it, mutating before sending it, etc.).

### Provide a service

```ts
@Injectable()
class A {
  constructor() {
  }

  doSomething() {
    return 'real';
  }
}

@Injectable()
class B {
  constructor(public a: A) {
  }

  doSomething() {
    return 'real';
  }

}

@Injectable()
class C {
  constructor(public b: B) {
  }

  doSometing() {
    return 'real';
  }
}

@Injectable()
class AMock {
  doSomething() {
    return 'mock';
  }
}

@Injectable()
class CMock {
  constructor(public b: B) {
  }

  doSomething() {
    return 'mock';
  }
}

const sapi = new SakuraApi({
  providers: [
    {use: AMock, for: A},
    B,
    {use: CMock, for: C}
  ]
});

const a = sapi.getProvider(A);
expect(a.doSomething()).toBe('mock');

const b = sapi.getProvider(B);
expect(b.doSomething()).toBe('real');
expect(b.a.doSomething()).toBe('mock');

const c = sapi.getProvider(C);
expect(c.doSomething()).toBe('mock');
expect(c.b.doSomething()).toBe('real');
expect(c.b.a.doSomething()).toBe('mock');
```

Injectables are lazy loaded singletons that can be injected into other Injectables, Models and Routables. They're mockable, allowing you to easily isolate your code for testing.  

## Goals

* Good DX (developer experience)
* A person coming to SakuraApi for the first time should be have a sense of familiarity if they're familiar with Angular or other frameworks that make use of DI concepts and Decorators.   
* Built in dependency injection system to facilitate loose coupling and mocking for a better testing experience
* Built in plugin system to allow quick addition of functionality like email based authentication system, or Facebook oAuth login, etc.
* SakuraApi is built using modern and emerging web standards. If a circumstance arises where a choice has to be made between new or emerging standards or backwards comparability with older versions of Node, etc., legacy loses.
* Configuration should be kept close to the thing being configured, but there should also be a robust cascading configuration system.
* SakuraApi should be easy to integrate into a CI/CD system via its configuration system.
* SakuraApi should encourage good API development practices through how developers implement it. In other words, using SakuraApi as intended should result in an API that's reasonably close to best practices (within the semantic domain of whatever that means).
* SakuraApi should facilitate interacting with MongoDB, but the developer should not be abstracted away from the database if he or she needs to dive deep into MongoDB land.
  * It is the opinion of the maintainer of this framework that many of the database abstractions in current frameworks actually make it harder to develop because you can't use you existing knowledge of MongoDB to solve non-trivial queries. Sometimes the more advanced features of a db aren't even supported yet.
  * As a result, interacting with databases will not be treated generically - this is a MEAN stack framework, where the letter M is brought to you by MongoDB. Someone familiar with the NodeJS drivers for MongoDB should feel familiar with SakuraApi if anything non-trivial needs to be accomplished.
  * If you're looking for RDMS support (e.g., MySQL, PosgreSQL, etc.), support for some othe NoSQL database, or ______, this is likely not the API you're looking for (Jedi hand-wave).
* SakuraApi should have an eco-system that simplifies common tasks. For example, there should be a suite of basic handlers that know how to CRUD models through automagically presenting a REST api for a Model.
  * Models are CRUD capable out of the box
  * Native authentication (email password) and oAuth for common platforms (like Facebook, Google, etc.), are available via plugins
* SakuraApi should support a plugin system that allows easy addition of additional functionality that might be useful to a subset of users, but not all users
* SakuraApi should be secure. 

## How to interact with others on this project:

* Open an Issue: https://github.com/sakuraapi/api/issues
* Google Forum: https://groups.google.com/forum/#!forum/sakuraapi
* Gitter: https://gitter.im/sakuraapi

This is a new tiny community, so if you don't get a response right away, it might be that we haven't noticed you rather than that we're ignoring you. Feel free to be persistent.

## Dependencies:

* TypeScript >= 2.6
* NodeJS >= 8.0

(among other things)
 
## Contributions

[![CLA assistant](https://cla-assistant.io/readme/badge/sakuraapi/core)](https://cla-assistant.io/sakuraapi/core)

See: [CONTRIBUTING](CONTRIBUTING) for details.

## Bug Reporting

* An ideal bug report will include a PR with a unit-testing demonstrating the bug. TDBR (test driven bug reporting). :)
* Feel free to open an issue before you start working on a PR to prove / demonstrate your bug report, but please close that ticket if you find that your bug was an error on your side

## Community and Conduct

Everyone should be treated with respect. Though candor is encouraged, being mean will not be tolerated.

# Working with the SakuraApi codebase

```sh
npm install
npm test
```

You can look at the [starter](https://github.com/sakuraapi/example) project to get an ostensive feel for how the api is used. Make sure th example project has the same version as the current version of SakuraApi. If it does not, then it may not be accurate.

SakuraApi uses Docker for testing, so you need to have a Docker installed if you plan to contribute.

If you need to override where the tests look for MongoDB, you can override the port like this:

```sh
TEST_MONGO_DB_PORT=27001 npm run test
```

You override the address with `TEST_MONGO_DB_ADDRESS` like this:

```sh
TEST_MONGO_DB_ADDRESS=0.0.0.0 npm run test
```

That said, you really should be using the project's docker setup for testing.

# Who should use this API?

Anyone who's ok with the changing API until the project reaches 1.0. Anyone who's open to reporting bugs. Anyone who thinks this adds value to whatever it is they're working on.

Though this API is not being developed for or by Olive Technology, Inc. Olive Technology has been kind enough to allow a few of us to spend some of our time contributing to this project towards meeting the needs of some of their client projects. This does not imply in any way that Olive Technology has any claim to the intellectual properties of this project or that Olive Technology has any special licensing rights. It's BSD all around. ;)

# Configuration

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

There are some properties in the environmental config that are used by the system if they're present. For example, consider this possible `environment.json`:

```js
{
  "server": {
    "address": "127.0.0.1"
    "port": 3000
  },
  
  "dbConnections": [
    {
      "mongoClientOptions": {},       // any options to pass to MongoDB
      "name": "userDb",               // the key used to reference this
                                      // connection.
      "url": "mongodb://..."          // MongoDB connection string
    }
  ]
}
```

Naturally, anything you define is available to you. You get access to the configuration through `SakuraApi.instsance.config`.

# Some tips for contributing to SakuraApi

## Dependencies

To build this project you must have:

* npm 5+
* node
* docker
* a bash compatible terminal

## Building the Project

* `npm run build`: builds the project and outputs the build to `lib/`
* `npm start`: builds the project and continually monitors for changes, which trigger builds
* `npm run start:test`: builds the project and continually monitors for changes, which trigger tests to be re-run (continual testing)
* `doc:generate`: serves up the doc files -- do not commit these unless you are responsible for publishing a release 

## Testing

* `npm test`: runs the full suite of tests
* `npm run test:db`: runs the full suite of tests and preserves the DB (`docker ps`, connect via port 37001). This is helpful if you need to inspect the state of the database during test development
* `npm run test:debug`: runs tests with `DEBUG=sapi:*,-sapi:*:verbose` set
* `npm run test:verbose`: runs tests with `DEBUG=sapi:*` set
* `npm run test:vverbose`: runs tests with `DEBUG=*` set

## Lint

* `npm run lint`
