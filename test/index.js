import { assert } from 'chai';
import prepareAxios from '../src'

describe('When making requests', () => {
  let mockAxios;

  beforeEach(() => {
    mockAxios = function() {}
    mockAxios.request = function mockRequest(config) {}
    mockAxios.interceptors = {
      response: {
        fulfilled: [],
        rejected: [],
        use: (fulfilled, rejected) => {
          if(fulfilled)
            mockAxios.interceptors.response.fulfilled.push(fulfilled);
          if(rejected)
            mockAxios.interceptors.response.rejected.push(rejected);

        }
      }
    }
  })

  it('calls axios.request() with the right url', () => {
    let requestConfig = null;
    var oldRequest = mockAxios.request;
    mockAxios.request = function(config) {
      requestConfig = config;
      oldRequest(config);
    }

    const wrappedAxios = prepareAxios(null, mockAxios);
    wrappedAxios.get('http://www.example.com/api/foo');

    assert.equal(requestConfig.url, 'http://www.example.com/api/foo');
  });

  it('makes a push promise', () => {
    let pushedPath;
    const pageRequest = {
      push(path, pushOptions) {
        pushedPath = path;
      }
    }

    const wrappedAxios = prepareAxios(pageRequest, mockAxios);
    wrappedAxios.get('http://www.example.com/api/foo');

    assert.equal(pushedPath, '/api/foo');
  });
});
