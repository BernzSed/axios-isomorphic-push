import chai, { assert, expect } from 'chai';
import sinonChai from 'sinon-chai';
import sinon from 'sinon';
import prepareAxios from '../src';
import { mockAxios, mockServerResponse } from './mocks';

chai.use(sinonChai);


describe('Interceptors', () => {
  let axios;
  beforeEach(() => {
    axios = mockAxios();
  });

  it('adds an interceptor', () => {
    prepareAxios(mockServerResponse(), axios);
    assert.equal(axios.interceptors.response.fulfilled.length, 1);
  });

  it('doesn\'t add duplicate interceptors', () => {
    axios.interceptors.response.use = sinon.spy();
    prepareAxios(mockServerResponse(), axios);
    prepareAxios(mockServerResponse(), axios);
    // assert.fail()
    expect(axios.interceptors.response.use).to.have.been.calledOnce;
  });
});

describe('When making requests', () => {
  let axios;
  let pageResponse;

  beforeEach(() => {
    axios = mockAxios();
    pageResponse = mockServerResponse();
  });

  it('calls axios.request() with the right url', () => {
    let requestConfig = null;
    const oldRequest = axios.request;
    axios.request = function mockRequest(config) {
      requestConfig = config;
      oldRequest(config);
    };

    const wrappedAxios = prepareAxios(pageResponse, axios);
    wrappedAxios.get('http://www.example.com/api/foo');

    assert.equal(requestConfig.url, 'http://www.example.com/api/foo');
  });

  it('makes a push promise', () => {
    let pushedPath;
    pageResponse.createPushResponse = (headers, callback) => {
      pushedPath = headers[':path'];
    };

    const wrappedAxios = prepareAxios(pageResponse, axios);
    wrappedAxios.get('http://www.example.com/api/foo');

    assert.equal(pushedPath, '/api/foo');
  });
});
