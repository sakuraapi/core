import { ObjectID } from 'mongodb';
import { testSapi } from '../../../spec/helpers/sakuraapi';
import { SakuraApi } from '../sakura-api';
import { BeforeSave, OnBeforeSave } from './before-save';
import { Id } from './id';
import { BeforeCreate, Db, Json, Model } from './index';
import { SapiModelMixin } from './sapi-model-mixin';

describe('@BeforeSave', () => {
  const dbConfig = {
    collection: 'users',
    db: 'userDb',
    promiscuous: true
  };

  let sapi: SakuraApi;

  describe('standard behavior', () => {

    let beforeSave1Hook: OnBeforeSave;
    let beforeSave2Hook: OnBeforeSave;
    let beforeSave3Hook: OnBeforeSave;
    let beforeSave1This: any;
    let beforeSave2This: any;


    @Model({dbConfig})
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

      @BeforeSave()
      beforeSave1(model: TestSave, context: string): Promise<void> {
        beforeSave1This = this;
        return (beforeSave1Hook) ? beforeSave1Hook(model, context) : Promise.resolve();
      }

      @BeforeSave('*')
      beforeSave2(model: TestSave, context: string): Promise<void> {
        beforeSave2This = this;
        return (beforeSave2Hook) ? beforeSave2Hook(model, context) : Promise.resolve();
      }

      @BeforeSave('test')
      beforeSave3(model: TestSave, context: string): Promise<void> {
        return (beforeSave3Hook) ? beforeSave3Hook(model, context) : Promise.resolve();
      }
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
      beforeSave1Hook = null;
      beforeSave2Hook = null;
      beforeSave3Hook = null;

      beforeSave1This = null;
      beforeSave2This = null;
    });

    it('gets called when a model is saved', async () => {
      let model1;
      let model2;
      let context1;
      let context2;
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

    });

    it('modified model properties are persisted', async () => {
      beforeSave1Hook = (model: TestSave, context: string): Promise<void> => {
        model.password = 'set-by-@BeforeSave';
        return Promise.resolve();
      };

      const test = TestSave.fromJson({});
      await test.create();
      await test.save();

      expect(test.password).toBe('set-by-@BeforeSave');
      expect((await TestSave.getById(test.id)).password).toBe('set-by-@BeforeSave');
    });

    it('obeys context', async () => {
      let contextDefault;
      let contextStar;
      let contextTest;

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

    });

    it('sets instance of this to model', async () => {

      const test = await TestSave.fromJson({});
      await test.create();
      await test.save();

      expect(beforeSave1This instanceof TestSave).toBeTruthy();
      expect(beforeSave2This instanceof TestSave).toBeTruthy();

    });
  });

  fdescribe('hierarchical behavior', () => {

    @Model()
    class GrandChild extends SapiModelMixin() {

      @Id() @Json()
      id: ObjectID = new ObjectID();


      @BeforeSave() @BeforeCreate()
      async beforeSaveHandler() {
        // await new Promise((r) => setTimeout(() => r(), 1000));
        if (isSaving) console.log(`------------------------ GrandChild @BeforeSaveCalled`.green);
      }
    }

    @Model()
    class Child extends SapiModelMixin() {

      @Id() @Json()
      id: ObjectID = new ObjectID();


      @Db({model: GrandChild}) @Json()
      grandChildren: GrandChild[] = [];

      @BeforeSave() @BeforeCreate()
      async beforeSaveHandler() {
        // await new Promise((r) => setTimeout(() => r(), 1000));
        if (isSaving) console.log(`------------------------ Child @BeforeSaveCalled`.green);
      }
    }

    @Model({dbConfig})
    class Parent extends SapiModelMixin() {

      @Id() @Json()
      id: ObjectID;

      @Db({model: Child}) @Json()
      children: Child[] = [];

      @BeforeSave() @BeforeCreate()
      async beforeSaveHandler() {
        if (isSaving) {
          // await new Promise((r) => setTimeout(() => r(), 1000));
          console.log(`------------------------ Parent @BeforeSaveCalled`.green);
        }
      }
    }

    let isSaving = false;
    const MAX_SAFE_TIMEOUT = Math.pow(2, 31) - 1;


    beforeEach(async () => {
      sapi = testSapi({
        models: [
          Child,
          GrandChild,
          Parent
        ]
      });

      await sapi
        .dbConnections
        .connectAll();
    });

    fit('puts the lotion in the basket', async () => {

      const parent = new Parent();
      parent.children.push(new Child(), new Child());
      parent.children.forEach((c) => c.grandChildren.push(new GrandChild(), new GrandChild()));


      await parent.create();
      isSaving = true;
      await parent.save();

      console.log(`------------------------`.yellow);
      console.log(JSON.stringify((await Parent.getById(parent.id)), null, 2));

    }, MAX_SAFE_TIMEOUT);
  });
});
