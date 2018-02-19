import {testSapi}       from '../../../spec/helpers/sakuraapi';
import {
  Injectable,
  SapiInjectableMixin
}                       from '../@injectable';
import {SakuraApi}      from '../sakura-api';
import {Db}             from './db';
import {Model}          from './model';
import {SapiModelMixin} from './sapi-model-mixin';

describe('SapiModelMixin', () => {
  it('allows inheritance', async (done) => {

    @Injectable()
    class TestInjectable extends SapiInjectableMixin() {
      initializeLastName() {
        return 'Doe';
      }
    }

    @Model({
      dbConfig: {
        collection: 'model-inheritance-test',
        db: 'userDb'
      }
    })
    class BaseModel extends SapiModelMixin() {

      @Db()
      firstName = 'John';
      @Db()
      lastName = 'Snow';

      constructor(private srv: TestInjectable) {
        super();
        this.lastName = srv.initializeLastName();
      }
    }

    @Model({
      // remember, decorators are not inherited
      dbConfig: {
        collection: 'model-inheritance-test2',
        db: 'userDb'
      }
    })
    class DerivedModel extends SapiModelMixin(BaseModel) {
      @Db()
      eyeColor = 'hazel';
    }

    let sapi: SakuraApi;
    try {
      sapi = testSapi({
        models: [
          BaseModel,
          DerivedModel
        ],
        providers: [
          TestInjectable
        ]
      });

      await sapi.listen({bootMessage: ''});

      const M = sapi.getModel(DerivedModel);
      const model = new M();

      await model.create();

      const savedModel = await M.getById(model.id);
      expect(savedModel.firstName).toBe('John');
      expect(savedModel.lastName).toBe('Doe');
      expect(savedModel.eyeColor).toBe('hazel');

      done();
    } catch (err) {
      done.fail(err);
    } finally {
      if (sapi) {
        await sapi.close();
      }
    }

  });
});
