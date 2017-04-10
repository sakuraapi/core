
# Status
|Branch     |Status     |
|-----------|-----------|
| Develop   |[![Build Status](https://travis-ci.org/sakuraapi/api.svg?branch=develop)](https://travis-ci.org/sakuraapi/api)| 
| Master    |[![Build Status](https://travis-ci.org/sakuraapi/api.svg?branch=master)](https://travis-ci.org/sakuraapi/api)|

API Documentation: https://sakuraapi.github.io/api/

# SakuraApi
SakuraAPI is a NodeJS API framework that utilizes modern and emerging webs standards like TypeScript and ES6 in a way that feels familiar to programmers that are responsible for full-stack MEAN stack development. 

At the moment, this project is an experiment to explore various ideas with my team.

## Goals

* Angular developers should find the conventions in SakuraApi to be familiar.
* Anyone looking at a SakuraApi based project should be able to get a quick feel for what's going on, if they're familiar with SakuraApi. The structure is opinionated enough that disparate projects will feel familiar (assuming the developer didn't go out of their way to be non-standard). 
* SakuraApi is built using modern and emerging web standards. If there is some reason your project cannot use Node 7+ or TypeScript 2+, then this isn't the right project for you. Currently there are no plans to expose a pure ECMAScript version of the framework.
* Implementing a new model or route in a SakuraApi project should be ergonomic - it shouldn't require that you remember to change settings in various files spread throughout your project. SakuraApi should, however, support a robust cascading configuration system.
* SakuraApi should encourage good API development practices through how developers implement it. In other words, using SakuraApi as intended should result in an API that's reasonably close to best practices (withing the semantic domain of whatever that means).
* SakuraApi should facilitate interacting with MongoDB, but the developer should not be abstracted away from the database if he or she needs to dive deep into MongoDB land.
  * It is the opinion of the contributors to this frameowrkMany of the database abstractions in current frameworks actually make it harder to develop because you can't use you existing knowledge of MongoDB to solve non-trivial queries. Sometimes the more advanced features of a db aren't even supported yet.
  * As a result, interacting with databases will not be treated generically - this is a MEAN stack framework, where the letter M is brought to you by MongoDB. 
  * If you're looking for RDMS support (e.g., MySQL, PosgreSQL, etc.), support for some othe NoSQL database, or ______, this is likely not the API you're looking for (Jedi hand-wave).

## How to interact with others on this project:

* Open an Issue: https://github.com/sakuraapi/api/issues
* Google Forum: https://groups.google.com/forum/#!forum/sakuraapi
* Gitter: https://gitter.im/sakuraapi

This is a new tiny community, so if you don't get a response right away, it might be that we haven't noticed you rather than that we're ignoring you. Feel free to be persistent.

## Dependencies:

* TypeScript >= 2.0
* NodeJS >= 7.0

(among other things)

## Standards & Process

* Semantic Versioning
* Contributions: Fork the project; make your contribution; do a pull request back to develop (pull updates frequently to keep up)
* Before heading off to work on something, considering collaborating first by either (1) opening an issue or (2) starting a conversation on gitter or in the Google forum that leads to back to (1)
* All work should be done against an issue (https://github.com/sakuraapi/api/issues)
* All contributions require unit-tests.
* An ideal bug report will include a PR with a unit-testing demonstrating the bug. TDBR (test driven bug reporting). :)

## Community and Conduct

Everyone should be treated with respect. Though candor is encouraged, being mean will not be tolerated.

## What's with the name?

[J.P.](https://github.com/etsuo) is half Japanese and he has fond memories of cherry blossoms in Japan... he also likes sakura mochi. No, he doesn't speak Japanese, much to his mother's disappointment.

# Working with the SakuraApi codebase

```
npm install
npm test
```

It's a framework / library, so there isn't an `npm start`. You can look at the [starter](https://github.com/sakuraapi/example) project to get an ostensive feel for how the api is used.

SakuraApi uses Docker for testing, so you need to have a Docker installed if you plan to contribute.

If you need to override where the tests look for MongoDB, you can override the port like this:
```
TEST_MONGO_DB_PORT=27001 npm run test
```

You override the address with TEST_MONGO_DB_ADDRESS like this:
```
TEST_MONGO_DB_ADDRESS=0.0.0.0 npm run test
```

That said, you really should be using the project's docker setup.

# Who should use this API?

At the moment, no one for anything other than contributing or experimenting. This is pretty ground-floor stuff, and you have no way of knowing whether or not we get
bored with this two months from now. It's a bad idea to use this framework for any "real" work until it reaches 1.0.0 (Deo volente).

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

https://github.com/sakuraapi/example

This part of the documentation needs to be updated. The example project may be out of date at any given point. The example project is current <-> (if and only if) it has the same semver as the framework. A none-current example project may still work with the latest framework, but it will be dated in terms of how SakuraApi should be used. 
