import { assert } from 'chai';
import prepareAxios from '../src';

describe('When making requests', () => {
  let mockAxios;
  let mockServerResponse;

  beforeEach(() => {
    mockAxios = function mockAxiosFn() {};
    mockAxios.request = () => {};
    mockAxios.get = () => {};
    mockAxios.post = () => {};
    mockAxios.put = () => {};
    mockAxios.patch = () => {};
    mockAxios.delete = () => {};
    mockAxios.head = () => {};
    mockAxios.interceptors = {
      response: {
        fulfilled: [],
        rejected: [],
        use: (fulfilled, rejected) => {
          if (fulfilled) {
            mockAxios.interceptors.response.fulfilled.push(fulfilled);
          }
          if (rejected) {
            mockAxios.interceptors.response.rejected.push(rejected);
          }
        }
      }
    };
    mockAxios.defaults = {};

    mockServerResponse = {
      createPushResponse(headers, callback) {
        return Promise.resolve(mockServerResponse);
      },
      stream: {
        pushAllowed: true
      }
    };

  });

  it('calls axios.request() with the right url', () => {
    let requestConfig = null;
    const oldRequest = mockAxios.request;
    mockAxios.request = function mockRequest(config) {
      requestConfig = config;
      oldRequest(config);
    };

    const wrappedAxios = prepareAxios(mockServerResponse, mockAxios);
    wrappedAxios.get('http://www.example.com/api/foo');

    assert.equal(requestConfig.url, 'http://www.example.com/api/foo');
  });

  it('makes a push promise', () => {
    let pushedPath;
    mockServerResponse.createPushResponse = (headers, callback) => {
      pushedPath = headers[':path'];
    };

    const wrappedAxios = prepareAxios(mockServerResponse, mockAxios);
    wrappedAxios.get('http://www.example.com/api/foo');

    assert.equal(pushedPath, '/api/foo');
  });
});
