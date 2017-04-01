module.exports = {
  dbConnections: [
    {
      mongoClientOptions: {},
      name: 'userDb',
      url: `mongodb://localhost:${process.env.TEST_MONGO_DB_PORT}/userDb`
    }
  ]
};
