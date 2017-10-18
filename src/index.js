import url from 'url';
import { CancelToken } from 'axios';
import streamToString from 'stream-to-string';
import isAbsoluteUrl from 'axios/lib/helpers/isAbsoluteURL';
import combineURLs from 'axios/lib/helpers/combineURLs';
import { merge } from 'axios/lib/utils';
import getTargetAxios from './getTargetAxios';
import filterResponseHeaders from './filterResponseHeaders';
import emptyPromise from './emptyPromise';

const pushableMethods = ['GET']; // TODO can I push_promise HEAD?

function canPush(pageResponse, requestURL, config) {
  return pageResponse.stream && pageResponse.stream.pushAllowed &&
    pushableMethods.includes(config.method.toUpperCase());
  // TODO also check domain
  // TODO don't push the same thing multiple times
}

// TODO should also give the option to disable all push requests and
//    instead just make requests as normal (for pre-rendering the html)
//    or ignore all requests (for after the response has been sent).

function getRequestConfig(params, method, hasData, targetAxios) {
  const paramsConfig = hasData ?
    getRequestConfigWithData(method, params) :
    getRequestConfigWithoutData(method, params);

  // TODO maybe don't use so many internal functions from axios/lib
  return merge(targetAxios.defaults, paramsConfig);
}

// for request that contain no data (GET, HEAD, DELETE)
function getRequestConfigWithoutData(method, [arg1, arg2]) {
  if (typeof arg1 === 'string') {
    const config = { ...arg2 };
    config.url = arg1;
    config.method = method || config.method || 'GET';
    return config;
  } else {
    return arg1;
  }
}
// for requests that contain data (POST, PUT)
function getRequestConfigWithData(method, [arg1, arg2, arg3]) {
  if (typeof arg1 === 'string') {
    const config = { ...arg3 };
    config.url = arg1;
    config.method = method || config.method || 'POST';
    return config;
  } else {
    return arg2 || arg1;
  }
}

function getWord(str) {
  const result = str && /\w+/.exec(str);
  return result && result[0];
}

function getRequestHeaders(config, requestURL) {
  const requestHeaders = {
    ...(config.headers || {}).common,
    ...(config.headers || {})[config.method],
    ...config.headers,
    ':path': requestURL.path,
    ':authority': requestURL.host,
    ':method': config.method.toUpperCase(),
    ':scheme': getWord(requestURL.protocol) || 'https'
  };

  // duplicating axios's internal logic from /lib/core/dispatchRequest.js
  ['delete', 'get', 'head', 'post', 'put', 'patch', 'common']
    .forEach(function cleanHeaderConfig(method) {
      delete requestHeaders[method];
    });

  return requestHeaders;
}

/**
 * Wraps axios in something that will monitor requests/responses and
 * will issue push promises
 * @param {pageResponse} http2.Http2ServerResponse
 * @param {axiosParam} (optional) instance of axios, or axios config object
 * @return {object} returns an axios instance that will issue push promises automatically.
 */
