import { ObjectID } from 'mongodb';
import { testSapi } from '../../../../spec/helpers/sakuraapi';
import { SakuraApi } from '../../sakura-api';
import { BeforeSave } from '../before-save';
import { Id } from '../id';
import { Model } from '../model';
import { SapiModelMixin } from '../sapi-model-mixin';

describe('emitOnBeforeSave', () => {

  const dbConfig = {
    collection: 'users',
    db: 'userDb',
    promiscuous: true
  };
  let sapi: SakuraApi;

  let called = false;

  @Model({dbConfig})
  class Test extends SapiModelMixin() {
    @BeforeSave()
    testBeforeCreate() {
      called = true;
    }

    @Id()
    id: ObjectID;

    name = 'bob';
  }

  beforeEach(async () => {
    called = false;

    sapi = testSapi({
      models: [Test]
    });

    await sapi
      .dbConnections
      .connectAll();
  });

  afterEach(async () => {
    await Test.removeAll({});
  });

  it('calls @BeforeSave on model.create', async () => {
    expect(called).toBeFalsy();
    const test = new Test();
    await test.create();
    await test.save();

    expect(called).toBeTruthy();
  });
});
