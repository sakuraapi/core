import {MongoClient} from 'mongodb';
import {SakuraMongoDbConnection} from './sakura-mongo-db-connection';

describe('core/sakura-mongo-db', function() {

  beforeEach(function() {
    this.dbUrl = `${this.mongoDbBaseUri}/test`;
    this.sapiDb = new SakuraMongoDbConnection();
  });

  afterEach(function(done) {
    this
      .sapiDb
      .closeAll()
      .then(done)
      .catch(done.fail);
  });

  describe('addConnection', function() {
    it('records a connection, but doesn\'t open the connection', function() {
      this.sapiDb.addConnection('test', this.dbUrl);
      expect(this.sapiDb.getDb('test')).toBeUndefined();
      expect(this.sapiDb.getConnection('test')).toBeDefined();
    })
  });

  describe('connect', function() {
    it('registers a db and connects to it', function(done) {
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

    it('stores its parameters in its private connections map', function(done) {
      this
        .sapiDb
        .connect('test', this.dbUrl)
        .then(() => {
          expect(this.sapiDb.getConnection('test'))
            .toBeDefined();
          done();
        })
        .catch(done.fail);
    })

    describe('does not reconnect to a Db that is already connected', function() {
      it('serial scenario', function(done) {
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

      it('parallel, possible race condition', function(done) {
        spyOn(MongoClient, 'connect')
          .and
          .callThrough();
        let wait = [];
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

  describe('close', function() {
    it('closes a single db connection', function(done) {
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

    it('properly gracefully handles closing a non-existing connection', function(done) {
      this
        .sapiDb
        .close('xyxyxyx')
        .then(done)
        .catch(done.fail);
    });
  });

  describe('closeAll', function() {
    it('closes all connections', function(done) {
      let wait = [];
      wait.push(this.sapiDb.connect('x1', this.dbUrl));
      wait.push(this.sapiDb.connect('x2', this.dbUrl));

      Promise
        .all(wait)
        .then((results) => {
          let db1 = results[0];
          let db2 = results[1];

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

  describe('getDb', function() {
    it('retrieves a connected DB instance by name', function(done) {
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

  describe('getConnection', function() {
    it('retrieves a connection by name', function() {
      this
        .sapiDb
        .addConnection('test', this.dbUrl);

      expect(this.sapiDb.getConnection('test'))
        .toBeDefined();
    });
  });
});
