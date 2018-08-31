import { ObjectID, UpdateWriteOpResult } from 'mongodb';
import { testSapi } from '../../../../spec/helpers/sakuraapi';
import { SakuraApi } from '../../sakura-api';
import { SapiMissingIdErr } from '../errors';
import { Id } from '../id';
import { Db, Json, Model } from '../index';
import { SapiModelMixin } from '../sapi-model-mixin';

describe('Model.save', () => {

  const dbConfig = {
    collection: 'users',
    db: 'userDb',
    promiscuous: true
  };

  let sapi: SakuraApi;

  @Model({promiscuous: true})
  class ChildChild {
    cVal = 'childChild';
  }

  @Model({promiscuous: true})
  class Child {
    @Id() @Json({type: 'id'})
    id: ObjectID;

    cVal = 'child';

    @Db({model: ChildChild}) @Json()
    childChild = new ChildChild();
  }

  @Model({dbConfig})
  class TestParent extends SapiModelMixin() {

    @Id() @Json({type: 'id'})
    id: ObjectID;

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

    @Id() @Json({type: 'id'})
    id: ObjectID;

    @Db({field: 'fn'})
    firstName = 'George';

    lastName = 'Washington';

    @Db({
      field: 'pw',
      private: true
    })
    password = '';
  }

  beforeEach(async () => {

    sapi = testSapi({
      models: [TestSave]
    });

    await sapi
      .dbConnections
      .connectAll();
  });

  afterEach(async () => {

    await TestSave.removeAll({});
    await sapi.close();

    sapi = null;
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

      expect(testDefaultMethods.id).toBeUndefined();
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

    it('saves sub documents, issue #98', async () => {

      const sapi2 = testSapi({
        models: [
          Child,
          ChildChild,
          TestParent
        ]
      });

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

      await sapi2.close();

    });

    it('does not add id/_id to sub documents, issue #106', async () => {

      const sapi2 = testSapi({
        models: [
          Child,
          ChildChild,
          TestParent
        ]
      });

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

      await sapi2.close();

    });

    it('does allow explicit id/_id in sub documents, issue #106', async () => {

      const sapi2 = testSapi({
        models: [
          Child,
          ChildChild,
          TestParent
        ]
      });

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

      await sapi2.close();
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

      @Id() @Json({type: 'id'})
      id: ObjectID;

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

    afterEach(async () => {
      await sapi2.close();
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
});
