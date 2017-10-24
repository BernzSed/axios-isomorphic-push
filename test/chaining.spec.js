import { PassThrough } from 'stream';
import chai, { assert } from 'chai';
import sinonChai from 'sinon-chai';
import axios from 'axios';
import moxios from 'moxios';
import prepareAxios from '../src';
import { mockServerResponse } from './mocks';

chai.use(sinonChai);


describe('Chained requests', () => {

  let pageResponse;
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

  it.skip('resolves a promise once chained calls have completed', (done) => {
    // TODO
  });

});
