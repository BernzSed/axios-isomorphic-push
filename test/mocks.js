export function mockAxios() {
  function axios() {}
  axios.request = () => {};
  axios.get = () => {};
  axios.post = () => {};
  axios.put = () => {};
  axios.patch = () => {};
  axios.delete = () => {};
  axios.head = () => {};
  axios.interceptors = {
    request: mockAxiosInterceptor(),
    response: mockAxiosInterceptor()
  };
  axios.defaults = {};

  return axios;
}

export function mockAxiosInterceptor() {
  const interceptor = {
    fulfilled: [],
    rejected: [],
    use: (fulfilled, rejected) => {
      if (fulfilled) {
        interceptor.fulfilled.push(fulfilled);
      }
      if (rejected) {
        interceptor.rejected.push(rejected);
      }
    }
  };
  return interceptor;
}

export function mockServerResponse() {
  const serverResponse = {
    createPushResponse(headers, callback) {},
    stream: {
      pushAllowed: true
    },
    writeHead() {}
  };
  return serverResponse;
}
