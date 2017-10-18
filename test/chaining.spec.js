// import { PassThrough } from 'stream'; // TODO test with a stream
import chai, { assert, expect } from 'chai';
import sinonChai from 'sinon-chai';
import axios from 'axios';
import MockAxiosAdapter from 'axios-mock-adapter';
import prepareAxios from '../src';
import { mockServerResponse } from './mocks';

chai.use(sinonChai);


describe('Chained requests', () => {

  let axiosMock;
  let pageResponse;
  let wrappedAxios;

  beforeEach(() => {
    const actualAxios = axios.create();
    axiosMock = new MockAxiosAdapter(actualAxios);
    axiosMock.onGet('/foo').reply(200, {
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
