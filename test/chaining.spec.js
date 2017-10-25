import { PassThrough } from 'stream';
import chai, { assert } from 'chai';
import sinonChai from 'sinon-chai';
import axios from 'axios';
import moxios from 'moxios';
import streamToString from 'stream-to-string';
import prepareAxios from '../src';
import { mockServerResponse } from './mocks';

chai.use(sinonChai);


describe('Chained requests', () => {

  let pageResponse;
  let pushResponse;
  let wrappedAxios;

  beforeEach(() => {
    moxios.install();

    const responseBody = new PassThrough();
    responseBody.end('{"foo": "bar"}');

    moxios.stubRequest('/foo', {
      response: responseBody
    });

    const actualAxios = axios.create();

    pageResponse = mockServerResponse();
    pushResponse = mockServerResponse();
    pageResponse.createPushResponse = (headers, callback) => {
      process.nextTick(callback, null, pushResponse);
    };

    wrappedAxios = prepareAxios(pageResponse, actualAxios);
  });

  afterEach(() => {
    moxios.uninstall();
  });

  it('returns a promise that resolves', (done) => {
    wrappedAxios.get('/foo', {
      chainedRequest: true,
      type: 'json'
    }).then((response) => {
      done();
    });
  });

  it('resolves with json from the stream', (done) => {
    wrappedAxios.get('/foo', {
      chainedRequest: true,
      type: 'json'
    }).then((response) => {
      assert.equal(response.data.foo, 'bar');
      done();
    });
  });

  it('pushes the response', (done) => {
    // regression test to make sure the apiResponse stream is pushed to the
    // client and read to string at the same time.
    // If one happens first, the stream will be used up and it will fail.
    wrappedAxios.get('/foo', {
      chainedRequest: true,
      type: 'json'
    });

    streamToString(pushResponse.stream).then((data) => {
      assert.equal(data, '{"foo": "bar"}');
      done();
    });
  });


  describe('Waiting for chained requests to complete', () => {
    let waitForChainedPromise;

    beforeEach(() => {
      waitForChainedPromise = wrappedAxios.waitForChained();
    });

    it('waits for chained api calls when there aren’t any', (done) => {
      waitForChainedPromise.then(done);
    });

    it('resolves after .then() is called on the axios promise', (done) => {
      let thenCalled = false;

      wrappedAxios.get('/foo', { chainedRequest: true })
        .then(() => {
          thenCalled = true;
        });

      waitForChainedPromise.then(() => {
        assert.isOk(thenCalled);
        done();
      });
    });
  });

});
