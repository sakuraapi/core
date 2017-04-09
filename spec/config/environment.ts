module.exports = {
  dbConnections: [
    {
      mongoClientOptions: {},
      name: 'userDb',
      url: `mongodb://${process.env.TEST_MONGO_DB_ADDRESS}:${process.env.TEST_MONGO_DB_PORT}/userDb`
    }
  ]
};
