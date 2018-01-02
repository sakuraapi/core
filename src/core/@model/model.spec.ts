import {InsertOneWriteOpResult, ObjectID, ReplaceOneOptions, UpdateWriteOpResult} from 'mongodb';
import {testSapi} from '../../../spec/helpers/sakuraapi';
import {SakuraApi} from '../sakura-api';
import {Db, Json, Model, modelSymbols} from './';
import {SapiDbForModelNotFound, SapiMissingIdErr} from './errors';
import {SapiModelMixin} from './sapi-model-mixin';

describe('core/@Model', () => {

  @Model()
  class Test extends SapiModelMixin() {

    isCustom = false;

    constructor() {
      super();
      this.save = this.saveOverride;
    }

    // https://github.com/Microsoft/TypeScript/issues/14439
    saveOverride(set?: { [key: string]: any } | null, options?: ReplaceOneOptions): Promise<UpdateWriteOpResult> {
      return Promise
        .resolve({
          result: {
            n: -1,
            nModified: -1,
            ok: 1
          }
        } as any);
    }
  }

  (Test as any).getById = async (id: string, project?: any): Promise<Test> => {
    const test = new Test();
    test.isCustom = true;
    return test;
  };

  describe('construction', () => {

    let test = null;
    beforeEach(() => {
      test = new Test();
    });

    it('maintains the prototype chain', () => {
      expect(test instanceof Test).toBe(true);
    });

    it(`decorates itself with Symbol('sakuraApiModel') = true`, () => {
      expect(test[modelSymbols.isSakuraApiModel]).toBe(true);
      expect(() => test[modelSymbols.isSakuraApiModel] = false)
        .toThrowError(`Cannot assign to read only property 'Symbol(isSakuraApiModel)' of object '#<Test>'`);
    });

    it('maps _id to id without contaminating the object properties with the id accessor', () => {
      test.id = new ObjectID();

      expect(test._id).toEqual(test.id);
      expect(test.id).toEqual(test.id);

      const json = JSON.parse(JSON.stringify(test));
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
        expect(() => {
          new TestDbConfig(); // tslint:disable-line
        }).toThrow();
      });

      it('throws when dbConfig.collection is missing', () => {
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

    describe('injects default CRUD method', () => {

      const dbConfig = {
        collection: 'users',
        db: 'userDb',
        promiscuous: true
      };

      @Model({
        dbConfig
      })
      class TestDefaultMethods extends SapiModelMixin() {
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

      let sapi = null;
      let testDefaultMethods = null;
      let testDefaultMethods2 = null;
      beforeEach(() => {
        sapi = testSapi({
          models: [
            TestDefaultMethods,
            // ChastityTest,
            TestBadDb
          ],
          routables: []
        });

        testDefaultMethods = new TestDefaultMethods();
        testDefaultMethods2 = new TestDefaultMethods();
      });

      describe('when CRUD not provided by integrator', () => {

        beforeEach((done) => {
          sapi
            .dbConnections
            .connectAll()
            .then(done)
            .catch(done.fail);
        });

        describe('static method', () => {

          /**
           * See json.spec.ts for toJson and fromJson tests.
           * See db.spec.ts for toDb and fromDb tests.
           */

          it('removeAll', (done) => {
            expect(testDefaultMethods.id).toBeNull();

            testDefaultMethods
              .create()
              .then((createdResult) => {
                expect(createdResult.insertedCount).toBe(1);

                testDefaultMethods2
                  .create()
                  .then((createResult) => {
                    expect(createResult.insertedCount).toBe(1);

                    TestDefaultMethods
                      .removeAll({
                        $or: [{_id: testDefaultMethods.id}, {_id: testDefaultMethods2.id}]
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

          it('removeById', (done) => {
            expect(testDefaultMethods.id).toBeNull();

            testDefaultMethods
              .create()
              .then((createResult) => {
                expect(createResult.insertedCount).toBe(1);

                testDefaultMethods2
                  .create()
                  .then((createResult2) => {
                    expect(createResult2.insertedCount).toBe(1);

                    TestDefaultMethods
                      .removeById(testDefaultMethods.id)
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

          describe('getCollection', () => {
            it('returns a valid MongoDB Collection for the current model', () => {
              const col = TestDefaultMethods.getCollection();
              expect((col as any).s.dbName).toBe('userDb');
            });
          });

          describe('getDb', () => {
            it('returns a valid MongoDB Db for the current model', () => {
              const db = TestDefaultMethods.getDb();
              expect((db as any).s.databaseName).toBe('userDb');
            });

            it('throws SapiDbForModelNotFound when db is not found', (done) => {
              try {
                TestBadDb.getDb();
                done.fail('Error was expected but not thrown');
              } catch (err) {
                expect(err instanceof SapiDbForModelNotFound).toBeTruthy();
                done();
              }

            });
          });

          it('get', (done) => {

            expect(testDefaultMethods.id).toBeNull();

            testDefaultMethods
              .create()
              .then((createdResult) => {
                expect(createdResult.insertedCount).toBe(1);

                TestDefaultMethods
                  .get({filter: {_id: testDefaultMethods.id}})
                  .then((results) => {
                    expect(results.length).toBe(1);
                    expect(results[0]._id.toString()).toBe(testDefaultMethods.id.toString());
                    expect(results[0].firstName).toBe(testDefaultMethods.firstName);
                    expect(results[0].lastName).toBe(testDefaultMethods.lastName);
                    done();
                  })
                  .catch(done.fail);
              })
              .catch(done.fail);
          });

          it('getOne', (done) => {
            expect(testDefaultMethods.id).toBeNull();

            testDefaultMethods
              .create()
              .then((createdResult) => {
                expect(createdResult.insertedCount).toBe(1);

                TestDefaultMethods
                  .getOne({_id: testDefaultMethods.id})
                  .then((result) => {
                    expect(result._id.toString()).toBe(testDefaultMethods.id.toString());
                    expect(result.firstName).toBe(testDefaultMethods.firstName);
                    expect(result.lastName).toBe(testDefaultMethods.lastName);
                    done();
                  })
                  .catch(done.fail);
              })
              .catch(done.fail);
          });

          it('getById', (done) => {
            expect(testDefaultMethods.id).toBeNull();

            testDefaultMethods
              .create()
              .then((createdResult) => {
                expect(createdResult.insertedCount).toBe(1);

                TestDefaultMethods
                  .getById(testDefaultMethods.id)
                  .then((result) => {
                    expect(result._id.toString()).toBe(testDefaultMethods.id.toString());
                    expect(result.firstName).toBe(testDefaultMethods.firstName);
                    expect(result.lastName).toBe(testDefaultMethods.lastName);
                    done();
                  })
                  .catch(done.fail);
              })
              .catch(done.fail);
          });

          it('getCursor', (done) => {
            expect(testDefaultMethods.id).toBeNull();

            testDefaultMethods
              .create()
              .then((createdResult) => {
                expect(createdResult.insertedCount).toBe(1);

                TestDefaultMethods
                  .getCursor({_id: testDefaultMethods.id})
                  .toArray()
                  .then((results) => {
                    expect(results.length).toBe(1);
                    expect(results[0]._id.toString()).toBe(testDefaultMethods.id.toString());

                    expect(results[0].fn).toBeDefined();
                    expect(results[0].lastName).toBeDefined();

                    expect(results[0].fn).toBe(testDefaultMethods.firstName);
                    expect(results[0].lastName).toBe(testDefaultMethods.lastName);
                    done();
                  })
                  .catch(done.fail);

              })
              .catch(done.fail);
          });

          it('getCursor supports projection', (done) => {
            expect(testDefaultMethods.id).toBeNull();

            testDefaultMethods
              .create()
              .then((createResults: InsertOneWriteOpResult) => {
                expect(createResults.insertedCount).toBe(1);

                TestDefaultMethods
                  .getCursor(testDefaultMethods.id, {_id: 1})
                  .next()
                  .then((result) => {
                    expect(result.firstName).toBeUndefined();
                    expect(result.lastName).toBeUndefined();
                    expect(result._id.toString()).toBe(testDefaultMethods.id.toString());
                    done();
                  });
              })
              .catch(done.fail);
          });

          it('getCursorById', (done) => {
            expect(testDefaultMethods.id).toBeNull();

            testDefaultMethods
              .create()
              .then((createdResult) => {
                expect(createdResult.insertedCount).toBe(1);

                TestDefaultMethods
                  .getCursorById(testDefaultMethods.id)
                  .next()
                  .then((result) => {
                    expect(result._id.toString()).toBe(testDefaultMethods.id.toString());

                    expect(result.fn).toBeDefined();
                    expect(result.lastName).toBeDefined();

                    expect(result.fn).toBe(testDefaultMethods.firstName);
                    expect(result.lastName).toBe(testDefaultMethods.lastName);
                    done();
                  })
                  .catch(done.fail);

              })
              .catch(done.fail);

          });

        });

        describe('instance method', () => {

          describe('create', () => {
            it('inserts model into db', (done) => {
              testDefaultMethods.id = new ObjectID();

              testDefaultMethods
                .create()
                .then((result) => {
                  expect(result.insertedCount).toBe(1);

                  testDefaultMethods
                    .getCollection()
                    .find({_id: testDefaultMethods.id})
                    .limit(1)
                    .next()
                    .then((result2) => {
                      expect(result2._id.toString()).toBe(testDefaultMethods.id.toString());

                      expect(result2.fn).toBeDefined();
                      expect(result2.lastName).toBeDefined();

                      expect(result2.fn).toBe(testDefaultMethods.firstName);
                      expect(result2.lastName).toBe(testDefaultMethods.lastName);
                      done();
                    })
                    .catch(done.fail);
                })
                .catch((err) => {
                  done.fail(err);
                });
            });

            it('sets the models Id before writing if Id is not set', (done) => {
              expect(testDefaultMethods.id).toBeNull();

              testDefaultMethods
                .create()
                .then((result) => {
                  expect(result.insertedCount).toBe(1);

                  testDefaultMethods
                    .getCollection()
                    .find({_id: testDefaultMethods.id})
                    .limit(1)
                    .next()
                    .then((result2) => {
                      expect(result2._id.toString()).toBe(testDefaultMethods.id.toString());

                      expect(result2.fn).toBeDefined();
                      expect(result2.lastName).toBeDefined();

                      expect(result2.fn).toBe(testDefaultMethods.firstName);
                      expect(result2.lastName).toBe(testDefaultMethods.lastName);
                      done();
                    })
                    .catch(done.fail);
                });
            });

            it('persists deeply nested objects', (done) => {

              class Contact {
                @Db()
                phone = '000-000-0000';
              }

              @Model({
                dbConfig: {
                  collection: 'userCreateTest',
                  db: 'userDb'
                }
              })
              class UserCreateTest extends SapiModelMixin() {
                @Db()
                firstName = 'George';
                @Db()
                lastName = 'Washington';

                @Db({model: Contact})
                contact = new Contact();
              }

              sapi = testSapi({
                models: [UserCreateTest],
                routables: []
              });

              sapi
                .listen({bootMessage: ''})
                .then(() => {
                  const user = new UserCreateTest();

                  return user
                    .create()
                    .then(() => user.getCollection().find({_id: user.id}).limit(1).next())
                    .then((result: any) => {
                      expect(result._id.toString()).toBe(user.id.toString());
                      expect(result.firstName).toBe(user.firstName || 'firstName should have been defined');
                      expect(result.lastName).toBe(user.lastName || 'lastName should have been defined');
                      expect(result.contact).toBeDefined();
                      expect(result.contact.phone).toBe('000-000-0000');
                    });

                })
                .then(() => sapi.close())
                .then(done)
                .catch(done.fail);
            });
          });

          describe('getCollection', () => {
            it('returns a valid MongoDB Collection for the current model', () => {
              const col = testDefaultMethods.getCollection();
              expect(col.s.dbName).toBe('userDb');
            });
          });

          describe('getDb', () => {
            it('returns a valid MongoDB Db for the current model', () => {
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

          describe('save', () => {

            @Model()
            class ChildChild {
              cVal = 'childChild';
            }

            @Model()
            class Child {
              cVal = 'child';

              @Db({model: ChildChild}) @Json()
              childChild = new ChildChild();
            }

            @Model({dbConfig})
            class TestParent extends SapiModelMixin() {
              @Db() @Json()
              pVal = 'parent';

              @Db({model: Child}) @Json()
              child: Child = new Child();

              @Db({model: Child}) @Json()
              child2: Child = new Child();
            }

            it('rejects if missing id', async (done) => {
              try {
                await testDefaultMethods.save();
                done.fail(new Error('Expected exception'));
              } catch (err) {
                expect(err).toEqual(jasmine.any(SapiMissingIdErr));
                expect(err.target).toEqual(testDefaultMethods);
                done();
              }
            });

            describe('without projection', () => {
              it('updates entire model if no set parameter is passed', async (done) => {

                expect(testDefaultMethods.id).toBeNull();
                try {
                  const createResult = await testDefaultMethods
                    .create();

                  expect(createResult.insertedCount).toBe(1);
                  expect(testDefaultMethods.id).toBeTruthy();

                  const changes = {
                    firstName: 'updatedFirstName',
                    lastName: 'updatedLastName'
                  };

                  testDefaultMethods.firstName = changes.firstName;
                  testDefaultMethods.lastName = changes.lastName;

                  const result: UpdateWriteOpResult = await testDefaultMethods
                    .save();

                  expect(result.modifiedCount).toBe(1);

                  const updated = await testDefaultMethods
                    .getCollection()
                    .find({_id: testDefaultMethods.id})
                    .limit(1)
                    .next();

                  expect(updated.fn).toBeDefined();
                  expect(updated.lastName).toBeDefined();

                  expect(updated.fn).toBe(changes.firstName);
                  expect(updated.lastName).toBe(changes.lastName);
                  done();

                } catch (err) {
                  done.fail(err);
                }
              });

              it('saves sub documents, issue #98', async (done) => {

                const tsapi = testSapi({
                  models: [
                    Child,
                    ChildChild,
                    TestParent
                  ]
                });

                try {

                  await tsapi.listen({bootMessage: ''});
                  await TestParent.removeAll({});

                  const createResult = await TestParent.fromJson({}).create();
                  let testParent = await TestParent.getById(createResult.insertedId);

                  expect(testParent).toBeDefined();
                  expect(testParent.pVal).toBe('parent');
                  expect(testParent.child).toBeDefined();
                  expect(testParent.child.cVal).toBe('child');
                  expect(testParent.child.childChild).toBeDefined();
                  expect(testParent.child.childChild.cVal).toBe('childChild');

                  testParent.pVal = 'parentUpdate';
                  testParent.child.cVal = 'childUpdate';
                  testParent.child.childChild.cVal = 'childChildUpdate';

                  await testParent.save();
                  testParent = await TestParent.getById(createResult.insertedId);

                  expect(testParent).toBeDefined();
                  expect(testParent.id.toHexString()).toBe(createResult.insertedId.toHexString());
                  expect(testParent.pVal).toBe('parentUpdate');
                  expect(testParent.child).toBeDefined();
                  expect(testParent.child.cVal).toBe('childUpdate');
                  expect(testParent.child.childChild).toBeDefined();
                  expect(testParent.child.childChild.cVal).toBe('childChildUpdate');

                  done();
                } catch (err) {
                  done.fail(err);
                } finally {
                  await tsapi.close();
                }
              });

              it('does not add id/_id to sub documents, issue #106', async (done) => {

                const tsapi = testSapi({
                  models: [
                    Child,
                    ChildChild,
                    TestParent
                  ]
                });

                try {
                  await tsapi.listen({bootMessage: ''});
                  await TestParent.removeAll({});

                  const createResult = await TestParent.fromJson({}).create();
                  let testParent = await TestParent.getById(createResult.insertedId);

                  expect(testParent._id.toHexString()).toBe(createResult.insertedId.toHexString());
                  expect(testParent.id.toHexString()).toBe(createResult.insertedId.toHexString());

                  expect((testParent.child as any)._id).toBeUndefined();
                  expect((testParent.child as any).id).toBeUndefined();
                  expect((testParent.child.childChild as any)._id).toBeUndefined();
                  expect((testParent.child.childChild as any).id).toBeUndefined();

                  expect((testParent.child2 as any)._id).toBeUndefined();
                  expect((testParent.child2 as any).id).toBeUndefined();
                  expect((testParent.child2.childChild as any)._id).toBeUndefined();
                  expect((testParent.child2.childChild as any).id).toBeUndefined();

                  await testParent.save();
                  testParent = await TestParent.getById(createResult.insertedId);

                  expect(testParent._id.toHexString()).toBe(createResult.insertedId.toHexString());
                  expect(testParent.id.toHexString()).toBe(createResult.insertedId.toHexString());

                  expect((testParent.child as any)._id).toBeUndefined();
                  expect((testParent.child as any).id).toBeUndefined();
                  expect((testParent.child.childChild as any)._id).toBeUndefined();
                  expect((testParent.child.childChild as any).id).toBeUndefined();

                  expect((testParent.child2 as any)._id).toBeUndefined();
                  expect((testParent.child2 as any).id).toBeUndefined();
                  expect((testParent.child2.childChild as any)._id).toBeUndefined();
                  expect((testParent.child2.childChild as any).id).toBeUndefined();

                  done();
                } catch (err) {
                  done.fail(err);
                } finally {
                  await tsapi.close();
                }
              });

              it('does allow explicit id/_id in sub documents, issue #106', async (done) => {

                const tsapi = testSapi({
                  models: [
                    Child,
                    ChildChild,
                    TestParent
                  ]
                });

                try {
                  await tsapi.listen({bootMessage: ''});
                  await TestParent.removeAll({});

                  let testParent = await TestParent.fromJson({});
                  (testParent.child as any).id = 'here';
                  const createResult = await testParent.create();
                  testParent = await TestParent.getById(createResult.insertedId);

                  expect(testParent._id.toHexString()).toBe(createResult.insertedId.toHexString());
                  expect(testParent.id.toHexString()).toBe(createResult.insertedId.toHexString());

                  expect((testParent.child as any)._id).toBe('here');
                  expect((testParent.child as any).id).toBe('here');

                  // make sure that id & _id aren't both saved, just _id
                  let raw = await TestParent
                    .getDb()
                    .collection('users')
                    .findOne({});

                  expect(raw.child.id).toBeUndefined();
                  expect(raw.child._id).toBeDefined();

                  await testParent.save();
                  testParent = await TestParent.getById(createResult.insertedId);

                  expect(testParent._id.toHexString()).toBe(createResult.insertedId.toHexString());
                  expect(testParent.id.toHexString()).toBe(createResult.insertedId.toHexString());

                  expect((testParent.child as any)._id).toBe('here');
                  expect((testParent.child as any).id).toBe('here');

                  // make sure that id & _id aren't both saved, just _id
                  raw = await TestParent
                    .getDb()
                    .collection('users')
                    .findOne({});

                  expect(raw.child.id).toBeUndefined();
                  expect(raw.child._id).toBeDefined();

                  done();
                } catch (err) {
                  done.fail(err);
                } finally {
                  await tsapi.close();
                }
              });
            });

            describe('with projection', () => {
              @Model({
                dbConfig: {
                  collection: 'users',
                  db: 'userDb',
                  promiscuous: true
                }
              })
              class PartialUpdateTest extends SapiModelMixin() {
                @Db('fn')
                firstName = 'George';

                lastName = 'Washington';

                @Db({field: 'pw', private: true})
                password = '';
              }

              const sapi2 = testSapi({
                models: [
                  Child,
                  ChildChild,
                  PartialUpdateTest,
                  TestParent
                ],
                routables: []
              });

              beforeEach((done) => {
                sapi2
                  .listen({bootMessage: ''})
                  .then(done)
                  .catch(done.fail);
              });

              afterEach((done) => {
                sapi2
                  .close()
                  .then(done)
                  .catch(done.fail);
              });

              it('sets the proper database level fields', async (done) => {
                const pud = new PartialUpdateTest();

                const updateSet = {
                  fn: 'updated'
                };

                try {
                  const createResult = await pud.create();

                  expect(createResult.insertedCount).toBe(1);
                  expect(pud.id).toBeTruthy();

                  const result: UpdateWriteOpResult = await pud.save(updateSet);

                  expect(result.modifiedCount).toBe(1);
                  expect(pud.firstName).toBe(updateSet.fn);

                  const updated = await pud
                    .getCollection()
                    .find({_id: pud.id})
                    .limit(1)
                    .next();

                  expect(updated._id instanceof ObjectID || updated._id.constructor.name === 'ObjectID')
                    .toBe(true);
                  expect(updated.fn).toBeDefined();
                  expect(updated.fn).toBe(updateSet.fn);

                  done();
                } catch (err) {
                  done.fail();
                }
              });

              it('performs a partial update without disturbing other fields', async (done) => {
                const pud = new PartialUpdateTest();
                pud.password = 'test-password';

                const data = {
                  firstName: 'Georgio',
                  lastName: 'Washington'
                };

                try {
                  await pud.create();

                  const body = JSON.parse(JSON.stringify(data));
                  body.id = pud.id.toString();

                  await PartialUpdateTest
                    .fromJson(body)
                    .save(body);

                  const result = await PartialUpdateTest
                    .getById(pud.id);

                  expect(result._id instanceof ObjectID).toBe(true);
                  expect(result._id.toString()).toBe(pud.id.toString());
                  expect(result.firstName).toBe(data.firstName);
                  expect(result.lastName).toBe(data.lastName);
                  expect(result.password).toBe(pud.password);

                  done();
                } catch (err) {
                  done.fail(err);
                }
              });

              it('saves sub documents, issue #98', async (done) => {

                try {

                  await sapi2.listen({bootMessage: ''});
                  await TestParent.removeAll({});

                  let testParent = await TestParent.fromJson({});
                  testParent.child2.childChild.cVal = 'updated';
                  const createResult = await testParent.create();
                  testParent = await TestParent.getById(createResult.insertedId);

                  expect(testParent).toBeDefined();
                  expect(testParent.pVal).toBe('parent');
                  expect(testParent.child).toBeDefined();
                  expect(testParent.child.cVal).toBe('child');
                  expect(testParent.child.childChild).toBeDefined();
                  expect(testParent.child.childChild.cVal).toBe('childChild');
                  expect(testParent.child2).toBeDefined();
                  expect(testParent.child2.cVal).toBe('child');
                  expect(testParent.child2.childChild).toBeDefined();
                  expect(testParent.child2.childChild.cVal).toBe('updated');

                  // setting a sub document overwrites all sub documents
                  await testParent.save({pVal: 'parentUpdateSet'});
                  testParent = await TestParent.getById(createResult.insertedId);

                  expect(testParent).toBeDefined();
                  expect(testParent.id.toHexString()).toBe(createResult.insertedId.toHexString());
                  expect(testParent.pVal).toBe('parentUpdateSet');
                  expect(testParent.child).toBeDefined();
                  expect(testParent.child.cVal).toBe('child');
                  expect(testParent.child.childChild).toBeDefined();
                  expect(testParent.child.childChild.cVal).toBe('childChild');
                  expect(testParent.child2).toBeDefined();
                  expect(testParent.child2.cVal).toBe('child');
                  expect(testParent.child2.childChild).toBeDefined();
                  expect(testParent.child2.childChild.cVal).toBe('updated');

                  await testParent.save({child: {cVal: 'childSet'}});
                  testParent = await TestParent.getById(createResult.insertedId);

                  expect(testParent).toBeDefined();
                  expect(testParent.id.toHexString()).toBe(createResult.insertedId.toHexString());
                  expect(testParent.pVal).toBe('parentUpdateSet');
                  expect(testParent.child).toBeDefined();
                  expect(testParent.child.cVal).toBe('childSet');
                  expect(testParent.child.childChild).toBeDefined();
                  expect(testParent.child.childChild.cVal).toBe('childChild');
                  expect(testParent.child2).toBeDefined();
                  expect(testParent.child2.cVal).toBe('child');
                  expect(testParent.child2.childChild).toBeDefined();
                  expect(testParent.child2.childChild.cVal).toBe('updated');

                  done();
                } catch (err) {
                  done.fail(err);
                }
              });

            });

          });
        });

        describe('remove', () => {
          it('itself', (done) => {
            expect(testDefaultMethods.id).toBeNull();

            testDefaultMethods
              .create()
              .then((createResult) => {
                expect(createResult.insertedCount).toBe(1);

                testDefaultMethods2
                  .create()
                  .then((createResult2) => {
                    expect(createResult2.insertedCount).toBe(1);
                    testDefaultMethods
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

    describe('but does not overwrite custom methods added by integrator', () => {
      it('static methods getById', (done) => {
        Test
          .getById('123')
          .then((result) => {
            expect(result.isCustom).toBe(true);
            done();
          })
          .catch(done.fail);
      });

      it('static methods save', (done) => {
        test
          .save()
          .then((op) => {
            expect(op.result.nModified).toBe(-1);
            done();
          })
          .catch(done.fail);
      });
    });

    describe('allows integrator to exclude CRUD with suppressInjection: [] in ModelOptions', () => {
      @Model({suppressInjection: ['get', 'save']})
      class TestSuppressedDefaultMethods extends SapiModelMixin() {
      }

      beforeEach(() => {
        this.suppressed = new TestSuppressedDefaultMethods();
      });

      it('with static defaults', () => {
        expect(this.suppressed.get).toBe(undefined);
      });

      it('with instance defaults', () => {
        expect(this.suppressed.save).toBe(undefined);
      });
    });

    describe('properties that are declared as object literals', () => {
      // Integrator note: to persist complex models with deeply embedded objects, the embedded objects
      // should be their own classes.

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

      beforeEach((done) => {
        const sapi = testSapi({
          models: [
            NestedModel
          ],
          routables: []
        });

        sapi
          .dbConnections
          .connectAll()
          .then(() => NestedModel.removeAll({}))
          .then(done)
          .catch(done.fail);
      });

      it('require promiscuous mode', (done) => {
        const nested = new NestedModel();

        nested.contact = {
          firstName: 'George',
          lastName: 'Washington'
        };

        nested.ignoreThis = {
          level2: 'test'
        };

        nested
          .create()
          .then(() => {

            const x = NestedModel.getById(nested.id);

            return x;
          })
          .then((obj) => {
            expect(obj.id.toString()).toBe(nested.id.toString());
            expect(obj.contact).toBeDefined();
            expect(obj.contact.firstName).toBe(nested.contact.firstName);
            expect(obj.contact.lastName).toBe(nested.contact.lastName);
          })
          .then(done)
          .catch(done.fail);

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

        beforeEach((done) => {
          const sapi = testSapi({
            models: [
              ModelDateStoreAndRestoreTest
            ],
            routables: []
          });

          sapi
            .dbConnections
            .connectAll()
            .then(() => ModelDateStoreAndRestoreTest.removeAll({}))
            .then(done)
            .catch(done.fail);
        });

        describe('when going to and from the database', () => {
          it('stores Date types as native MongoDB ISO dates', (done) => {
            const model = new ModelDateStoreAndRestoreTest();

            model
              .create()
              .then(() => {
                ModelDateStoreAndRestoreTest
                  .getDb()
                  .collection('dateTest')
                  .findOne({_id: model.id})
                  .then((result) => {
                    expect(result.date instanceof Date).toBeTruthy('Should have been a Date');
                  })
                  .then(done)
                  .catch(done.fail);
              });
          });

          it('retrieves a Date when MongoDB has ISO date field ', (done) => {
            const model = new ModelDateStoreAndRestoreTest();

            model
              .create()
              .then(() => {
                ModelDateStoreAndRestoreTest
                  .getById(model.id)
                  .then((result) => {
                    expect(result instanceof ModelDateStoreAndRestoreTest).toBeTruthy();
                    expect(result.date instanceof Date).toBeTruthy('Should have been a Date');
                  })
                  .then(done)
                  .catch(done.fail);
              });
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

        beforeEach((done) => {
          const sapi = testSapi({
            models: [
              ModelArrayStoreAndRestoreTest
            ],
            routables: []
          });

          sapi
            .dbConnections
            .connectAll()
            .then(() => ModelArrayStoreAndRestoreTest.removeAll({}))
            .then(done)
            .catch(done.fail);
        });

        describe('when going to and from the database', () => {
          it('stores Array types as native MongoDB Arrays', (done) => {
            const model = new ModelArrayStoreAndRestoreTest();

            model
              .create()
              .then(() => {
                ModelArrayStoreAndRestoreTest
                  .getDb()
                  .collection('arrayTest')
                  .findOne({_id: model.id})
                  .then((result) => {
                    expect(Array.isArray(result.anArray)).toBeTruthy('Should have been an Array');
                  })
                  .then(done)
                  .catch(done.fail);
              });
          });

          it('retrieves an Array when MongoDB has an Array field', (done) => {
            const model = new ModelArrayStoreAndRestoreTest();

            model
              .create()
              .then(() => {
                ModelArrayStoreAndRestoreTest
                  .getById(model.id)
                  .then((result) => {
                    expect(result instanceof ModelArrayStoreAndRestoreTest).toBeTruthy();
                    expect(Array.isArray(result.anArray)).toBeTruthy('Should have been an Array');
                  })
                  .then(done)
                  .catch(done.fail);
              });

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

    describe('sapi injected', () => {

      @Model()
      class TestSapiInjection extends SapiModelMixin() {
      }

      let sapi;
      beforeEach(() => {
        sapi = testSapi({
          models: [TestSapiInjection],
          routables: []
        });
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
  });
});
