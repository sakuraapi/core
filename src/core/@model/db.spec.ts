import {
  Db,
  dbSymbols
} from './';

describe('@Db', () => {

  it('takes a string for the fieldname or an IDbOptions if other options are needed', () => {
    class DbTestStringField {
      @Db('t1')
      test1 = 'test1';

      @Db({field: 't2'})
      test2 = 'test2';
    }

    const map = DbTestStringField[dbSymbols.dbByPropertyName];
    expect(map.get('test1').field).toBe('t1');
    expect(map.get('test2').field).toBe('t2');
  });

});
