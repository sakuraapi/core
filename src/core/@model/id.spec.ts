import { SapiModelMixin } from './sapi-model-mixin';
import { Model } from './model';
import { Id, idSymbols } from './id';
import { ObjectID } from 'mongodb';

describe('@Id', () => {

  @Model()
  class TestModel extends SapiModelMixin() {

    @Id()
    tmId: ObjectID;

  }

  it('decorates a property', () => {
    const model = new TestModel();
    const idProperty = Reflect.getMetadata(idSymbols.idByPropertyName, model);
    expect(idProperty).toBe('tmId');
  });

  it('decorating two properties with @Id throws error', () => {
    expect(() => {
      @Model()
      class TestModel1 extends SapiModelMixin() {
        @Id() tmId: ObjectID;
        @Id() tmId2: ObjectID;
      }
    }).toThrowError('TestModel1 is trying to use @Id on property tmId2, but it has already been defined on tmId');
  });

  it('maps fromDb', () => {
    const id = new ObjectID();
    const result = TestModel.fromDb({_id: id});

    expect(result.tmId.toHexString()).toBe(id.toHexString());
    expect(result.id).toBeUndefined();
  });

  it('maps toDb', () => {
    const model = new TestModel();
    model.tmId = new ObjectID();
    const result = model.toDb();

    expect(result._id.toHexString()).toBe(model.tmId.toHexString());
  });
});
