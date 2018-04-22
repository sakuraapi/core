import {
  ObjectID,
  UpdateWriteOpResult
} from 'mongodb';
import { testSapi } from '../../../../spec/helpers/sakuraapi';
import { SakuraApi } from '../../sakura-api';
import {
  BeforeSave,
  OnBeforeSave
} from '../before-save';
import { SapiMissingIdErr } from '../errors';
import {
  Db,
  Json,
  Model
} from '../index';
import { SapiModelMixin } from '../sapi-model-mixin';

describe('Model.save', () => {

  const dbConfig = {
    collection: 'users',
    db: 'userDb',
    promiscuous: true
  };
  let beforeSave1Hook: OnBeforeSave;
  let beforeSave2Hook: OnBeforeSave;
  let beforeSave3Hook: OnBeforeSave;
  let sapi: SakuraApi;

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

  @Model({
    dbConfig
  })
  class TestSave extends SapiModelMixin() {
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

    @BeforeSave()
    beforeSave1(model: TestSave, context: string): Promise<void> {
      return (beforeSave1Hook) ? beforeSave1Hook(model, context) : Promise.resolve();
    }

    @BeforeSave('*')
    beforeSave2(model: TestSave, context: string): Promise<void> {
      return (beforeSave2Hook) ? beforeSave2Hook(model, context) : Promise.resolve();
    }

    @BeforeSave('test')
    beforeSave3(model: TestSave, context: string): Promise<void> {
      return (beforeSave3Hook) ? beforeSave3Hook(model, context) : Promise.resolve();
    }
  }

  beforeEach(async (done) => {
    try {
      sapi = testSapi({
        models: [TestSave]
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
      await TestSave.removeAll({});
      await sapi.close();

      sapi.deregisterDependencies();
      sapi = null;
      beforeSave1Hook = null;
      beforeSave2Hook = null;
      beforeSave3Hook = null;

      done();
    } catch (err) {
      done.fail(err);
    }
  });

  it('rejects if missing id (_id)', async (done) => {
    const testDefaultMethods = new (sapi.getModel(TestSave))();

    try {
      await testDefaultMethods.save();
      done.fail(new Error('Expected exception'));
    } catch (err) {
      expect(err instanceof SapiMissingIdErr)
        .toBeTruthy('Should have been instance of SapiMissingIdErr');
      expect(err.target).toEqual(testDefaultMethods);
      done();
    }
  });

  describe('without projection', () => {
    it('updates entire model if no set parameter is passed', async (done) => {
      const testDefaultMethods = new (sapi.getModel(TestSave))();

      expect(testDefaultMethods.id).toBeNull();
      try {
        const createResult = await testDefaultMethods.create();

        expect(createResult.insertedCount).toBe(1);
        expect(testDefaultMethods.id).toBeTruthy();

        const changes = {
          firstName: 'updatedFirstName',
          lastName: 'updatedLastName'
        };

        testDefaultMethods.firstName = changes.firstName;
        testDefaultMethods.lastName = changes.lastName;

        const result: UpdateWriteOpResult = await testDefaultMethods.save();

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

      const sapi2 = testSapi({
        models: [
          Child,
          ChildChild,
          TestParent
        ]
      });

      try {

        await sapi2.listen({bootMessage: ''});
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
        await sapi2.close();
        sapi2.deregisterDependencies();
        await sapi2.close();
      }
    });

    it('does not add id/_id to sub documents, issue #106', async (done) => {

      const sapi2 = testSapi({
        models: [
          Child,
          ChildChild,
          TestParent
        ]
      });

      try {
        await sapi2.listen({bootMessage: ''});
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
        await sapi2.close();
        sapi2.deregisterDependencies();
        await sapi2.close();
      }
    });

    it('does allow explicit id/_id in sub documents, issue #106', async (done) => {

      const sapi2 = testSapi({
        models: [
          Child,
          ChildChild,
          TestParent
        ]
      });

      try {
        await sapi2.listen({bootMessage: ''});
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
        await sapi2.close();
        sapi2.deregisterDependencies();
        await sapi2.close();
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

    let sapi2: SakuraApi;
    beforeEach((done) => {
      sapi2 = testSapi({
        models: [
          Child,
          ChildChild,
          PartialUpdateTest,
          TestParent
        ],
        routables: []
      });

      sapi2
        .listen({bootMessage: ''})
        .then(done)
        .catch(done.fail);
    });

    afterEach(async (done) => {
      try {
        await sapi2.close();
        sapi2.deregisterDependencies();
        done();
      } catch (err) {
        done.fail(err);
      }
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
          .find<any>({_id: pud.id})
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

  describe('@BeforeSave', () => {

    it('gets called when a model is saved', async (done) => {
      let model1;
      let model2;
      let context1;
      let context2;

      try {
        beforeSave1Hook = (model: TestSave, context: string): Promise<void> => {
          model1 = model;
          context1 = context;
          return Promise.resolve();
        };

        beforeSave2Hook = (model: TestSave, context: string): Promise<void> => {
          model2 = model;
          context2 = context;
          return Promise.resolve();
        };

        const test = TestSave.fromJson({});
        await test.create();
        await test.save();

        expect(model1 instanceof TestSave).toBeTruthy();
        expect(context1).toBe('default');
        expect(model2 instanceof TestSave).toBeTruthy();
        expect(context2).toBe('*');

        done();
      } catch (err) {
        done.fail(err);
      }
    });

    it('modified model properties are persisted', async (done) => {

      try {
        beforeSave1Hook = (model: TestSave, context: string): Promise<void> => {
          model.password = 'set-by-@BeforeSave';
          return Promise.resolve();
        };

        const test = TestSave.fromJson({});
        await test.create();
        await test.save();

        expect(test.password).toBe('set-by-@BeforeSave');
        expect((await TestSave.getById(test.id)).password).toBe('set-by-@BeforeSave');

        done();
      } catch (err) {
        done.fail(err);
      }
    });

    it('obeys context', async (done) => {
      let contextDefault;
      let contextStar;
      let contextTest;

      try {
        beforeSave1Hook = async (model: TestSave, context: string): Promise<void> => {
          contextDefault = true;
        };

        beforeSave2Hook = async (model: TestSave, context: string): Promise<void> => {
          contextStar = true;
        };

        beforeSave3Hook = async (model: TestSave, context: string): Promise<void> => {
          contextTest = true;
        };

        const test = TestSave.fromJson({});
        await test.create();
        await test.save(null, null, 'test');

        expect(contextDefault).toBeFalsy('default context should not have been called');
        expect(contextStar).toBeTruthy('start context should always be called');
        expect(contextTest).toBeTruthy('test context should have been called');

        done();
      } catch (err) {
        done.fail(err);
      }
    });

  });
});
