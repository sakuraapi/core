import {MongoClient} from 'mongodb';
import {testMongoDbUrl, testSapi} from '../../spec/helpers/sakuraapi';
import {SakuraMongoDbConnection} from './sakura-mongo-db-connection';

describe('core/sakura-mongo-db', () => {

  const sapi = testSapi({
    models: [],
    routables: []
  });

  beforeEach(() => {

    this.dbUrl = `${testMongoDbUrl(sapi)}/test`;
    this.sapiDb = new SakuraMongoDbConnection();
  });

  afterEach((done) => {
    this
      .sapiDb
      .closeAll()
      .then(done)
      .catch(done.fail);
  });

  describe('addConnection', () => {
    it('records a connection, but doesn\'t open the connection', () => {
      this.sapiDb.addConnection('test', this.dbUrl);
      expect(this.sapiDb.getDb('test')).toBeUndefined();
      expect(this.sapiDb.getConnection('test')).toBeDefined();
    });
  });

  describe('connect', () => {
    it('registers a db and connects to it', (done) => {

      this
        .sapiDb
        .connect('test', this.dbUrl)
        .then((db) => {
          expect(db)
            .toBeDefined();
          done();
        })
        .catch(done.fail);
    });

    it('stores its parameters in its private connections map', (done) => {
      this
        .sapiDb
        .connect('test', this.dbUrl)
        .then(() => {
          expect(this.sapiDb.getConnection('test'))
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

        this
          .sapiDb
          .connect('test', this.dbUrl)
          .then(() => {
            this
              .sapiDb
              .connect('test', this.dbUrl)
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
        wait.push(this.sapiDb.connect('test', this.dbUrl));
        wait.push(this.sapiDb.connect('test', this.dbUrl));

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
      this
        .sapiDb
        .connect('test', this.dbUrl)
        .then((db) => {
          db
            .on('close', () => {
              done();
            });

          this
            .sapiDb
            .close('test')
            .catch(done.fail);
        })
        .catch(done.fail);
    });

    it('properly gracefully handles closing a non-existing connection', (done) => {
      this
        .sapiDb
        .close('xyxyxyx')
        .then(done)
        .catch(done.fail);
    });
  });

  describe('closeAll', () => {
    it('closes all connections', (done) => {
      const wait = [];
      wait.push(this.sapiDb.connect('x1', this.dbUrl));
      wait.push(this.sapiDb.connect('x2', this.dbUrl));

      Promise
        .all(wait)
        .then((results) => {
          const db1 = results[0];
          const db2 = results[1];

          let closeCount = 0;
          db1.on('close', () => closeCount++);
          db2.on('close', () => closeCount++);

          this
            .sapiDb
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
      this
        .sapiDb
        .connect('test', this.dbUrl)
        .then((db) => {
          expect(this.sapiDb.getDb('test'))
            .toEqual(db);
          done();
        })
        .catch(done.fail);
    });
  });

  describe('getConnection', () => {
    it('retrieves a connection by name', () => {
      this
        .sapiDb
        .addConnection('test', this.dbUrl);

      expect(this.sapiDb.getConnection('test'))
        .toBeDefined();
    });
  });
});
