import {PouchDB} from './utils';

describe('signatures', () => {
  it('vhost', () => {
    const promise = PouchDB.virtualHost({raw_path: '/'}, {}, () => {});
    promise.then.should.be.ok;
    promise.catch.should.be.ok;
  });
});
