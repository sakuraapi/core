import {SanitizeMongoDB} from './';

describe('core/security/mongo-db', function() {

  describe('sanitizeObject', function() {

    it('returns null and undefined untouched', function() {
      const filter = (key) => false;

      expect(SanitizeMongoDB.sanitizeObject(null, filter)).toBe(null);
      expect(SanitizeMongoDB.sanitizeObject(undefined, filter)).toBe(undefined);
    });

    it('returns numbers and strings untouched', function() {
      const stringInput = '"hello"';
      const numberInput = 777;
      const filter = (key) => false;

      expect(SanitizeMongoDB.sanitizeObject(stringInput, filter)).toBe('hello');
      expect(SanitizeMongoDB.sanitizeObject(numberInput, filter)).toBe(numberInput);
    });

    it('throws when given invalid JSON', function() {
      const invalidJson = `{firstName:'test'}`;
      const filter = (key) => false;

      expect(() => {
        SanitizeMongoDB.sanitizeObject(invalidJson, filter);
      }).toThrow(new SyntaxError('Unexpected token f in JSON at position 1'));
    });
  });

  describe('removeAll$Keys', function() {

    it('removes top level object keys starting with $', function() {
      const obj = {
        firstName: 'Geroge',
        lastName: 'Washington',
        $where() {
          /*do something bad*/
        },
        $in() {

        }
      };

      const result = SanitizeMongoDB.removeAll$Keys(obj);

      expect(result.$where).toBeUndefined('$where should have been removed');
      expect(result.$in).toBeUndefined('$in should have been removed');
      expect(result.firstName).toBe(obj.firstName);
      expect(result.lastName).toBe(obj.lastName);
    });

    it('throws when given invalid JSON', function() {
      const invalidJson = `{firstName:'test'}`;

      expect(() => {
        SanitizeMongoDB.removeAll$Keys(invalidJson);
      }).toThrow(new SyntaxError('Unexpected token f in JSON at position 1'));
    });

    describe('deep inspects', function() {
      const obj = {
        firstName: 'Geroge',
        inner: {
          color: 'red',
          innerInner: {
            $where() {
              /*do something bad*/
            },
            $in() {
            }
          },
          number: 777
        },
        lastName: 'Washington'
      };

      it('deep inspects object for $ fields and removes them', function() {

        const result = SanitizeMongoDB.removeAll$Keys(obj);

        expect(result.firstName).toBe(obj.firstName);
        expect(result.lastName).toBe(obj.lastName);
        expect(result.inner).toBeDefined();
        expect(result.inner.color).toBe(obj.inner.color);
        expect(result.inner.number).toBe(obj.inner.number);
        expect(result.inner.innerInner.$where).toBeUndefined('$where should have been undefined');
        expect(result.inner.innerInner.$in).toBeUndefined('$in should have been undefined');
      });

      it('deep inspects JSON string for $ fields and removes them', function() {
        const jsonString = JSON.stringify(obj);
        const result = SanitizeMongoDB.removeAll$Keys(jsonString);

        expect(result.firstName).toBe(obj.firstName);
        expect(result.lastName).toBe(obj.lastName);
        expect(result.inner).toBeDefined();
        expect(result.inner.color).toBe(obj.inner.color);
        expect(result.inner.number).toBe(obj.inner.number);
        expect(result.inner.innerInner.$where).toBeUndefined('$where should have been undefined');
        expect(result.inner.innerInner.$in).toBeUndefined('$in should have been undefined');
      });
    });
  });

  describe('remove$where', function() {

    it('removes top level object keys starting with $', function() {
      const obj = {
        $in: [],
        $where() {
          /*do something bad*/
        },
        firstName: 'Geroge',
        lastName: 'Washington'
      };

      const result = SanitizeMongoDB.remove$where(obj);

      expect(result.$where).toBeUndefined('$where should have been removed');
      expect(result.$in).toBeDefined('$in should not have been removed');
      expect(result.firstName).toBe(obj.firstName);
      expect(result.lastName).toBe(obj.lastName);
    });

    it('throws when given invalid JSON', function() {
      const invalidJson = `{firstName:'test'}`;

      expect(() => {
        SanitizeMongoDB.remove$where(invalidJson);
      }).toThrow(new SyntaxError('Unexpected token f in JSON at position 1'));
    });

    describe('deep inspects', function() {
      const obj = {
        $in: [],
        $where() {
          /*do something bad*/
        },
        firstName: 'Geroge',
        inner: {
          color: 'red',
          innerInner: {
            $where() {
              /*do something bad*/
            },
            $in: []
          },
          number: 777
        },
        lastName: 'Washington'
      };

      it('deep inspects object for $where fields and removes them', function() {
        const result = SanitizeMongoDB.remove$where(obj);

        expect(result.$where).toBeUndefined('$where should have been removed');
        expect(result.$in).toBeDefined('$in should not have been removed');
        expect(result.firstName).toBe(obj.firstName);
        expect(result.lastName).toBe(obj.lastName);
        expect(result.inner).toBeDefined();
        expect(result.inner.color).toBe(obj.inner.color);
        expect(result.inner.number).toBe(obj.inner.number);
        expect(result.inner.innerInner.$where).toBeUndefined('$where should have been undefined');
        expect(result.inner.innerInner.$in).toBeDefined('$in should not have been undefined');
      });

      it('deep inspects JSON string for $where fields and removes them', function() {
        const jsonString = JSON.stringify(obj);
        const result = SanitizeMongoDB.remove$where(jsonString);

        expect(result.$where).toBeUndefined('$where should have been removed');
        expect(result.$in).toBeDefined('$in should not have been removed');
        expect(result.firstName).toBe(obj.firstName);
        expect(result.lastName).toBe(obj.lastName);
        expect(result.inner).toBeDefined();
        expect(result.inner.color).toBe(obj.inner.color);
        expect(result.inner.number).toBe(obj.inner.number);
        expect(result.inner.innerInner.$where).toBeUndefined('$where should have been undefined');
        expect(result.inner.innerInner.$in).toBeDefined('$in should not have been undefined');
      });
    });
  });

  describe('whiteList$key', function() {
    it('only includes $ keys that are white listed', function() {
      const input = {
        $notOk: true,
        $ok: true,
        deep: {
          $notOk: true,
          $ok: true,
          deeper: {
            $notOk: true,
            $ok: true,
            ok: true
          },
          ok: true
        },
        ok: true
      };

      const result = SanitizeMongoDB.whiteList$Keys(input, ['$ok']);

      expect(result).toBeDefined('A result object should have been retruned');
      expect(result.ok).toBeTruthy('A none $ property should not have been filtered');
      expect(result.$ok).toBeTruthy('$ok field should not have be stripped');
      expect(result.$notOk).toBeUndefined('$notOk field should not have been included');
      expect(result.deep).toBeDefined('deep should have been defined');
      expect(result.deep.ok).toBeTruthy('A none $ property should not have been filtered');
      expect(result.deep.$ok).toBeTruthy('$ok field should not have be stripped');
      expect(result.deep.$notOk).toBeUndefined('$notOk field should not have been included');
      expect(result.deep.deeper.ok).toBeTruthy('A none $ property should not have been filtered');
      expect(result.deep.deeper.$ok).toBeTruthy('$ok field should not have be stripped');
      expect(result.deep.deeper.$notOk).toBeUndefined('$notOk field should not have been included');
    });
  });

  describe('flattenObj', function() {
    const obj = {
      contact: {
        phones: {
          direct: '2',
          mobile: '1'
        }
      },
      name: 'George Washington'
    };

    it('returns the input if it\'s not an object', function() {
      expect(SanitizeMongoDB.flattenObj('test')).toBe('test');
      expect(SanitizeMongoDB.flattenObj(1)).toBe(1);
      expect(SanitizeMongoDB.flattenObj(null)).toBe(null);
      expect(SanitizeMongoDB.flattenObj(undefined)).toBe(undefined);
    });

    it('handles an object with multiple layers of embedded objects', function() {
      const result = SanitizeMongoDB.flattenObj(obj);

      expect(result).toBeDefined('Some object should have been returned');
      expect(result.name).toBe(obj.name);
      expect(result.contact).toBeUndefined('contact should have been mutated');
      expect(result['contact.phones.mobile']).toBe(obj.contact.phones.mobile);
      expect(result['contact.phones.direct']).toBe(obj.contact.phones.direct);

    });
  });
});
