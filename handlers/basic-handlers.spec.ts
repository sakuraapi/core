import {Routable} from '../core/@routable/routable';
import {
  deleteRouteHandler,
  getAllRouteHandler,
  getRouteHandler,
  postRouteHandler,
  putRouteHandler
} from './basic-handlers';


describe('basic-handlers', () => {

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
  };

  describe('throws correct error if @Routable has no model', () => {
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
