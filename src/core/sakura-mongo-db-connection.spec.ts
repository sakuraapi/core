import {MongoClient}             from 'mongodb';
import {
  testMongoDbUrl,
  testSapi
}                                from '../../spec/helpers/sakuraapi';
import {SakuraMongoDbConnection} from './sakura-mongo-db-connection';

describe('core/sakura-mongo-db', () => {

  const sapi = testSapi({
    models: [],
    routables: []
  });

  const dbUrl = `${testMongoDbUrl(sapi)}/test`;
  let sapiDb: SakuraMongoDbConnection;

  beforeEach(() => {
    sapiDb = new SakuraMongoDbConnection();
  });

  afterEach((done) => {
    sapiDb
      .closeAll()
      .then(done)
      .catch(done.fail);
  });

  describe('addConnection', () => {
    it('records a connection, but doesn\'t open the connection', () => {
      sapiDb.addConnection('test', dbUrl);
      expect(sapiDb.getDb('test')).toBeUndefined();
      expect(sapiDb.getConnection('test')).toBeDefined();
    });

    it('throws with non-string dbName values', () => {
      expect(() => {
        sapiDb.addConnection({} as any, dbUrl);
      }).toThrowError('dbName must be type string but instead was object');

    });
  });

  describe('connect', () => {
    it('registers a db and connects to it', (done) => {
      sapiDb
        .connect('test', dbUrl)
        .then((db) => {
          expect(db)
            .toBeDefined();
          done();
        })
        .catch(done.fail);
    });

    it('stores its parameters in its private connections map', (done) => {
      sapiDb
        .connect('test', dbUrl)
        .then(() => {
          expect(sapiDb.getConnection('test'))
            .toBeDefined();
          done();
        })
        .catch(done.fail);
    });

    describe('does not reconnect to a Db that is already connected', () => {
      it('serial scenario', (done) => {
        spyOn(MongoClient, 'connect')
          .and
          .callThrough();

        sapiDb
          .connect('test', dbUrl)
          .then(() => {
            sapiDb
              .connect('test', dbUrl)
              .then(() => {
                expect(MongoClient.connect)
                  .toHaveBeenCalledTimes(1);
                done();
              })
              .catch(done.fail);
          })
          .catch(done.fail);
      });

      it('parallel, possible race condition', (done) => {
        spyOn(MongoClient, 'connect')
          .and
          .callThrough();
        const wait = [];
        wait.push(sapiDb.connect('test', dbUrl));
        wait.push(sapiDb.connect('test', dbUrl));

        Promise
          .all(wait)
          .then(() => {
            expect(MongoClient.connect)
              .toHaveBeenCalledTimes(1);
            done();
          })
          .catch(done.fail);
      });
    });
  });

  describe('close', () => {
    it('closes a single db connection', (done) => {
      sapiDb
        .connect('test', dbUrl)
        .then((db) => {
          db
            .on('close', () => {
              done();
            });

          sapiDb
            .close('test')
            .catch(done.fail);
        })
        .catch(done.fail);
    });

    it('properly gracefully handles closing a non-existing connection', (done) => {
      sapiDb
        .close('xyxyxyx')
        .then(done)
        .catch(done.fail);
    });
  });

  describe('closeAll', () => {
    it('closes all connections', (done) => {
      const wait = [];
      wait.push(sapiDb.connect('x1', dbUrl));
      wait.push(sapiDb.connect('x2', dbUrl));

      Promise
        .all(wait)
        .then((results) => {
          const db1 = results[0];
          const db2 = results[1];

          let closeCount = 0;
          db1.on('close', () => closeCount++);
          db2.on('close', () => closeCount++);

          sapiDb
            .closeAll()
            .then(() => {
              expect(closeCount)
                .toBe(2);
              done();
            })
            .catch(done.fail);
        })
        .catch(done.fail);
    });
  });

  describe('getDb', () => {
    it('retrieves a connected DB instance by name', (done) => {
      sapiDb
        .connect('test', dbUrl)
        .then((db) => {
          expect(sapiDb.getDb('test'))
            .toEqual(db);
          done();
        })
        .catch(done.fail);
    });
  });

  describe('getConnection', () => {
    it('retrieves a connection by name', () => {
      sapiDb
        .addConnection('test', dbUrl);

      expect(sapiDb.getConnection('test'))
        .toBeDefined();
    });
  });
});
