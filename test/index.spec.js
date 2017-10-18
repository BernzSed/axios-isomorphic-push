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
    axios = mockAxios({
      headers: {
        'X-Axios-Defaults-Header': 'headers',
        common: {
          'X-Axios-Defaults-Common-Header': 'common'
        },
        get: {
          'X-Axios-Defaults-GET-Header': 'get'
        }
      }
    });
    pageResponse = mockServerResponse();
  });

  it('calls axios.request() with the right url', () => {
    let requestConfig = null;
    const oldRequest = axios.request;
    axios.request = function mockRequest(config) {
      requestConfig = config;
      oldRequest(config);
      return new Promise(() => {});
    };

    const wrappedAxios = prepareAxios(pageResponse, axios);
    wrappedAxios.get('http://www.example.com/api/foo');

    assert.equal(requestConfig.url, 'http://www.example.com/api/foo');
  });

  describe('and sending a push promise', () => {
    let pushHeaders;
    let wrappedAxios;
    beforeEach(() => {
      pageResponse.createPushResponse = (headers, callback) => {
        pushHeaders = headers;
      };
      wrappedAxios = prepareAxios(pageResponse, axios);
    });

    it('makes a push promise with the right path', () => {
      wrappedAxios.get('http://www.example.com/api/foo');
      assert.equal(pushHeaders[':path'], '/api/foo');
    });

    it('defaults :scheme to https, when url is relative', () => {
      wrappedAxios.get('/api/foo');
      assert.equal(pushHeaders[':scheme'], 'https');
    });

    it('takes the scheme from the url', () => {
      wrappedAxios.get('gopher://www.example.com/api/foo');
      assert.equal(pushHeaders[':scheme'], 'gopher');
    });

    it('sends request headers from axios defaults', () => {
      wrappedAxios.get('/foo');
      assert.equal(pushHeaders['X-Axios-Defaults-Header'], 'headers');
    });
    it('sends request headers from axios defaults.headers.common', () => {
      wrappedAxios.get('/foo');
      assert.equal(pushHeaders['X-Axios-Defaults-Common-Header'], 'common');
    });
    it('sends request headers from axios defaults.headers.get', () => {
      wrappedAxios.get('/foo');
      assert.equal(pushHeaders['X-Axios-Defaults-GET-Header'], 'get');
    });
  });

  it('doesn’t request without an http2 stream', () => {
    delete pageResponse.stream;
    axios.request = sinon.spy();
    const wrappedAxios = prepareAxios(pageResponse, axios);
    wrappedAxios('/api/foo');
    expect(axios.request).to.have.not.been.called;
  });

  it('doesn’t request when the stream can’t push', () => {
    pageResponse.stream.pushAllowed = false;
    axios.request = sinon.spy();
    const wrappedAxios = prepareAxios(pageResponse, axios);
    wrappedAxios('/api/foo');
    expect(axios.request).to.have.not.been.called;
  });

  it('doesn’t request with a POST', () => {
    axios.request = sinon.spy();
    const wrappedAxios = prepareAxios(pageResponse, axios);
    wrappedAxios.post('/api/foo', 'blahblahblah');
    expect(axios.request).to.have.not.been.called;
  });
});

describe('When sending a push promise', () => {
  let axios;
  let axiosRequestConfig;
  let pageResponse;
  let wrappedAxios;
  let createPushResponseCallback; // args: (error, pushResponse)

  let responseInterceptor;
  let responseRejectedInterceptor;
  let apiResponse;

  beforeEach(() => {
    axios = mockAxios();
    axios.request = (config) => {
      axiosRequestConfig = config;
      return new Promise(() => {});
    };
    pageResponse = mockServerResponse();
    pageResponse.createPushResponse = (headers, callback) => {
      createPushResponseCallback = callback;
    };
    wrappedAxios = prepareAxios(pageResponse, axios);

    wrappedAxios.get('/endpoint');

    [responseInterceptor] = axios.interceptors.response.fulfilled;
    [responseRejectedInterceptor] = axios.interceptors.response.rejected;

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

  it('cancels the api request if the push promise failed', () => {
    createPushResponseCallback(new Error('ERR_HTTP2_STREAM_CLOSED'));
    responseInterceptor(apiResponse);
    assert.isOk(apiResponse.config.cancelToken.reason);
  });

  describe('and pushing an api response', () => {
    let pushResponse;

    beforeEach(() => {
      pushResponse = mockServerResponse();
      createPushResponseCallback(null, pushResponse);
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

    it('excludes unwanted response headers', (done) => {
      pushResponse.writeHead = (status, headers) => {
        assert.isUndefined(headers.Connection);
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

    it('cancels the api request if the push stream closes', () => {
      pushResponse.emit('close');
      assert.isOk(apiResponse.config.cancelToken.reason);
    });

    it('doesn’t cancel the ai request if everything is fine', (done) => {
      apiResponse.data.pipe = function pipe(destination) {
        assert.isNotOk(apiResponse.config.cancelToken.reason);
        done();
      };
      responseInterceptor(apiResponse);
    });

    describe('when the api has error', () => {
      let error;
      beforeEach(() => {
        error = {
          code: 234,
          errno: 234,
          syscall: null,
          hostname: 'example.com',
          host: 'example.com',
          port: 80,
          config: axiosRequestConfig,
          response: apiResponse
        };
      });

      it('responds with the error response status code', (done) => {
        pushResponse.writeHead = (status, headers) => {
          assert.equal(status, 502);
          done();
        };

        apiResponse.status = 502;
        responseRejectedInterceptor(error).catch(() => {});
      });

      it('closes the stream if there was an error with no returnable response', (done) => {
        pushResponse.stream.destroy = () => {
          done();
        };

        error.response = null;
        responseRejectedInterceptor(error).catch(() => {});
      });
    });
  });
});
