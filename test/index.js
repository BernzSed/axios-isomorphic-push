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

describe('When pushing a response', () => {
  let axios;
  let axiosRequestConfig;
  let pageResponse;
  let wrappedAxios;
  let createPushResponseCallback; // args: (error, pushResponse)
  let pushResponse;
  let responseInterceptor;
  let apiResponse;

  beforeEach(() => {
    axios = mockAxios();
    axios.request = (config) => {
      axiosRequestConfig = config;
    };
    pageResponse = mockServerResponse();
    pageResponse.createPushResponse = (headers, callback) => {
      createPushResponseCallback = callback;
    };
    wrappedAxios = prepareAxios(pageResponse, axios);

    wrappedAxios.get('/endpoint');

    pushResponse = mockServerResponse();
    createPushResponseCallback(null, pushResponse);

    [responseInterceptor] = axios.interceptors.response.fulfilled;

    const headers = {
      'Content-Length': '55',
      Connection: 'Keep-Alive',
      'keep-alive': 'timeout=5, max=1000',
      Server: 'super-awesome magical server'
    };
    apiResponse = mockAxiosResponse(
      mockStream(),
      headers,
      axiosRequestConfig
    );

  });

  it('sends a response', (done) => {
    pushResponse.writeHead = (status, headers) => {
      assert.equal(status, 200);
      done();
    };
    responseInterceptor(apiResponse);
  });

  it('sends the right response headers', (done) => {
    pushResponse.writeHead = (status, headers) => {
      assert.equal(headers.Server, 'super-awesome magical server');
      done();
    };
    responseInterceptor(apiResponse);
  });

  it.skip('excludes unwanted response headers', (done) => {
    pushResponse.writeHead = (status, headers) => {
      assert.isUndefined(headers.Connection);
      done();
    };
    responseInterceptor(apiResponse);
  });

  it.skip('converts Content-Length value into a number', (done) => {
    // This is needed by http/2
    pushResponse.writeHead = (status, headers) => {
      assert(headers['Content-Length'] === 55);
      done();
    };
    responseInterceptor(apiResponse);
  });

  it('pipes the api response to the push response', (done) => {
    apiResponse.data.pipe = function pipe(destination) {
      assert.equal(destination, pushResponse);
      done();
    };
    responseInterceptor(apiResponse);
  });
});
