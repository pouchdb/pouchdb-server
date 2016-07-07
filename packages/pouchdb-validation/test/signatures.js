import {setup, teardown} from './utils';

describe('callback usage', () => {
  it('should allow passing in a callback', async () => {
    const db = setup();
    await db.validatingPost({}, () => {});
    await teardown();
  });
});
