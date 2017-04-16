import {Db} from './db';
import {
  SapiDbForModelNotFound,
  SapiMissingIdErr
} from './errors';
import {
  Model,
  modelSymbols
} from './model';
import {SakuraApiModel} from './sakura-api-model';

import {
  InsertOneWriteOpResult,
  ObjectID,
  ReplaceOneOptions,
  UpdateWriteOpResult
} from 'mongodb';

describe('@Model', function() {

  @Model()
  class Test extends SakuraApiModel {

    static getById(id: string, project?: any): Promise<string> {
      return new Promise((resolve) => {
        resolve('custom');
      });
    }

    testProperty = true;

    constructor(public n: number) {
      super();
      this.save = this.saveOverride;
    }

    // https://github.com/Microsoft/TypeScript/issues/14439
    saveOverride(set?: { [key: string]: any } | null, options?: ReplaceOneOptions): Promise<UpdateWriteOpResult> {
      return Promise.resolve({
        result: {
          n: -1,
          nModified: -1,
          ok: 1
        }
      } as UpdateWriteOpResult);
    }
  }

  describe('construction', function() {

    beforeEach(function() {
      this.t = new Test(777);
    });

    it('properly passes the constructor parameters', function() {
      expect(this.t.n).toBe(777);
    });

    it('maintains the prototype chain', function() {
      expect(this.t instanceof Test).toBe(true);
    });

    it(`decorates itself with Symbol('sakuraApiModel') = true`, function() {
      expect(this.t[modelSymbols.isSakuraApiModel]).toBe(true);
      expect(() => this.t[modelSymbols.isSakuraApiModel] = false)
        .toThrowError(`Cannot assign to read only property 'Symbol(isSakuraApiModel)' of object '#<Test>'`);
    });

    it('maps _id to id without contaminating the object properties with the id accessor', function() {
      this.t.id = new ObjectID();

      expect(this.t._id).toEqual(this.t.id);
      expect(this.t.id).toEqual(this.t.id);

      const json = JSON.parse(JSON.stringify(this.t));
      expect(json.id).toBeUndefined();
    });

    describe('ModelOptions.dbConfig', function() {

      @Model({
        dbConfig: {
          collection: '',
          db: ''
        }
      })
      class TestDbConfig {
      }

      it('throws when dbConfig.db is missing', function() {
        expect(() => {
          new TestDbConfig(); // tslint:disable-line
        }).toThrow();
      });

      it('throws when dbConfig.collection is missing', function() {
        @Model({
          dbConfig: {
            collection: '',
            db: 'test'
          }
        })
        class TestDbConfig {
        }

        expect(() => {
          new TestDbConfig(); // tslint:disable-line
        }).toThrow();
      });
    });

    describe('injects default CRUD method', function() {

      @Model({
        dbConfig: {
          collection: 'users',
          db: 'userDb',
          promiscuous: true
        }
      })
      class TestDefaultMethods extends SakuraApiModel {
        @Db({
          field: 'fn'
        })
        firstName = 'George';
        lastName = 'Washington';
        @Db({
          field: 'pw',
          private: true
        })
        password = '';
      }

      @Model({
        dbConfig: {
          collection: 'users',
          db: 'userDb',
          promiscuous: false
        }
      })
      class ChastityTest extends SakuraApiModel {
        @Db({field: 'fn'})
        firstName = 'George';
        lastName = 'Washington';
      }

      @Model({
        dbConfig: {
          collection: 'bad',
          db: 'bad'
        }
      })
      class TestBadDb extends SakuraApiModel {
      }

      beforeEach(function() {
        this.tdm = new TestDefaultMethods();
        this.tdm2 = new TestDefaultMethods();
        this.ct = new ChastityTest();
      });

      describe('when CRUD not provided by integrator', function() {

        beforeEach(function(done) {
          this
            .sapi
            .dbConnections
            .connectAll()
            .then(done)
            .catch(done.fail);
        });

        describe('static method', function() {

          /**
           * See json.spec.ts for toJson and fromJson tests.
           * See db.spec.ts for toDb and fromDb tests.
           */

          it('removeAll', function(done) {
            expect(this.tdm.id).toBeNull();

            this
              .tdm
              .create()
              .then((createdResult) => {
                expect(createdResult.insertedCount).toBe(1);

                this
                  .tdm2
                  .create()
                  .then((createResult) => {
                    expect(createResult.insertedCount).toBe(1);

                    TestDefaultMethods
                      .removeAll({
                        $or: [{_id: this.tdm.id}, {_id: this.tdm2.id}]
                      })
                      .then((deleteResults) => {
                        expect(deleteResults.deletedCount).toBe(2);
                        done();
                      })
                      .catch(done.fail);

                  })
                  .catch(done.fail);
              })
              .catch(done.fail);
          });

          it('removeById', function(done) {
            expect(this.tdm.id).toBeNull();

            this
              .tdm
              .create()
              .then((createResult) => {
                expect(createResult.insertedCount).toBe(1);

                this
                  .tdm2
                  .create()
                  .then((createResult2) => {
                    expect(createResult2.insertedCount).toBe(1);

                    TestDefaultMethods
                      .removeById(this.tdm.id)
                      .then((deleteResults) => {
                        expect(deleteResults.deletedCount).toBe(1);
                        done();
                      })
                      .catch(done.fail);
                  })
                  .catch(done.fail);
              })
              .catch(done.fail);
          });

          describe('getCollection', function() {
            it('returns a valid MongoDB Collection for the current model', function() {
              const col = TestDefaultMethods.getCollection();
              expect(col['s'].dbName).toBe('userDb');
            });
          });

          describe('getDb', function() {
            it('returns a valid MongoDB Db for the current model', function() {
              const db = TestDefaultMethods.getDb();
              expect(db['s'].databaseName).toBe('userDb');
            });

            it('throws SapiDbForModelNotFound when db is not found', function(done) {
              try {
                TestBadDb.getDb();
                done.fail('Error was expected but not thrown');
              } catch (err) {
                expect(err instanceof SapiDbForModelNotFound).toBeTruthy();
                done();
              }

            });
          });

          it('get', function(done) {

            expect(this.tdm.id).toBeNull();

            this
              .tdm
              .create()
              .then((createdResult) => {
                expect(createdResult.insertedCount).toBe(1);

                TestDefaultMethods
                  .get({_id: this.tdm.id})
                  .then((results) => {
                    expect(results.length).toBe(1);
                    expect(results[0]._id.toString()).toBe(this.tdm.id.toString());
                    expect(results[0].firstName).toBe(this.tdm.firstName);
                    expect(results[0].lastName).toBe(this.tdm.lastName);
                    done();
                  })
                  .catch(done.fail);
              })
              .catch(done.fail);
          });

          it('getOne', function(done) {
            expect(this.tdm.id).toBeNull();

            this
              .tdm
              .create()
              .then((createdResult) => {
                expect(createdResult.insertedCount).toBe(1);

                TestDefaultMethods
                  .getOne({_id: this.tdm.id})
                  .then((result) => {
                    expect(result._id.toString()).toBe(this.tdm.id.toString());
                    expect(result.firstName).toBe(this.tdm.firstName);
                    expect(result.lastName).toBe(this.tdm.lastName);
                    done();
                  })
                  .catch(done.fail);
              })
              .catch(done.fail);
          });

          it('getById', function(done) {
            expect(this.tdm.id).toBeNull();

            this
              .tdm
              .create()
              .then((createdResult) => {
                expect(createdResult.insertedCount).toBe(1);

                TestDefaultMethods
                  .getById(this.tdm.id)
                  .then((result) => {
                    expect(result._id.toString()).toBe(this.tdm.id.toString());
                    expect(result.firstName).toBe(this.tdm.firstName);
                    expect(result.lastName).toBe(this.tdm.lastName);
                    done();
                  })
                  .catch(done.fail);
              })
              .catch(done.fail);
          });

          it('getCursor', function(done) {
            expect(this.tdm.id).toBeNull();

            this
              .tdm
              .create()
              .then((createdResult) => {
                expect(createdResult.insertedCount).toBe(1);

                TestDefaultMethods
                  .getCursor({_id: this.tdm.id})
                  .toArray()
                  .then((results) => {
                    expect(results.length).toBe(1);
                    expect(results[0]._id.toString()).toBe(this.tdm.id.toString());

                    expect(results[0].fn).toBeDefined();
                    expect(results[0].lastName).toBeDefined();

                    expect(results[0].fn).toBe(this.tdm.firstName);
                    expect(results[0].lastName).toBe(this.tdm.lastName);
                    done();
                  })
                  .catch(done.fail);

              })
              .catch(done.fail);
          });

          it('getCursor supports projection', function(done) {
            expect(this.tdm.id).toBeNull();

            this
              .tdm
              .create()
              .then((createResults: InsertOneWriteOpResult) => {
                expect(createResults.insertedCount).toBe(1);

                TestDefaultMethods
                  .getCursor(this.tdm.id, {_id: 1})
                  .next()
                  .then((result) => {
                    expect(result.firstName).toBeUndefined();
                    expect(result.lastName).toBeUndefined();
                    expect(result._id.toString()).toBe(this.tdm.id.toString());
                    done();
                  });
              })
              .catch(done.fail);
          });

          it('getCursorById', function(done) {
            expect(this.tdm.id).toBeNull();

            this
              .tdm
              .create()
              .then((createdResult) => {
                expect(createdResult.insertedCount).toBe(1);

                TestDefaultMethods
                  .getCursorById(this.tdm.id)
                  .next()
                  .then((result) => {
                    expect(result._id.toString()).toBe(this.tdm.id.toString());

                    expect(result.fn).toBeDefined();
                    expect(result.lastName).toBeDefined();

                    expect(result.fn).toBe(this.tdm.firstName);
                    expect(result.lastName).toBe(this.tdm.lastName);
                    done();
                  })
                  .catch(done.fail);

              })
              .catch(done.fail);

          });
        });

        describe('instance method', function() {

          describe('create', function() {
            it('inserts model into db', function(done) {
              this.tdm.id = new ObjectID();
              this
                .tdm
                .create()
                .then((result) => {
                  expect(result.insertedCount).toBe(1);
                  this
                    .tdm
                    .getCollection()
                    .find({_id: this.tdm.id})
                    .limit(1)
                    .next()
                    .then((result2) => {
                      expect(result2._id.toString()).toBe(this.tdm.id.toString());

                      expect(result2.fn).toBeDefined();
                      expect(result2.lastName).toBeDefined();

                      expect(result2.fn).toBe(this.tdm.firstName);
                      expect(result2.lastName).toBe(this.tdm.lastName);
                      done();
                    })
                    .catch(done.fail);
                })
                .catch((err) => {
                  done.fail(err);
                });
            });

            it('sets the models Id before writing if Id is not set', function(done) {
              expect(this.tdm.id).toBeNull();
              this
                .tdm
                .create()
                .then((result) => {
                  expect(result.insertedCount).toBe(1);
                  this
                    .tdm
                    .getCollection()
                    .find({_id: this.tdm.id})
                    .limit(1)
                    .next()
                    .then((result2) => {
                      expect(result2._id.toString()).toBe(this.tdm.id.toString());

                      expect(result2.fn).toBeDefined();
                      expect(result2.lastName).toBeDefined();

                      expect(result2.fn).toBe(this.tdm.firstName);
                      expect(result2.lastName).toBe(this.tdm.lastName);
                      done();
                    })
                    .catch(done.fail);
                });
            });
          });

          describe('getCollection', function() {
            it('returns a valid MongoDB Collection for the current model', function() {
              const col = this.tdm.getCollection();
              expect(col.s.dbName).toBe('userDb');
            });
          });

          describe('getDb', function() {
            it('returns a valid MongoDB Db for the current model', function() {
              const db = this.tdm.getDb();
              expect(db.s.databaseName).toBe('userDb');
            });

            it('throws SapiDbForModelNotFound when db is not found', function(done) {
              try {
                const badDb = new TestBadDb();
                badDb.getDb();

                done.fail('Error was expected but not thrown');
              } catch (err) {
                expect(err instanceof SapiDbForModelNotFound).toBeTruthy();
                done();
              }

            });
          });

          describe('save', function() {
            it('rejects if missing id', function(done) {
              this
                .tdm
                .save()
                .then(() => {
                  done.fail(new Error('Expected exception'));
                })
                .catch((err) => {
                  expect(err).toEqual(jasmine.any(SapiMissingIdErr));
                  expect(err.target).toEqual(this.tdm);
                  done();
                });
            });

            describe('with projection', function() {
              @Model({
                dbConfig: {
                  collection: 'users',
                  db: 'userDb',
                  promiscuous: true
                }
              })
              class PartialUpdateTest extends SakuraApiModel {
                @Db({
                  field: 'fn'
                })
                firstName = 'George';
                lastName = 'Washington';
                @Db({
                  field: 'pw',
                  private: true
                })
                password = '';
              }

              it('sets the proper database level fields', function(done) {
                const pud = new PartialUpdateTest();

                pud
                  .create()
                  .then((createResult) => {
                    expect(createResult.insertedCount).toBe(1);
                    expect(pud.id).toBeTruthy();

                    const updateSet = {
                      firstName: 'updated'
                    };

                    pud
                      .save(updateSet)
                      .then((result: UpdateWriteOpResult) => {
                        expect(result.modifiedCount).toBe(1);
                        expect(pud.firstName).toBe(updateSet.firstName);

                        pud
                          .getCollection()
                          .find({_id: pud.id})
                          .limit(1)
                          .next()
                          .then((updated) => {
                            expect(updated._id instanceof ObjectID || updated._id.constructor.name === 'ObjectID')
                              .toBe(true);
                            expect(updated.fn).toBeDefined();

                            expect(updated.fn).toBe(updateSet.firstName);
                            done();
                          })
                          .catch(done.fail);
                      })
                      .catch(done.fail);
                  });
              });

              it('performs a partial update without disturbing other fields', function(done) {
                const pud = new PartialUpdateTest();
                pud.password = 'test-password';

                let data = {
                  firstName: 'Georgio',
                  lastName: 'Washington'
                };

                pud
                  .create()
                  .then(() => {
                    const body = JSON.parse(JSON.stringify(data));
                    body.id = pud.id.toString();

                    return PartialUpdateTest.fromJson(body).save(body);
                  })
                  .then(() => PartialUpdateTest.getById(pud.id))
                  .then(result => {
                    expect(result._id instanceof ObjectID).toBe(true);
                    expect(result._id.toString()).toBe(pud.id.toString());
                    expect(result.firstName).toBe(data.firstName);
                    expect(result.lastName).toBe(data.lastName);
                    expect(result.password).toBe(pud.password);

                    done();
                  })
                  .catch(done.fail);
              });
            });
          });

          it('updates entire model if no set parameter is passed', function(done) {
            expect(this.tdm.id).toBeNull();
            this
              .tdm
              .create()
              .then((createResult) => {
                expect(createResult.insertedCount).toBe(1);
                expect(this.tdm.id).toBeTruthy();

                const changes = {
                  firstName: 'updatedFirstName',
                  lastName: 'updatedLastName'
                };

                this.tdm.firstName = changes.firstName;
                this.tdm.lastName = changes.lastName;

                this
                  .tdm
                  .save()
                  .then((result: UpdateWriteOpResult) => {
                    expect(result.modifiedCount).toBe(1);

                    this
                      .tdm
                      .getCollection()
                      .find({_id: this.tdm.id})
                      .limit(1)
                      .next()
                      .then((updated) => {
                        expect(updated.fn).toBeDefined();
                        expect(updated.lastName).toBeDefined();

                        expect(updated.fn).toBe(changes.firstName);
                        expect(updated.lastName).toBe(changes.lastName);
                        done();
                      })
                      .catch(done.fail);
                  })
                  .catch(done.fail);
              });
          });

        });

        describe('remove', function() {
          it('itself', function(done) {
            expect(this.tdm.id).toBeNull();

            this
              .tdm
              .create()
              .then((createResult) => {
                expect(createResult.insertedCount).toBe(1);

                this
                  .tdm2
                  .create()
                  .then((createResult2) => {
                    expect(createResult2.insertedCount).toBe(1);
                    this
                      .tdm
                      .remove()
                      .then((deleteResults) => {
                        expect(deleteResults.deletedCount).toBe(1);
                        done();
                      })
                      .catch(done.fail);
                  })
                  .catch(done.fail);
              })
              .catch(done.fail);
          });

        });
      });
    });

    describe('but does not overwrite custom methods added by integrator', function() {
      it('static methods getById', function(done) {
        Test
          .getById('123')
          .then((result) => {
            expect(result).toBe('custom');
            done();
          })
          .catch(done.fail);
      });

      it('static methods save', function(done) {
        this
          .t
          .save()
          .then((op) => {
            expect(op.result.nModified).toBe(-1);
            done();
          })
          .catch(done.fail);
      });
    });

    describe('allows integrator to exclude CRUD with suppressInjection: [] in ModelOptions', function() {
      @Model({suppressInjection: ['get', 'save']})
      class TestSuppressedDefaultMethods extends SakuraApiModel {
      }

      beforeEach(function() {
        this.suppressed = new TestSuppressedDefaultMethods();
      });

      it('with static defaults', function() {
        expect(this.suppressed.get).toBe(undefined);
      });

      it('with instance defaults', function() {
        expect(this.suppressed.save).toBe(undefined);
      });
    });
  });
});
