# api
SakuraAPI is a collaborative effort to develop an appropriately opinionated NodeJS API framework utilizing modern technologies like TypeScript and emerging ECMAscript standards.

What is appropriately opinionated is a matter of opinion. ;)

At the moment, this project is an experiment to explore various ideas with my team.

How to interact with others on this project:

* Gitter: https://gitter.im/sakuraapi
* Open an Issue: https://github.com/sakuraapi/api/issues

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
