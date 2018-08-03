import { ObjectID } from 'mongodb';
import { testSapi } from '../../../../spec/helpers/sakuraapi';
import { SakuraApi } from '../../sakura-api';
import { BeforeCreate } from '../before-create';
import { Db } from '../db';
import { Id } from '../id';
import { Model } from '../model';
import { SapiModelMixin } from '../sapi-model-mixin';

describe('emitOnBeforeCreate', () => {

  const dbConfig = {
    collection: 'users',
    db: 'userDb'
  };
  let sapi: SakuraApi;

  let called = 0;
  let calledChildCount = 0;
  let deep = 0;

  @Model()
  class Deep extends SapiModelMixin() {
    @BeforeCreate()
    testBeforeCreate() {
      deep++;
    }
  }

  @Model()
  class TestChild extends SapiModelMixin() {
    @Db({model: Deep})
    deep = new Deep();

    @BeforeCreate()
    testBeforeCreate() {
      calledChildCount++;
    }
  }

  @Model({dbConfig})
  class Test extends SapiModelMixin() {
    @Id()
    id: ObjectID;

    @Db({model: TestChild})
    testChild = new TestChild();

    @Db({model: TestChild})
    testChildren = [new TestChild(), new TestChild()];

    @BeforeCreate()
    testBeforeCreate() {
      called++;
    }
  }

  beforeEach(async () => {
    called = 0;
    calledChildCount = 0;
    deep = 0;

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

    expect(called).toBe(0);
    await (new Test()).create();
    expect(called).toBe(1);
    expect(calledChildCount).toBe(3);
    expect(deep).toBe(3);

  });
});
