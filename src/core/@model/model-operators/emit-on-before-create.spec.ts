import { ObjectID } from 'mongodb';
import { testSapi } from '../../../../spec/helpers/sakuraapi';
import { SakuraApi } from '../../sakura-api';
import { BeforeCreate } from '../before-create';
import { Id } from '../id';
import { Model } from '../model';
import { SapiModelMixin } from '../sapi-model-mixin';

describe('emitOnBeforeCreate', () => {

  const dbConfig = {
    collection: 'users',
    db: 'userDb',
    promiscuous: true
  };
  let sapi: SakuraApi;

  let called = false;

  @Model({dbConfig})
  class Test extends SapiModelMixin() {
    @BeforeCreate()
    testBeforeCreate() {
      called = true;
    }

    @Id()
    id: ObjectID;

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

  it('calls @BeforeCreate on model.create', async () => {

    expect(called).toBeFalsy();
    await (new Test()).create();
    expect(called).toBeTruthy();

  });
});
