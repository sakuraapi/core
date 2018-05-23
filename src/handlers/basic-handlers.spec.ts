import * as request from 'supertest';
import { testSapi, testUrl } from '../../spec/helpers/sakuraapi';
import { SakuraApi } from '../core';
import { Db, Json, Model, SapiModelMixin } from '../core/@model';
import { Routable, SapiRoutableMixin } from '../core/@routable';
import {
  deleteRouteHandler,
  getAllRouteHandler,
  getRouteHandler,
  postRouteHandler,
  putRouteHandler
} from './basic-handlers';
import { Id } from '../core/@model/id';
import { ObjectID } from 'mongodb';

describe('basic-handlers', () => {

  describe('getAllRouteHandler', () => {

    @Model({
      dbConfig: {
        collection: 'getAllRouteHandler',
        db: 'userDb'
      }
    })
    class TestModel extends SapiModelMixin() {
      @Id() @Json({type: 'id'})
      id: ObjectID;

      @Db() @Json()
      firstName: string;

      @Db() @Json()
      lastName: string;
    }

    @Routable({
      baseUrl: 'user',
      model: TestModel
    })
    class TestApi extends SapiRoutableMixin() {
    }

    let sapi: SakuraApi;

    beforeEach(async (done) => {
      try {
        sapi = testSapi({
          models: [TestModel],
          routables: [TestApi]
        });

        await sapi.listen({bootMessage: ''});
        done();
      } catch (err) {
        done.fail(err);
      }
    });

    afterEach(async () => {
      await TestModel.removeAll({});
      await sapi.close();
    });

    it('gets an empty array of when no models exist exist', async (done) => {
      try {
        const result = await request(sapi.app)
          .get(testUrl('/user'))
          .expect(200);

        const body = result.body;

        expect(body.length).toBe(0);

        done();
      } catch (err) {
        done.fail(err);
      }

    });

    it('gets an array of models when models are present', async (done) => {
      try {

        const user1 = TestModel.fromJson({firstName: 'John', lastName: 'Adams'});
        await user1.create();

        const result = await request(sapi.app)
          .get(testUrl('/user'))
          .expect(200);

        const body = result.body;

        expect(body.length).toBe(1);
        expect(body[0].firstName).toBe('John');
        expect(body[0].lastName).toBe('Adams');

        done();
      } catch (err) {
        done.fail(err);
      }

    });
  });

  describe('throws correct error if @Routable has no model', () => {
    @Routable()
    class TestApi {
    }

    const mockReq = {
      params: {
        id: ''
      }
    } as any;

    const mockRes = {
      locals: {
        routable: {}
      }
    } as any;

    const mockNext = () => {
      // lint empty
    };

    const testApi = new TestApi();

    it('getRouteHandler throws if model is not present', () => {
      expect(() => getRouteHandler.bind(testApi)(mockReq, mockRes, mockNext))
        .toThrowError(`TestApi is attempting to use handler 'getRouteHandler',`
          + ` which requires TestApi to be bound to a model`);
    });

    it('getAllRouteHandler throws if model is not present', () => {
      expect(() => getAllRouteHandler.bind(testApi)(mockReq, mockRes, mockNext))
        .toThrowError(`TestApi is attempting to use handler 'getAllRouteHandler',`
          + ` which requires TestApi to be bound to a model`);
    });

    it('putRouteHandler throws if model is not present', () => {
      expect(() => putRouteHandler.bind(testApi)(mockReq, mockRes, mockNext))
        .toThrowError(`TestApi is attempting to use handler 'putRouteHandler',`
          + ` which requires TestApi to be bound to a model`);
    });

    it('postRouteHandler throws if model is not present', () => {
      expect(() => postRouteHandler.bind(testApi)(mockReq, mockRes, mockNext))
        .toThrowError(`TestApi is attempting to use handler 'postRouteHandler',`
          + ` which requires TestApi to be bound to a model`);
    });

    it('deleteRouteHandler throws if model is not present', () => {
      expect(() => deleteRouteHandler.bind(testApi)(mockReq, mockRes, mockNext))
        .toThrowError(`TestApi is attempting to use handler 'deleteRouteHandler',`
          + ` which requires TestApi to be bound to a model`);
    });
  });
});
