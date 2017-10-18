import chai, { assert, expect } from 'chai';
import sinonChai from 'sinon-chai';
import sinon from 'sinon';
import prepareAxios from '../src';

import {
  mockAxios,
  mockServerResponse,
  mockAxiosResponse,
  mockStream
} from './mocks';

chai.use(sinonChai);


describe('Chained requests', () => {

  let axios;
  let pageResponse;
  let wrappedAxios;

  beforeEach(() => {
    axios = mockAxios();
    // TODO find a better mock axios. Like moxios, or axios-mock-adapter.

    pageResponse = mockServerResponse();

    wrappedAxios = prepareAxios(pageResponse, axios);

    wrappedAxios.get('/endpoint');
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
