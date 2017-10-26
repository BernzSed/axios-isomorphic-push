import getTargetAxios from './getTargetAxios';

export default function prepareAxios(pageResponse, axiosParam = null) {
  const axiosInstance = getTargetAxios(axiosParam);
  axiosInstance.whenSafeToEnd = () => Promise.resolve();
  return axiosInstance;
}
