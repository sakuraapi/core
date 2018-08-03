import { ObjectID } from 'mongodb';
import { testSapi } from '../../../../spec/helpers/sakuraapi';
import { SakuraApi } from '../../sakura-api';
import { Id } from '../id';
import { Db, Json, Model } from '../index';
import { SapiModelMixin } from '../sapi-model-mixin';

describe('Model.create', () => {

  const dbConfig = {
    collection: 'users',
    db: 'userDb',
    promiscuous: true
  };

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

  }

  beforeEach(async () => {

    sapi = testSapi({
      models: [TestCreate]
    });

    await sapi
      .dbConnections
      .connectAll();

  });

  afterEach(async () => {
    await TestCreate.removeAll({});
    await sapi.close();

    sapi = null;
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

});
