import {
  InsertOneWriteOpResult,
  ObjectID,
  ReplaceOneOptions,
  UpdateWriteOpResult
} from 'mongodb';
import { testSapi } from '../../../spec/helpers/sakuraapi';
import {
  Injectable,
  NonInjectableConstructorParameterError
} from '../@injectable';
import { SakuraApi } from '../sakura-api';
import {
  Db,
  Json,
  Model,
  modelSymbols
} from './';
import {
  SapiDbForModelNotFound,
  SapiMissingIdErr
} from './errors';
import {
  ModelNotRegistered,
  ModelsMustBeDecoratedWithModelError
} from './model';
import { SapiModelMixin } from './sapi-model-mixin';

describe('core/@Model', () => {
  describe('construction', () => {

    it('maintains the prototype chain', () => {
      @Model()
      class TestModel extends SapiModelMixin() {
      }

      const testModel = new TestModel();
      expect(testModel instanceof TestModel).toBe(true);
    });

    it('maps _id to id but defines id as not enumerable', () => {

      @Model()
      class TestModel extends SapiModelMixin() {
      }

      const testModel = new TestModel();
      testModel.id = new ObjectID();

      expect(testModel._id).toEqual(testModel.id);
      expect(testModel.id).toEqual(testModel._id);

      const json = JSON.parse(JSON.stringify(testModel));
      expect(json.id).toBeUndefined();

    });

    describe('ModelOptions.dbConfig', () => {
      @Model({
        dbConfig: {
          collection: '',
          db: ''
        }
      })
      class TestDbConfig {
      }

      it('throws when dbConfig.db is missing', () => {
        expect(() => new TestDbConfig()).toThrow();
      });

      it('throws when dbConfig.collection is missing', () => {
        @Model({
          dbConfig: {
            collection: '',
            db: 'test'
          }
        })
        class TestDbConfig1 {
        }

        expect(() => new TestDbConfig1()).toThrow();
      });

      it('decorates model with collation when provided', () => {
        @Model({
          dbConfig: {
            collation: {locale: 'en'},
            collection: 'db-collection',
            db: 'db-name'
          }
        })
        class TestModel extends SapiModelMixin() {
        }

        const testModel = new TestModel();

        expect(TestModel[modelSymbols.dbCollation].locale).toBe('en');
        expect(TestModel.dbLocale).toBe('en');
        expect(testModel.dbLocale).toBe('en');
      });
    });

    describe('injects default CRUD method when CRUD not provided by integrator', () => {

      const dbConfig = {
        collection: 'users',
        db: 'userDb',
        promiscuous: true
      };

      @Model({
        dbConfig
      })
      class DefaultCrud extends SapiModelMixin() {
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
          collection: 'bad',
          db: 'bad'
        }
      })
      class TestBadDb extends SapiModelMixin() {
      }

      let sapi: SakuraApi;
      beforeEach(async (done) => {
        try {
          sapi = testSapi({
            models: [
              DefaultCrud,
              TestBadDb
            ]
          });

          await sapi
            .dbConnections
            .connectAll();

          done();
        } catch (err) {
          done.fail(err);
        }
      });

      afterEach(async (done) => {
        try {
          await DefaultCrud.removeAll({});
          await sapi.close();

          sapi.deregisterDependencies();
          sapi = null;
          done();
        } catch (err) {
          done.fail(err);
        }
      });

      /**
       * See json.spec.ts for toJson and fromJson tests.
       * See db.spec.ts for toDb and fromDb tests.
       */
      describe('static method', () => {

        it('removeAll', async (done) => {
          try {
            const testDefaultMethods = new (sapi.getModel(DefaultCrud))();
            const testDefaultMethods2 = new (sapi.getModel(DefaultCrud))();

            const createdResult = await testDefaultMethods.create();
            expect(createdResult.insertedCount).toBe(1);

            const createResult2 = await testDefaultMethods2.create();
            expect(createResult2.insertedCount).toBe(1);

            const deleteResults = await DefaultCrud
              .removeAll({
                $or: [
                  {_id: testDefaultMethods.id},
                  {_id: testDefaultMethods2.id}]
              });

            expect(deleteResults.deletedCount).toBe(2);
            done();
          } catch (err) {
            done.fail(err);
          }
        });

        it('removeById', async (done) => {
          try {
            const testDefaultMethods = new (sapi.getModel(DefaultCrud))();
            const testDefaultMethods2 = new (sapi.getModel(DefaultCrud))();

            expect(testDefaultMethods.id).toBeUndefined();

            const createResult = await testDefaultMethods.create();
            expect(createResult.insertedCount).toBe(1);

            const createResult2 = await testDefaultMethods2.create();

            expect(createResult2.insertedCount).toBe(1);
            const deleteResults = await DefaultCrud
              .removeById(testDefaultMethods.id);
            expect(deleteResults.deletedCount).toBe(1);

            done();
          } catch (err) {
            done.fail(err);
          }
        });

        describe('getCollection', () => {
          it('returns a valid MongoDB Collection for the current model', () => {
            const col = DefaultCrud.getCollection();
            expect((col as any).s.dbName).toBe('userDb');
          });
        });

        describe('getDb', () => {
          it('returns a valid MongoDB Db for the current model', () => {
            const db = DefaultCrud.getDb();
            expect((db as any).s.databaseName).toBe('userDb');
          });

          it('throws SapiDbForModelNotFound when db is not found', () => {
            try {
              TestBadDb.getDb();
              fail('Error was expected but not thrown');
            } catch (err) {
              expect(err instanceof SapiDbForModelNotFound).toBeTruthy();
            }
          });
        });

        describe('get', () => {

          it('filter', async (done) => {
            try {
              const testDefaultMethods = new (sapi.getModel(DefaultCrud))();

              const createdResult = await testDefaultMethods.create();
              expect(createdResult.insertedCount).toBe(1);

              const results = await DefaultCrud
                .get({filter: {_id: testDefaultMethods.id}});

              expect(results.length).toBe(1);
              expect(results[0]._id.toString()).toBe(testDefaultMethods.id.toString());
              expect(results[0].firstName).toBe(testDefaultMethods.firstName);
              expect(results[0].lastName).toBe(testDefaultMethods.lastName);

              done();
            } catch (err) {
              done.fail(err);
            }
          });

          it('sort', async (done) => {

            try {

              const models = [
                DefaultCrud.fromJson({lastName: 'Zidi', firstName: 'George'}),
                DefaultCrud.fromJson({lastName: 'Midi', firstName: 'George'}),
                DefaultCrud.fromJson({lastName: 'Aidi', firstName: 'George'})
              ];

              for (const model of models) {
                await model.create();
              }

              const resultsUnsorted = await DefaultCrud.get();
              expect(resultsUnsorted[0].lastName).toBe(models[0].lastName);
              expect(resultsUnsorted[1].lastName).toBe(models[1].lastName);
              expect(resultsUnsorted[2].lastName).toBe(models[2].lastName);

              const resultsSorted = await DefaultCrud.get({sort: {lastName: -1}});
              expect(resultsSorted[2].lastName).toBe(models[2].lastName);
              expect(resultsSorted[1].lastName).toBe(models[1].lastName);
              expect(resultsSorted[0].lastName).toBe(models[0].lastName);

              done();

            } catch (err) {
              done.fail(err);
            }

          });
        });

        it('getOne', async (done) => {
          try {
            const testDefaultMethods = new (sapi.getModel(DefaultCrud))();

            const createdResult = await testDefaultMethods.create();
            expect(createdResult.insertedCount).toBe(1);

            const result = await DefaultCrud.getOne({_id: testDefaultMethods.id});

            expect(result._id.toString()).toBe(testDefaultMethods.id.toString());
            expect(result.firstName).toBe(testDefaultMethods.firstName);
            expect(result.lastName).toBe(testDefaultMethods.lastName);

            done();
          } catch (err) {
            done.fail(err);
          }

        });

        it('getById', async (done) => {
          try {
            const testDefaultMethods = new (sapi.getModel(DefaultCrud))();

            const createdResult = await testDefaultMethods.create();

            expect(createdResult.insertedCount).toBe(1);

            const result = await DefaultCrud.getById(testDefaultMethods.id);

            expect(result._id.toString()).toBe(testDefaultMethods.id.toString());
            expect(result.firstName).toBe(testDefaultMethods.firstName);
            expect(result.lastName).toBe(testDefaultMethods.lastName);

            done();
          } catch (err) {
            done.fail(err);
          }
        });

        describe('getCursor', () => {
          let cursorSapi: SakuraApi;
          const cursorDbConfig = {
            collection: 'cursorTest',
            db: 'userDb'
          };

          @Model({dbConfig: cursorDbConfig})
          class TestWithOutCollation extends SapiModelMixin() {
            @Db() @Json()
            name: string;
          }

          @Model({
            dbConfig: {
              collation: {locale: 'en'},
              ...cursorDbConfig
            }
          })
          class TestCollation extends SapiModelMixin() {
            @Db() @Json()
            name: string;
          }

          beforeEach(async (done) => {
            try {
              cursorSapi = testSapi({models: [TestWithOutCollation, TestCollation]});
              await cursorSapi.dbConnections.connectAll();

              done();
            } catch (err) {
              done.fail(err);
            }
          });

          afterEach(async (done) => {
            await TestCollation.removeAll({});
            await cursorSapi.deregisterDependencies();
            await cursorSapi.close();
            done();
          });

          it('returns a cursor', async (done) => {
            try {
              const testDefaultMethods = new (sapi.getModel(DefaultCrud))();

              const createdResult = await testDefaultMethods.create();

              expect(createdResult.insertedCount).toBe(1);

              const results = await DefaultCrud
                .getCursor({_id: testDefaultMethods.id})
                .toArray();

              expect(results.length).toBe(1);
              expect(results[0]._id.toString()).toBe(testDefaultMethods.id.toString());

              expect(results[0].fn).toBeDefined();
              expect(results[0].lastName).toBeDefined();

              expect(results[0].fn).toBe(testDefaultMethods.firstName);
              expect(results[0].lastName).toBe(testDefaultMethods.lastName);

              done();
            } catch (err) {
              done.fail(err);
            }

          });

          it('returns a cursor with collation, parameter locale', async (done) => {
            try {
              const names = ['ñamumu', 'Bibo', 'Jose', 'Zazu', 'nibizio'];
              for (const name of names) {
                const obj = TestWithOutCollation.fromJson({name});
                await obj.create();
              }

              // verify sort order is wrong without specifying collation
              const noCollationSearchResults = await TestWithOutCollation.getCursor({}).sort({name: 1}).toArray();
              const noColationSort = ['Bibo', 'Jose', 'Zazu', 'nibizio', 'ñamumu'];
              for (let i = 0; i < noColationSort.length; i++) {
                expect(noCollationSearchResults[i].name).toBe(noColationSort[i]);
              }

              const collationSearchResults = await TestWithOutCollation.getCursor({}, null, {locale: 'en'}).sort({name: 1}).toArray();
              const collationSort = ['Bibo', 'Jose', 'ñamumu', 'nibizio', 'Zazu'];
              for (let i = 0; i < noColationSort.length; i++) {
                expect(collationSearchResults[i].name).toBe(collationSort[i]);
              }

              done();
            } catch (err) {
              done.fail(err);
            }
          });

          it('returns a cursor with collation, class locale', async (done) => {
            try {
              const names = ['ñamumu', 'Bibo', 'Jose', 'Zazu', 'nibizio'];
              for (const name of names) {
                const obj = TestWithOutCollation.fromJson({name});
                await obj.create();
              }

              // verify sort order is wrong without specifying collation
              const noCollationSearchResults = await TestWithOutCollation.getCursor({}).sort({name: 1}).toArray();
              const noColationSort = ['Bibo', 'Jose', 'Zazu', 'nibizio', 'ñamumu'];
              for (let i = 0; i < noColationSort.length; i++) {
                expect(noCollationSearchResults[i].name).toBe(noColationSort[i]);
              }

              const collationSearchResults = await TestCollation.getCursor({}).sort({name: 1}).toArray();
              const collationSort = ['Bibo', 'Jose', 'ñamumu', 'nibizio', 'Zazu'];
              for (let i = 0; i < noColationSort.length; i++) {
                expect(collationSearchResults[i].name).toBe(collationSort[i]);
              }

              done();
            } catch (err) {
              done.fail(err);
            }
          });

          it('supports projection', async (done) => {
            try {
              const testDefaultMethods = new (sapi.getModel(DefaultCrud))();

              const createResults: InsertOneWriteOpResult = await testDefaultMethods.create();

              expect(createResults.insertedCount).toBe(1);

              const result = await DefaultCrud
                .getCursor(testDefaultMethods.id, {_id: 1})
                .next();

              expect(result.firstName).toBeUndefined();
              expect(result.lastName).toBeUndefined();
              expect(result._id.toString()).toBe(testDefaultMethods.id.toString());

              done();
            } catch (err) {
              done.fail(err);
            }
          });
        });

        it('getCursorById', async (done) => {
          try {
            const testDefaultMethods = new (sapi.getModel(DefaultCrud))();

            const createdResult = await testDefaultMethods.create();

            expect(createdResult.insertedCount).toBe(1);

            const result = await DefaultCrud
              .getCursorById(testDefaultMethods.id)
              .next();

            expect(result._id.toString()).toBe(testDefaultMethods.id.toString());

            expect(result.fn).toBeDefined();
            expect(result.lastName).toBeDefined();

            expect(result.fn).toBe(testDefaultMethods.firstName);
            expect(result.lastName).toBe(testDefaultMethods.lastName);

            done();
          } catch (err) {
            done.fail(err);
          }
        });
      });

      describe('instance method', () => {

        describe('getCollection', () => {
          it('returns a valid MongoDB Collection for the current model', () => {
            const testDefaultMethods = new (sapi.getModel(DefaultCrud))();
            const col = testDefaultMethods.getCollection();
            expect(col.s.dbName).toBe('userDb');
          });
        });

        describe('getDb', () => {

          it('returns a valid MongoDB Db for the current model', () => {
            const testDefaultMethods = new (sapi.getModel(DefaultCrud))();
            const db = testDefaultMethods.getDb();
            expect(db.s.databaseName).toBe('userDb');
          });

          it('throws SapiDbForModelNotFound when db is not found', (done) => {
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
      });

      describe('remove', () => {
        it('itself', async (done) => {
          try {
            const testDefaultMethods = new (sapi.getModel(DefaultCrud))();
            const testDefaultMethods2 = new (sapi.getModel(DefaultCrud))();

            expect(testDefaultMethods.id).toBeUndefined();

            const createResult = await testDefaultMethods.create();
            expect(createResult.insertedCount).toBe(1);

            const createResult2 = await testDefaultMethods2.create();

            expect(createResult2.insertedCount).toBe(1);
            const deleteResults = await testDefaultMethods.remove();

            expect(deleteResults.deletedCount).toBe(1);

            done();
          } catch (err) {
            done.fail(err);
          }

        });

      });

    });

    describe('but does not overwrite custom methods added by integrator', () => {
      it('static methods getById', async (done) => {
        @Model()
        class TestModel extends SapiModelMixin() {
          isCustom = false;
        }

        (TestModel as any).getById = async (id: string, project?: any): Promise<TestModel> => {
          const test = new TestModel();
          test.isCustom = true;
          return test;
        };

        try {
          const result = await TestModel.getById('123');
          expect(result.isCustom).toBeTruthy();

          done();
        } catch (err) {
          done.fail(err);
        }

      });

      it('static methods save', async (done) => {
        @Model()
        class TestModel extends SapiModelMixin() {
          constructor() {
            super();
            this.save = (set?: { [key: string]: any } | null, options?: ReplaceOneOptions): Promise<UpdateWriteOpResult> => {
              return Promise
                .resolve({
                  result: {
                    n: -1,
                    nModified: -777,
                    ok: 1
                  }
                } as any);
            };
          }
        }

        try {
          const testModel = new TestModel();

          const op = await testModel.save();
          expect(op.result.nModified).toBe(-777);

          done();
        } catch (err) {
          done.fail(err);
        }
      });
    });

    describe('allows integrator to exclude CRUD with suppressInjection: [] in ModelOptions', () => {

      @Model({suppressInjection: ['getById', 'save']})
      class TestSuppressedDefaultMethods extends SapiModelMixin() {
      }

      @Model({suppressInjection: []})
      class TestDefaultMethods extends SapiModelMixin() {
      }

      it('with static defaults', () => {
        expect(TestSuppressedDefaultMethods.getById).toBe(undefined);
        expect(TestDefaultMethods.getById).toBeDefined();
      });

      it('with instance defaults', () => {
        const suppressed = new TestSuppressedDefaultMethods();
        const notSuppressed = new TestDefaultMethods();

        expect(suppressed.save).toBe(undefined);
        expect(notSuppressed.save).toBeDefined();
      });
    });

    describe('properties that are declared as object literals', () => {
      // Integrator note: to persist complex models with deeply embedded objects, the embedded objects
      // must be their own classes.

      @Model({
        dbConfig: {
          collection: 'users',
          db: 'userDb',
          promiscuous: true
        }
      })
      class NestedModel extends SapiModelMixin() {
        @Db()
        contact: {
          firstName: string,
          lastName: string
        };

        ignoreThis: {
          level2: string
        };
      }

      let sapi: SakuraApi;
      beforeEach(async (done) => {
        try {
          sapi = testSapi({
            models: [
              NestedModel
            ]
          });

          await sapi
            .dbConnections
            .connectAll();
          await NestedModel.removeAll({});

          done();
        } catch (err) {
          done.fail(err);
        }
      });

      afterEach(async (done) => {
        try {
          await sapi.close();
          sapi.deregisterDependencies();
          done();
        } catch (err) {
          done.fail(err);
        }
      });

      it('require promiscuous mode', async (done) => {
        try {
          const nested = new NestedModel();

          nested.contact = {
            firstName: 'George',
            lastName: 'Washington'
          };

          nested.ignoreThis = {
            level2: 'test'
          };

          await nested.create();
          const obj = await NestedModel.getById(nested.id);

          expect(obj.id.toString()).toBe(nested.id.toString());
          expect(obj.contact).toBeDefined();
          expect(obj.contact.firstName).toBe(nested.contact.firstName);
          expect(obj.contact.lastName).toBe(nested.contact.lastName);

          done();
        } catch (err) {
          done.fail(err);
        }
      });
    });

    describe('handles object types', () => {
      describe('Date', () => {

        @Model({
          dbConfig: {
            collection: 'dateTest',
            db: 'userDb'
          }
        })
        class ModelDateStoreAndRestoreTest extends SapiModelMixin() {
          @Db() @Json()
          date: Date = new Date();
        }

        let sapi: SakuraApi;
        beforeEach(async (done) => {
          try {
            sapi = testSapi({
              models: [
                ModelDateStoreAndRestoreTest
              ]
            });

            await sapi
              .dbConnections
              .connectAll();

            await ModelDateStoreAndRestoreTest.removeAll({});

            done();
          } catch (err) {
            done.fail(err);
          }
        });

        afterEach(async (done) => {
          try {
            await sapi.close();
            sapi.deregisterDependencies();
            done();
          } catch (err) {
            done.fail(err);
          }
        });

        describe('when going to and from the database', () => {
          it('stores Date types as native MongoDB ISO dates', async (done) => {
            try {
              const model = new ModelDateStoreAndRestoreTest();

              await model.create();

              const result = await ModelDateStoreAndRestoreTest
                .getDb()
                .collection('dateTest')
                .findOne({_id: model.id});

              expect(result.date instanceof Date).toBeTruthy('Should have been a Date');

              done();
            } catch (err) {
              done.fail(err);
            }
          });

          it('retrieves a Date when MongoDB has ISO date field ', async (done) => {
            try {
              const model = new ModelDateStoreAndRestoreTest();

              await model.create();

              const result = await ModelDateStoreAndRestoreTest.getById(model.id);

              expect(result instanceof ModelDateStoreAndRestoreTest).toBeTruthy();
              expect(result.date instanceof Date).toBeTruthy('Should have been a Date');

              done();
            } catch (err) {
              done.fail(err);
            }
          });
        });

        describe('when marshalling to and from json', () => {
          it('.toJson formats date to to Date object', () => {
            const model = new ModelDateStoreAndRestoreTest();
            const json = model.toJson();
            expect(json.date instanceof Date).toBeTruthy('Should have been a Date');
          });

          it('.fromJson formats', () => {
            pending('not implemented, see https://github.com/sakuraapi/api/issues/72');
            const model = ModelDateStoreAndRestoreTest.fromJson({
              date: '2017-05-28T21:58:10.806Z'
            });
          });
        });
      });

      describe('Array', () => {
        @Model({
          dbConfig: {
            collection: 'arrayTest',
            db: 'userDb'
          }
        })
        class ModelArrayStoreAndRestoreTest extends SapiModelMixin() {
          @Db() @Json()
          anArray = ['value1', 'value2'];
        }

        let sapi: SakuraApi;
        beforeEach(async (done) => {
          try {
            sapi = testSapi({
              models: [
                ModelArrayStoreAndRestoreTest
              ]
            });

            await sapi
              .dbConnections
              .connectAll();
            await ModelArrayStoreAndRestoreTest.removeAll({});

            done();
          } catch (err) {
            done.fail(err);
          }
        });

        afterEach(async (done) => {
          try {
            await sapi.close();
            sapi.deregisterDependencies();
            done();
          } catch (err) {
            done.fail(err);
          }
        });

        describe('when going to and from the database', () => {
          it('stores Array types as native MongoDB Arrays', async (done) => {
            try {
              const model = new ModelArrayStoreAndRestoreTest();

              await model.create();

              const result = await ModelArrayStoreAndRestoreTest
                .getDb()
                .collection('arrayTest')
                .findOne({_id: model.id});

              expect(Array.isArray(result.anArray)).toBeTruthy('Should have been an Array');

              done();
            } catch (err) {
              done.fail(err);
            }
          });

          it('retrieves an Array when MongoDB has an Array field', async (done) => {
            try {
              const model = new ModelArrayStoreAndRestoreTest();

              await model.create();
              const result = await ModelArrayStoreAndRestoreTest.getById(model.id);

              expect(result instanceof ModelArrayStoreAndRestoreTest).toBeTruthy();
              expect(Array.isArray(result.anArray)).toBeTruthy('Should have been an Array');

              done();
            } catch (err) {
              done.fail(err);
            }
          });
        });

        describe('when marshalling to and from json', () => {
          it('.toJson formats date to to Date object', () => {
            const model = new ModelArrayStoreAndRestoreTest();
            const json = model.toJson();

            expect(Array.isArray(json.anArray)).toBeTruthy('Should have been an Array');
          });

          it('.fromJson formats', () => {
            const model = ModelArrayStoreAndRestoreTest.fromJson({
              anArray: ['a', 'b']
            });

            expect(Array.isArray(model.anArray)).toBeTruthy('Should have been an array');
          });
        });
      });
    });
  });

  describe('dependency injection', () => {

    @Model()
    class TestDi {
    }

    @Model()
    class TestDiOverride {
    }

    it('decorates @Model class with DI id', () => {
      const test = new TestDi();

      expect(TestDi[modelSymbols.id].split('-').length).toBe(5);

      expect(test[modelSymbols.isSakuraApiModel]).toBe(true);
      expect(TestDi[modelSymbols.isSakuraApiModel]).toBeTruthy();

      expect(() => TestDi[modelSymbols.id] = null).toThrowError(`Cannot assign to read only property ` +
        `'Symbol(GUID id for model DI)' of function '[object Function]'`);
      expect(() => test[modelSymbols.isSakuraApiModel] = false)
        .toThrowError(`Cannot assign to read only property 'Symbol(isSakuraApiModel)' of object '#<TestDi>'`);
    });

    it('can retrieve Model by name', () => {
      const sapi = testSapi({
        models: [TestDi]
      });

      // tslint:disable-next-line:variable-name
      const TestModel = sapi.getModelByName('TestDi');

      expect(TestModel).toBeDefined('Model should have been defined');
      expect(TestModel.fromJson({}) instanceof TestDi).toBeTruthy('Should have been an instance of TestDI ' +
        `but instead was an instsance of ${(TestModel.constructor || {} as any).name || TestModel.name}`);

      sapi.deregisterDependencies();
    });

    it('allows overriding of @Model decorated class', () => {
      const sapi = testSapi({
        models: [{use: TestDiOverride, for: TestDi}]
      });

      // tslint:disable-next-line:variable-name
      const TestModel = sapi.getModel(TestDi);
      const testModel = TestModel.fromJson({});

      expect(TestModel).toBeDefined('Model should have been defined');
      expect(testModel instanceof TestDiOverride).toBeTruthy('Should have been an instance of ' +
        `TestDIModelOverride but instead was an instsance of ` +
        `${(testModel.constructor || {} as any).name || testModel.name}`);

      sapi.deregisterDependencies();
    });

    it('does not allow non @Injectable constructor args', () => {
      class NotInjectable {
      }

      @Injectable()
      class BrokenInjectable {
        constructor() {
        }
      }

      let sapi: SakuraApi;
      expect(() => {
        @Model()
        class TestModel {
          constructor(t: NotInjectable) {
          }
        }

        sapi = testSapi({
          models: [TestModel],
          providers: [BrokenInjectable]
        });

        const T = sapi.getModel(TestModel); // tslint:disable-line
        new T(); // tslint:disable-line

      }).toThrowError(NonInjectableConstructorParameterError);

      sapi.deregisterDependencies();
    });

    describe('sapi injected', () => {

      @Model()
      class TestSapiInjection extends SapiModelMixin() {
      }

      let sapi;
      beforeEach(() => {
        sapi = testSapi({
          models: [TestSapiInjection]
        });
      });

      afterEach(() => {
        sapi.deregisterDependencies();
      });

      it('model has reference to sapi injected as symbol when SakuraApi is constructed', () => {
        const sapiRef = TestSapiInjection[modelSymbols.sapi];

        expect(sapiRef).toBeDefined();
        expect(sapiRef instanceof SakuraApi).toBe(true, 'Should have been an instance of SakuraApi'
          + ` but was an instance of ${sapiRef.name || (sapiRef.constructor || {} as any).name} instead`);
      });

      it('model has reference to sapi injected as symbol when SakuraApi is constructed', () => {
        const sapiRef = TestSapiInjection.sapi;

        expect(sapiRef).toBeDefined();
        expect(sapiRef instanceof SakuraApi).toBe(true, 'Should have been an instance of SakuraApi'
          + ` but was an instance of ${(sapiRef as any).name || (sapiRef.constructor || {} as any).name} instead`);
      });

      it('model injects sapiConfig to make it easier to get access to sapiConfig', () => {
        expect(TestSapiInjection.sapiConfig).toBeDefined();
        expect(TestSapiInjection.sapiConfig.SAKURA_API_CONFIG_TEST).toBe('found');
      });
    });

    describe('SakuraApi.getModel', () => {
      it('does not allow non @Model parameter in sapi.getModel', () => {
        class TestClass {
        }

        const sapi = testSapi({});

        expect(() => sapi.getModel({})).toThrowError(ModelsMustBeDecoratedWithModelError);
        expect(() => sapi.getModel(TestClass)).toThrowError(ModelsMustBeDecoratedWithModelError);
        expect(() => sapi.getModel('')).toThrowError(ModelsMustBeDecoratedWithModelError);
        expect(() => sapi.getModel(1)).toThrowError(ModelsMustBeDecoratedWithModelError);
        expect(() => sapi.getModel(null)).toThrowError(ModelsMustBeDecoratedWithModelError);
        expect(() => sapi.getModel(undefined)).toThrowError(ModelsMustBeDecoratedWithModelError);
      });

      it('throws ModelNotRegistered when attempting to get unregistered model', () => {
        @Model()
        class Invalid {
        }

        const sapi = testSapi({});

        expect(() => sapi.getModel(Invalid)).toThrowError(ModelNotRegistered);
      });

      it('gets a model', () => {
        @Model()
        class TestModel {
        }

        const sapi2 = testSapi({
          models: [TestModel]
        });

        const result = sapi2.getModel(TestModel);

        expect(result.constructor).toEqual(TestModel.constructor);

        sapi2.deregisterDependencies();
      });
    });
  });
});