export default function prepareAxios(pageResponse, axiosParam = null) {
  const targetAxios = getTargetAxios(axiosParam);

  if (global.window || !pageResponse) {
    // don't wrap it if on client side
    return targetAxios;
  }

  // Unfortunately, we can't use a real request interceptor.
  // Axios doesn't call its request interceptors immediately, so the
  // page response stream could close before we have a chance to send
  // the push promise.
  // This is why we have to wrap axios instead of just adding interceptors.

  function interceptRequest(params, method, hasData) {
    const config = getRequestConfig(params, method, hasData, targetAxios);

    const baseURL = config.baseURL || targetAxios.defaults.baseURL;
    const requestURLString = baseURL && !isAbsoluteUrl(config.url) ?
      combineURLs(baseURL, config.url) :
      config.url;
    const requestURL = url.parse(requestURLString);

    if (canPush(pageResponse, requestURL, config)) {
      // issue a push promise, with correct authority, path, and headers.
      // http/2 pseudo headers: :method, :path, :scheme, :authority
      const requestHeaders = getRequestHeaders(config, requestURL);

      const cancelSource = CancelToken.source();
      // TODO if existing config.token, combine it with this one.

      const pushResponsePromise = new Promise((resolve) => {
        // TODO try to use the main pageResponse, but if it's already closed,
        //    use a different available response.
        pageResponse.createPushResponse(
          requestHeaders,
          (err, pushResponse) => {
            if (err) {
              // Can't reject the promise because nothing will catch() it.
              cancelSource.cancel('Push promise failed');
            } else {
              pushResponse.on('close', () => {
                // The browser sent RST_STREAM requesting to cancel.
                // You can get Chrome to send this by refreshing the
                // view-source: page at least once; it refuses duplicate pushes.
                cancelSource.cancel('Push stream closed');
              });
              resolve(pushResponse);
            }
          }
        );
      });

      const newConfig = {
        ...config,
        responseType: 'stream',
        originalResponseType: config.responseType || 'json',
        // TODO transformResponse ?
        cancelToken: cancelSource.token,
        pushResponsePromise
      };

      // return targetAxios.request(newConfig).catch(err => emptyPromise());
      return targetAxios.request(newConfig).catch((err) => {
        console.warn('axios-push ignoring error', err); // TODO delete line
        return emptyPromise();
      });
    } else {
      // return an empty promise that never resolves.
      return emptyPromise(); // TODO refactor multiple returns
    }
  }

  if (!targetAxios.usingIsomorphicPushInterceptors) {
    targetAxios.interceptors.response.use(
      responseInterceptor,
      responseRejectedInterceptor
    );
    targetAxios.usingIsomorphicPushInterceptors = true;
  }

  function axiosWrapper(...params) {
    return interceptRequest(params, null, false);
  }

  axiosWrapper.request = (...params) =>
    interceptRequest(params, null, false);
  axiosWrapper.get = (...params) =>
    interceptRequest(params, 'get', false);
  axiosWrapper.delete = (...params) =>
    interceptRequest(params, 'delete', false);
  axiosWrapper.head = (...params) =>
    interceptRequest(params, 'head', false);
  axiosWrapper.post = (...params) =>
    interceptRequest(params, 'post', true);
  axiosWrapper.put = (...params) =>
    interceptRequest(params, 'put', true);
  axiosWrapper.patch = (...params) =>
    interceptRequest(params, 'patch', true);

  // others
  axiosWrapper.all = targetAxios.all;
  axiosWrapper.spread = targetAxios.spread;
  axiosWrapper.interceptors = targetAxios.interceptors;
  axiosWrapper.defaults = targetAxios.defaults;

  axiosWrapper.targetAxios = targetAxios;

  return axiosWrapper;
}

const responseDataConverters = {
  stream(data) {
    return data;
  },
  json(data) {
    return streamToString(data).then((str) => {
      try {
        return JSON.parse(str);
      } catch (err) {
        return str;
      }
    });
  },
  string(data) {
    return streamToString(data);
  }
};

// TODO a lot of this should be moved into its own file.
function shouldBeChained(config) {
  return chainedRequestWanted(config) && canReturnResponse(config);
}
function chainedRequestWanted(config) {
  if (typeof config.chainedRequest === 'function') {
    return config.chainedRequest();
  } else {
    return config.chainedRequest;
  }
}
function canReturnResponse(config) {
  return !!responseDataConverters[config.originalResponseType];
}

function sendResponse(pushResponse, apiResponse, isChained) {
  if (isChained) {
    setTimeout(sendResponseNow, 100, pushResponse, apiResponse);
    // TODO save pushResponse for later so chained pushes can be made.
    //      (Maybe keep an array of them?)
  } else {
    sendResponseNow(pushResponse, apiResponse);
  }
}
function sendResponseNow(pushResponse, apiResponse) {
  const { status, data } = apiResponse;
  const headers = filterResponseHeaders(apiResponse.headers);

  pushResponse.writeHead(status, headers);
  if (data && data.pipe) {
    data.pipe(pushResponse);
  } else {
    pushResponse.end(data);
  }
}

function convertToOriginalResponseType(response) {
  const { originalResponseType } = response.config;
  const convertData = responseDataConverters[originalResponseType];
  if (convertData) {
    return convertData(response.data).then(data => ({
      // TODO this won't work if response is a class instance. Double check that.
      ...response,
      data,
      config: {
        ...response.config,
        responseType: originalResponseType
      }
    }));
    // TODO transformResponse ?
  } else {
    return emptyPromise();
  }
}

function responseInterceptor(response) {
  // response = { status, statusText, headers, config, request, data }
  // response.config = { adapter, transformRequest, transformResponse,
  //    timeout, xsrfCookieName, xsrfHeaderName, maxContentLength,
  //    validateStatus, headers, method, url, data }
  const { config } = response;

  const isChained = shouldBeChained(config);
  if (config.pushResponsePromise) {
    config.pushResponsePromise.then((pushResponse) => {
      if (pushResponse) {
        sendResponse(pushResponse, response, isChained);
      }
    });
  }

  return isChained ? convertToOriginalResponseType(response) : emptyPromise();
}

function responseRejectedInterceptor(error) {
  // { code, errno, syscall, hostname, host, port, config, response } = error
  const { config, code, response } = error;
  if (config && config.pushResponsePromise) {
    config.pushResponsePromise.then((pushResponse) => {
      if (response && response.data) {
        sendResponse(pushResponse, response, false);
      } else {
        pushResponse.stream.destroy(code);
      }
    });
  }
  return Promise.reject(error);
}
