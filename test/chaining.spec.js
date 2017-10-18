// import { PassThrough } from 'stream'; // TODO test with a stream
import chai, { assert, expect } from 'chai';
import sinonChai from 'sinon-chai';
import sinon from 'sinon';
import axios from 'axios';
var MockAxiosAdapter = require('axios-mock-adapter');
import prepareAxios from '../src';

import {
  mockAxios,
  mockServerResponse,
  mockAxiosResponse,
  mockStream
} from './mocks';

chai.use(sinonChai);


describe('Chained requests', () => {

  let mockAxios;
  let pageResponse;
  let wrappedAxios;

  beforeEach(() => {
    const actualAxios = axios.create();
    mockAxios = new MockAxiosAdapter(actualAxios);
    mockAxios.onGet('/foo').reply(200, {
      foo: 'bar'
    }, {
      'X-HEADER-NAME': 'header_value'
    });

    pageResponse = mockServerResponse();

    wrappedAxios = prepareAxios(pageResponse, actualAxios);
  });

  it('return a promise that fulfills', (done) => {
    wrappedAxios.get('/foo', {
      chainedRequest: true,
      type: 'json'
    }).then((response) => {
      done();
    });
  });
});
