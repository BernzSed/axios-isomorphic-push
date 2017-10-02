import axios from 'axios';
import url from 'url';
import omit from 'object.omit';
import isAbsoluteUrl from 'axios/lib/helpers/isAbsoluteURL';
import combineURLs from 'axios/lib/helpers/combineURLs';

const pushableMethods = ['GET']; // TODO can I push_promise HEAD?

// these are from isIllegalConnectionSpecificHeader(),
//  in nodejs /lib/internal/http2/util.js
const illegalConnectionSpecificHeaders = [
  // http2.constants.HTTP2_HEADER_CONNECTION,
  // http2.constants.HTTP2_HEADER_UPGRADE,
  // http2.constants.HTTP2_HEADER_HOST,
  // http2.constants.HTTP2_HEADER_HTTP2_SETTINGS,
  // http2.constants.HTTP2_HEADER_KEEP_ALIVE,
  // http2.constants.HTTP2_HEADER_PROXY_CONNECTION,
  // http2.constants.HTTP2_HEADER_TRANSFER_ENCODING,
  // http2.constants.HTTP2_HEADER_TE
  'connection',
  'upgrade',
  'host',
  'http2-settings',
  'keep-alive',
  'proxy-connection',
  'transfer-encoding',
  'te' // TODO that's not illegal for trailers. Does piping the stream like I did send trailers? Need to test that.
]; // TODO should probably move that to its own file

function canPush(pageResponse, requestUrl, config) {
  return pageResponse.stream && pageResponse.stream.pushAllowed &&
    pushableMethods.includes(config.method.toUpperCase());
  // TODO also check domain
  // TODO don't push the same thing multiple times
}

// TODO should also give the option to disable all push requests and
//    instead just make requests as normal (for pre-rendering the html)
//    or ignore all requests (for after the response has been sent).

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

function getTargetAxios(axiosParam) {
  if (axiosParam && axiosParam.create) {
    // axiosParam is the global axios instance.
    return axiosParam.create();
  } else if (typeof axiosParam === 'function' && axiosParam.get) {
    // axiosParam is already an instance of axios.
    return axiosParam;
  } else {
    // axiosParam is either null or a config object.
    return axios.create(axiosParam);
  }
}

function getWord(str) {
  const result = /\w+/.exec(str);
  return result ? result[0] : null;
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


  function interceptRequest(params, method, hasData) {
    const config = hasData ?
      getRequestConfigWithData(method, params) :
      getRequestConfigWithoutData(method, params);

    const baseURL = targetAxios.defaults.baseURL || config.baseURL;
    const requestURLString = baseURL && !isAbsoluteUrl(config.url) ?
      combineURLs(baseURL, config.url) :
      config.url;
    const requestUrl = url.parse(requestURLString);

    if (canPush(pageResponse, requestUrl, config)) {
      // issue a push promise, with correct authority, path, and headers.
      // http/2 pseudo headers: :method, :path, :scheme, :authority
      const requestHeaders = {
        ...config.headers,
        ':path': requestUrl.path,
        ':authority': requestUrl.host,
        ':method': config.method.toUpperCase(),
        ':scheme': getWord(url.protocol) || 'https'
      }; // TODO exclude unneeded headers like user-agent

      const pushResponsePromise = new Promise((resolve, reject) => {
        pageResponse.createPushResponse(
          requestHeaders,
          (err, pushResponse) => {
            // Node docs don't mention these params. Bad Node. No cookie for you.
            if (err) {
              reject(err);
            } else {
              resolve(pushResponse);
            }
          }
        );
      });

      const newConfig = {
        ...config,
        responseType: 'stream',
        pushResponsePromise
      };

      targetAxios.request(newConfig);
      // TODO should the resulting promise be returned?
      //  Currently, I can't, because data is always a stream,
      //  but returning it could be useful for pushing any follow-up api calls
    }
    // return an empty promise that never resolves.
    const emptyPromise = new Promise(() => {});
    emptyPromise.empty = true;
    return emptyPromise;
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

function responseInterceptor(response) {
  // response = { status, statusText, headers, config, request, data }
  // response.config = { adapter, transformRequest, transformResponse,
  //    timeout, xsrfCookieName, xsrfHeaderName, maxContentLength,
  //    validateStatus, headers, method, url, data }
  const { config } = response;

  if (config.pushResponsePromise) {
    config.pushResponsePromise.then((pushResponse) => {
      const headers = omit(response.headers, illegalConnectionSpecificHeaders);
      // TODO that should be case-insensitive (use filter-values)

      pushResponse.writeHead(response.status, headers);
      response.data.pipe(pushResponse);
    });
  }
  return response;
}

function responseRejectedInterceptor(error) {
  // { code, errno, syscall, hostname, host, port, config, response } = error
  const { config, code } = error;
  if (config.pushResponsePromise) {
    config.pushResponsePromise.then((pushResponse) => {
      pushResponse.stream.destroy(code);
      // TODO Actually respond with the error response, if possible?
      // TODO avoid duplicating code between responseInterceptor and responseRejectedInterceptor
    });
  }
  return Promise.reject(error);
}
