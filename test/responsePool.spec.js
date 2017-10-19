import { assert } from 'chai';
import ResponsePool from '../src/responsePool';
import { mockServerResponse } from './mocks';

describe('ResponsePool', () => {
  let pool;
  let responseA;
  let responseB;
  let responseC;

  beforeEach(() => {
    pool = new ResponsePool();

    responseA = mockServerResponse();
    responseB = mockServerResponse();
    responseC = mockServerResponse();

    pool.add(responseA);
    pool.add(responseB);
    pool.add(responseC);
  });

  it('returns the first available response', () => {
    assert.equal(responseA, pool.get());
  });

  it('removes a response from the pool when it closes', () => {
    responseA.emit('close');
    assert.equal(responseB, pool.get());
  });

  it('removes a response from the pool when it finishes', () => {
    responseA.emit('finish');
    assert.equal(responseB, pool.get());
  });

  it('returns null when all responses are closed/finished', () => {
    responseA.emit('close');
    responseB.emit('close');
    responseC.emit('finish');

    assert.isNotOk(pool.get());
  });
});
