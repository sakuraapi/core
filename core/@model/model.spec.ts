import {
  IModel,
  Model,
  modelSymbols
} from './model';
import {
  ObjectID,
  UpdateWriteOpResult
} from 'mongodb';
import {SapiMissingIdErr} from './errors';

describe('@Model', function () {

  @Model()
  class Test implements IModel {
    testProperty = true;

    static get: (any) => (any) = null;

    static getById() {
      return 'custom';
    }

    constructor(public n: number) {
    }

    save(): Promise<UpdateWriteOpResult> {
      return Promise.resolve({
        result: {
          ok: 1,
          n: -1,
          nModified: -1
        }
      } as UpdateWriteOpResult);
    }
  }

  describe('construction', function () {

    beforeEach(function () {
      this.t = new Test(777);
    });

    it('properly passes the constructor parameters', function () {
      expect(this.t.n).toBe(777);
    });

    it('maintains the prototype chain', function () {
      expect(this.t instanceof Test).toBe(true);
    });

    it(`decorates itself with Symbol('sakuraApiModel') = true`, function () {
      expect(this.t[modelSymbols.isSakuraApiModel]).toBe(true);
      expect(() => this.t[modelSymbols.isSakuraApiModel] = false)
        .toThrowError(`Cannot assign to read only property 'Symbol(isSakuraApiModel)' of object '#<Test>'`);
    });

    it('maps _id to id without contaminating the object properties with the id accessor', function () {
      this.t.id = new ObjectID();

      expect(this.t._id).toEqual(this.t.id);
      expect(this.t.id).toEqual(this.t.id);

      let json = JSON.parse(JSON.stringify(this.t));
      expect(json.id).toBeUndefined();
    });

    describe('ModelOptions.dbConfig', function () {
      it('throws when dbConfig.db is missing', function () {
        @Model({
          dbConfig: {
            db: '',
            collection: ''
          }
        })
        class TestDbConfig {
        }

        expect(() => {
          new TestDbConfig();
        }).toThrow();
      });

      it('throws when dbConfig.collection is missing', function () {
        @Model({
          dbConfig: {
            db: 'test',
            collection: ''
          }
        })
        class TestDbConfig {
        }

        expect(() => {
          new TestDbConfig();
        }).toThrow();
      });
    });

    describe('injects default CRUD method', function () {
      @Model({
        dbConfig: {
          db: 'userDb',
          collection: 'users'
        }
      })
      class TestDefaultMethods implements IModel {
        static delete: (any) => any;
        static deleteById: (ObjectID) => any;
        static get: (any) => any;
        static getById: (any) => any;

        firstName = 'fName';
        lastName = 'lName';
      }

      beforeEach(function () {
        this.tdm = new TestDefaultMethods();
        this.tdm2 = new TestDefaultMethods();
      });

      describe('when CRUD not provided by integrator', function () {

        beforeEach(function (done) {
          this
            .sapi
            .dbConnections
            .connectAll()
            .then(done)
            .catch(done.fail);
        });

        describe('static method', function () {

          it('delete', function (done) {
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
                      .delete({
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

          it('deleteById', function (done) {
            expect(this.tdm.id).toBeNull();

            this
              .tdm
              .create()
              .then((createResult) => {
                expect(createResult.insertedCount).toBe(1);

                this
                  .tdm2
                  .create()
                  .then((createResult) => {
                    expect(createResult.insertedCount).toBe(1);

                    TestDefaultMethods
                      .deleteById(this.tdm.id)
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

          it('get', function (done) {
            expect(this.tdm.id).toBeNull();

            this
              .tdm
              .create()
              .then((createdResult) => {
                expect(createdResult.insertedCount).toBe(1);

                TestDefaultMethods
                  .get({_id: this.tdm.id})
                  .toArray()
                  .then((results) => {
                    expect(results.length).toBe(1);
                    expect(results[0]._id.toString()).toBe(this.tdm.id.toString());
                    expect(results[0].firstName).toBe(this.tdm.firstName);
                    expect(results[0].lastName).toBe(this.tdm.lastName);
                    done();
                  })
                  .catch(done.fail);

              })
              .catch(done.fail)
          });

          it('getById', function (done) {
            expect(this.tdm.id).toBeNull();

            this
              .tdm
              .create()
              .then((createdResult) => {
                expect(createdResult.insertedCount).toBe(1);

                TestDefaultMethods
                  .getById(this.tdm.id)
                  .next()
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
        });

        describe('instance method', function () {
          describe('create', function () {
            it('inserts model into db', function (done) {
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
                    .then((result) => {
                      expect(result._id.toString()).toBe(this.tdm.id.toString());
                      expect(result.fName).toBe(this.tdm.fName);
                      expect(result.lName).toBe(this.tdm.lName);
                      done();
                    })
                    .catch(done.fail);
                })
                .catch((err) => {
                  done.fail(err);
                });
            });

            it('sets the models Id before writing if Id is not set', function (done) {
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
                    .then((result) => {
                      expect(result._id.toString()).toBe(this.tdm.id.toString());
                      expect(result.fName).toBe(this.tdm.fName);
                      expect(result.lName).toBe(this.tdm.lName);
                      done();
                    })
                    .catch(done.fail);
                });
            });
          });

          describe('save', function () {
            it('rejects if missing id', function (done) {
              this
                .tdm
                .save()
                .then(() => {
                  done.fail(new Error('Expected exception'))
                })
                .catch((err) => {
                  expect(err).toEqual(jasmine.any(SapiMissingIdErr));
                  expect(err.target).toEqual(this.tdm);
                  done();
                });
            });

            it('updates specific fields if set parameter is passed', function (done) {
              expect(this.tdm.id).toBeNull();
              this
                .tdm
                .create()
                .then((createResult) => {
                  expect(createResult.insertedCount).toBe(1);
                  expect(this.tdm.id).toBeTruthy();

                  let updateSet = {
                    firstName: 'updated'
                  };

                  this
                    .tdm
                    .save(updateSet)
                    .then((result: UpdateWriteOpResult) => {
                      expect(result.modifiedCount).toBe(1);
                      expect(this.tdm.firstName).toBe(updateSet.firstName);

                      this
                        .tdm
                        .getCollection()
                        .find({_id: this.tdm.id})
                        .limit(1)
                        .next()
                        .then((updated) => {
                          expect(updated.firstName).toBe(updateSet.firstName);
                          done();
                        })
                        .catch(done.fail);
                    })
                    .catch(done.fail);
                });
            });

            it('updates entire model if no set parameter is passed', function (done) {
              expect(this.tdm.id).toBeNull();
              this
                .tdm
                .create()
                .then((createResult) => {
                  expect(createResult.insertedCount).toBe(1);
                  expect(this.tdm.id).toBeTruthy();

                  let changes = {
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
                          expect(updated.firstName).toBe(changes.firstName);
                          expect(updated.lastName).toBe(changes.lastName);
                          done();
                        })
                        .catch(done.fail);
                    })
                    .catch(done.fail);
                });
            });
          });

          describe('delete', function () {
            it('without filter', function (done) {
              expect(this.tdm.id).toBeNull();

              this
                .tdm
                .create()
                .then((createResult) => {
                  expect(createResult.insertedCount).toBe(1);

                  this
                    .tdm2
                    .create()
                    .then((createResult) => {
                      expect(createResult.insertedCount).toBe(1);
                      this
                        .tdm
                        .delete()
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

            it('with filter', function (done) {
              expect(this.tdm.id).toBeNull();

              this
                .tdm
                .create()
                .then((createResult) => {
                  expect(createResult.insertedCount).toBe(1);

                  this
                    .tdm2
                    .create()
                    .then((createResult) => {
                      expect(createResult.insertedCount).toBe(1);

                      this
                        .tdm
                        .delete({
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
          });
        });
      });

      describe('but does not overwrite custom methods added by integrator', function () {
        it('static methods getById', function () {
          expect(Test.getById()).toBe('custom');
        });

        it('static methods save', function (done) {
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

      describe('allows integrator to exclude CRUD with suppressInjection: [] in ModelOptions', function () {
        @Model({suppressInjection: ['get', 'save']})
        class TestSuppressedDefaultMethods implements IModel {
        }

        beforeEach(function () {
          this.suppressed = new TestSuppressedDefaultMethods();
        });

        it('with static defaults', function () {
          expect(this.suppressed.get).toBe(undefined);
        });

        it('with instance defaults', function () {
          expect(this.suppressed.save).toBe(undefined);
        });
      })
    });
  });
});
