import { expect } from 'chai';

import merge from '../src/utils/merge';

// This is copied from Axios's own unit tests, to ensure that
// this merge behaves exactly the same as axios's merge.

describe('utils/merge should match axios merge and', () => {
  it('should be immutable', () => {
    const a = {};
    const b = { foo: 123 };
    const c = { bar: 456 };

    merge(a, b, c);

    expect(typeof a.foo).to.deep.equal('undefined');
    expect(typeof a.bar).to.deep.equal('undefined');
    expect(typeof b.bar).to.deep.equal('undefined');
    expect(typeof c.foo).to.deep.equal('undefined');
  });

  it('should merge properties', () => {
    const a = { foo: 123 };
    const b = { bar: 456 };
    const c = { foo: 789 };
    const d = merge(a, b, c);

    expect(d.foo).to.deep.equal(789);
    expect(d.bar).to.deep.equal(456);
  });

  it('should merge recursively', () => {
    const a = { foo: { bar: 123 } };
    const b = { foo: { baz: 456 }, bar: { qux: 789 } };

    expect(merge(a, b)).to.deep.equal({
      foo: {
        bar: 123,
        baz: 456
      },
      bar: {
        qux: 789
      }
    });
  });
});
