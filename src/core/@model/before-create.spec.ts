import { ObjectID } from 'mongodb';
import { testSapi } from '../../../spec/helpers/sakuraapi';
import { SakuraApi } from '../sakura-api';
import { BeforeCreate, OnBeforeCreate } from './before-create';
import { Id } from './id';
import { Db, Json, Model } from './index';
import { SapiModelMixin } from './sapi-model-mixin';

describe('@BeforeCreate', () => {

  const dbConfig = {
    collection: 'users',
    db: 'userDb',
    promiscuous: true
  };
  let sapi: SakuraApi;

  let beforeCreate1Hook: OnBeforeCreate;
  let beforeCreate2Hook: OnBeforeCreate;
  let beforeCreate3Hook: OnBeforeCreate;

  let beforeCreate1This = null;
  let beforeCreate2This = null;

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
    beforeCreate1Hook = null;
    beforeCreate2Hook = null;
    beforeCreate3Hook = null;

    beforeCreate1This = null;
    beforeCreate2This = null;
  });

  it('gets called when a model is created', async () => {
    let model1;
    let model2;
    let context1;
    let context2;


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
  });

  it('modified model properties are persisted', async () => {
    beforeCreate1Hook = (model: TestCreate, context: string): Promise<void> => {
      model.password = 'set-by-@BeforeSave';
      return Promise.resolve();
    };

    const test = TestCreate.fromJson({});
    await test.create();

    expect(test.password).toBe('set-by-@BeforeSave');
    expect((await TestCreate.getById(test.id)).password).toBe('set-by-@BeforeSave');

  });

  it('obeys context', async () => {
    let contextDefault;
    let contextStar;
    let contextTest;


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

  });

  it('sets instance of this to model', async () => {

    const test = await TestCreate.fromJson({});
    await test.create();

    expect(beforeCreate1This instanceof TestCreate).toBeTruthy();
    expect(beforeCreate2This instanceof TestCreate).toBeTruthy();

  });
});
