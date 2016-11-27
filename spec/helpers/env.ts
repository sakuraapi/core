import * as colors from 'colors';

process.env.NODE_ENV = 'sakura-api-test';
process.env.SAKURA_API_CONFIG_TEST = 'found';
console.log(colors.green(`NODE_ENV set to ${process.env.NODE_ENV}`));
