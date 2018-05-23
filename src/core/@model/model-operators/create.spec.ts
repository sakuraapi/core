import { ObjectID } from 'mongodb';
import { testSapi } from '../../../../spec/helpers/sakuraapi';
import { SakuraApi } from '../../sakura-api';
import { BeforeCreate, OnBeforeCreate } from '../before-create';
import { Id } from '../id';
import { Db, Json, Model } from '../index';
import { SapiModelMixin } from '../sapi-model-mixin';

describe('Model.create', () => {

  const dbConfig = {
    collection: 'users',
    db: 'userDb',
    promiscuous: true
  };
  let beforeCreate1Hook: OnBeforeCreate;
  let beforeCreate2Hook: OnBeforeCreate;
  let beforeCreate3Hook: OnBeforeCreate;

  let beforeCreate1This = null;
  let beforeCreate2This = null;

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
  class TestCreate extends SapiModelMixin() {

    @Id() @Json({type: 'id'})
    id: ObjectID;

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

    @BeforeCreate()
    beforeCreate1(model: TestCreate, context: string): Promise<void> {
      beforeCreate1This = this;
      return (beforeCreate1Hook) ? beforeCreate1Hook(model, context) : Promise.resolve();
    }

    @BeforeCreate('*')
    beforeCreate2(model: TestCreate, context: string): Promise<void> {
      beforeCreate2This = this;
      return (beforeCreate2Hook) ? beforeCreate2Hook(model, context) : Promise.resolve();
    }

    @BeforeCreate('test')
    beforeCreate3(model: TestCreate, context: string): Promise<void> {
      return (beforeCreate3Hook) ? beforeCreate3Hook(model, context) : Promise.resolve();
    }
  }

  beforeEach(async (done) => {
    try {
      sapi = testSapi({
        models: [TestCreate]
      });

      await sapi
        .dbConnections
        .connectAll();

      done();
    } catch (err) {
      done.fail(err);
    }
  });

  afterEach(async () => {
    await TestCreate.removeAll({});
    await sapi.close();

    sapi = null;
    beforeCreate1Hook = null;
    beforeCreate2Hook = null;
    beforeCreate3Hook = null;

    beforeCreate1This = null;
    beforeCreate2This = null;
  });

  it('inserts model into db', async (done) => {
    try {
      const testDefaultMethods = new (sapi.getModel(TestCreate))();

      const result = await testDefaultMethods.create();
      expect(result.insertedCount).toBe(1);

      const result2 = await testDefaultMethods
        .getCollection()
        .find({_id: testDefaultMethods.id})
        .limit(1)
        .next();

      expect(result2._id.toString()).toBe(testDefaultMethods.id.toString());

      expect(result2.fn).toBeDefined();
      expect(result2.lastName).toBeDefined();

      expect(result2.fn).toBe(testDefaultMethods.firstName);
      expect(result2.lastName).toBe(testDefaultMethods.lastName);

      done();
    } catch (err) {
      done.fail(err);
    }

  });

  it('sets the models Id before writing if Id is not set', async (done) => {
    try {
      const testDefaultMethods = new (sapi.getModel(TestCreate))();

      const result = await testDefaultMethods.create();
      expect(result.insertedCount).toBe(1);

      const result2 = await testDefaultMethods
        .getCollection()
        .find({_id: testDefaultMethods.id})
        .limit(1)
        .next();

      expect(result2._id.toString()).toBe(testDefaultMethods.id.toString());

      expect(result2.fn).toBeDefined();
      expect(result2.lastName).toBeDefined();

      expect(result2.fn).toBe(testDefaultMethods.firstName);
      expect(result2.lastName).toBe(testDefaultMethods.lastName);

      done();
    } catch (err) {
      done.fail(err);
    }
  });

  it('persists deeply nested objects', async () => {

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

      @Id() @Json({type: 'id'})
      id: ObjectID;

      @Db()
      firstName = 'George';
      @Db()
      lastName = 'Washington';

      @Db({model: Contact})
      contact = new Contact();
    }

    const sapi2 = testSapi({
      models: [UserCreateTest],
      routables: []
    });

    await sapi2.listen({bootMessage: ''});
    const user = new UserCreateTest();

    await user.create();
    const result = await user
      .getCollection()
      .find<any>({_id: user.id})
      .limit(1)
      .next();

    expect(result._id.toString()).toBe(user.id.toString());
    expect(result.firstName).toBe(user.firstName || 'firstName should have been defined');
    expect(result.lastName).toBe(user.lastName || 'lastName should have been defined');
    expect(result.contact).toBeDefined();
    expect(result.contact.phone).toBe('000-000-0000');

    await sapi2.close();
  });

  describe('@BeforeCreate', () => {

    it('gets called when a model is created', async (done) => {
      let model1;
      let model2;
      let context1;
      let context2;

      try {
        beforeCreate1Hook = (model: TestCreate, context: string): Promise<void> => {
          model1 = model;
          context1 = context;
          return Promise.resolve();
        };

        beforeCreate2Hook = (model: TestCreate, context: string): Promise<void> => {
          model2 = model;
          context2 = context;
          return Promise.resolve();
        };

        const test = TestCreate.fromJson({});
        await test.create();

        expect(model1 instanceof TestCreate).toBeTruthy();
        expect(context1).toBe('default');
        expect(model2 instanceof TestCreate).toBeTruthy();
        expect(context2).toBe('*');

        done();
      } catch (err) {
        done.fail(err);
      }
    });

    it('modified model properties are persisted', async (done) => {

      try {
        beforeCreate1Hook = (model: TestCreate, context: string): Promise<void> => {
          model.password = 'set-by-@BeforeSave';
          return Promise.resolve();
        };

        const test = TestCreate.fromJson({});
        await test.create();

        expect(test.password).toBe('set-by-@BeforeSave');
        expect((await TestCreate.getById(test.id)).password).toBe('set-by-@BeforeSave');

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
        beforeCreate1Hook = async (model: TestCreate, context: string): Promise<void> => {
          contextDefault = true;
        };

        beforeCreate2Hook = async (model: TestCreate, context: string): Promise<void> => {
          contextStar = true;
        };

        beforeCreate3Hook = async (model: TestCreate, context: string): Promise<void> => {
          contextTest = true;
        };

        const test = TestCreate.fromJson({});
        await test.create(null, 'test');

        expect(contextDefault).toBeFalsy('default context should not have been called');
        expect(contextStar).toBeTruthy('start context should always be called');
        expect(contextTest).toBeTruthy('test context should have been called');

        done();
      } catch (err) {
        done.fail(err);
      }
    });

    it('sets instance of this to model', async (done) => {
      try {
        const test = await TestCreate.fromJson({});
        await test.create();

        expect(beforeCreate1This instanceof TestCreate).toBeTruthy();
        expect(beforeCreate2This instanceof TestCreate).toBeTruthy();

        done();
      } catch (err) {
        done.fail(err);
      }
    });

  });
});
