import { SapiModelMixin } from './sapi-model-mixin';
import { Model } from './model';
import { Id, idSymbols } from './id';
import { ObjectID } from 'mongodb';
import { Json } from './json';

describe('@Id', () => {

  @Model()
  class TestModel extends SapiModelMixin() {
    @Id() @Json({type: 'id'})
    tmId: ObjectID;
  }

  it('decorates a property', () => {
    const model = new TestModel();
    const idProperty = Reflect.getMetadata(idSymbols.idByPropertyName, model);
    expect(idProperty).toBe('tmId');
  });

  describe('validation', () => {
    it('decorating two properties with @Id throws error', () => {
      expect(() => {
        @Model()
        class TestModel1 extends SapiModelMixin() {
          @Id() tmId: ObjectID;
          @Id() tmId2: ObjectID;
        }
      }).toThrowError('TestModel1 is trying to use @Id on property tmId2, but it has already been defined on tmId');
    });

    it('throws if dbConfig is defined without @Id decorated property', () => {
      expect(() => {
        @Model({dbConfig: {} as any})
        class TestFailure {
        }

        new TestFailure();
      }).toThrowError(`Model TestFailure defines 'dbConfig' but does not have an @Id decorated properties`);
    });
  });

  describe('@Db', () => {
    it('maps fromDb', () => {
      const id = new ObjectID();
      const result = TestModel.fromDb({_id: id});

      expect(result.tmId.toHexString()).toBe(id.toHexString());
    });

    it('maps toDb', () => {
      const model = new TestModel();
      model.tmId = new ObjectID();
      const result = model.toDb();

      expect(result._id.toHexString()).toBe(model.tmId.toHexString());
      expect(result.tmId).toBeUndefined();
    });
  });

  describe('@Json', () => {

    it('maps fromJson', () => {
      const id = new ObjectID();
      const result = TestModel.fromJson({tmId: id.toHexString()});

      expect(result.tmId.toHexString()).toBe(id.toHexString());
    });

    it('maps toJson', () => {
      const model = new TestModel();
      model.tmId = new ObjectID();
      const result = model.toJson();

      expect(result.tmId.toHexString()).toBe(model.tmId.toHexString());
    });

  });
});
