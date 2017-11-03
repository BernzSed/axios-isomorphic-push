import { merge } from 'axios/lib/utils';

// for request that contain no data (GET, HEAD, DELETE)
function getInitialConfigWithoutData(method, [arg1, arg2]) {
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
function getInitialConfigWithData(method, [arg1, arg2, arg3]) {
  if (typeof arg1 === 'string') {
    const config = { ...arg3 };
    config.url = arg1;
    config.method = method || config.method || 'POST';
    return config;
  } else {
    return arg2 || arg1;
  }
}
export default function getInitialConfig(params, method, hasData, targetAxios) {
  const paramsConfig = hasData ?
    getInitialConfigWithData(method, params) :
    getInitialConfigWithoutData(method, params);

  // TODO maybe don't use so many internal functions from axios/lib
  return merge(targetAxios.defaults, paramsConfig);
}
