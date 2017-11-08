import url from 'url';
import { CancelToken } from 'axios';
import isAbsoluteUrl from 'axios/lib/helpers/isAbsoluteURL';
import combineURLs from 'axios/lib/helpers/combineURLs';

const pushableMethods = ['GET'];

function getRequestURL(config) {
  const { baseURL } = config;
  // TODO don't use so many internal functions from axios/lib
  const requestURLString = baseURL && !isAbsoluteUrl(config.url) ?
    combineURLs(baseURL, config.url) :
    config.url;
  return url.parse(requestURLString);
}

function canPush(pageResponse, requestURL, config) {
  return pageResponse &&
    !pageResponse.finished &&
    pageResponse.stream &&
    pageResponse.stream.pushAllowed &&
    pushableMethods.includes(config.method.toUpperCase());
  // TODO also check domain
  // TODO don't push the same thing multiple times. Browser will send RST_STREAM
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

function sendPushPromise(pageResponse, requestHeaders, cancelSource) {
  return new Promise((resolve) => {
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
}

export default function buildRequestConfig(
  config,
  pageResponse,
  chainedResponses
) {
  const requestURL = getRequestURL(config);

  if (canPush(pageResponse, requestURL, config)) {
    // issue a push promise, with correct authority, path, and headers.
    // http/2 pseudo headers: :method, :path, :scheme, :authority
    const requestHeaders = getRequestHeaders(config, requestURL);

    const cancelSource = CancelToken.source();
    // TODO if existing config.token, combine it with this one.

    const pushResponsePromise
      = sendPushPromise(pageResponse, requestHeaders, cancelSource);

    pushResponsePromise.then(pushResponse =>
      chainedResponses.add(pushResponse));

    const newConfig = {
      ...config,
      responseType: 'stream',
      originalResponseType: config.responseType || 'json',
      // TODO transformResponse ?
      cancelToken: cancelSource.token,
      pushResponsePromise
    };

    return newConfig;
  } else {
    return null;
  }

}
