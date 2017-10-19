import streamToString from 'stream-to-string';
import filterResponseHeaders from './filterResponseHeaders';
import emptyPromise from './emptyPromise';

function streamOrStringToString(data) {
  if (typeof data === 'string') {
    return Promise.resolve(data);
  } else {
    return streamToString(data);
  }
}

const responseDataConverters = {
  stream(data) {
    return data;
  },
  json(data) {
    return streamOrStringToString(data).then((str) => {
      try {
        return JSON.parse(str);
      } catch (err) {
        return str;
      }
    });
  },
  string(data) {
    return streamOrStringToString(data);
  }
};

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

export function responseInterceptor(response) {
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

export function responseRejectedInterceptor(error) {
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
