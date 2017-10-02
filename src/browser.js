import getTargetAxios from './getTargetAxios';

export default function prepareAxios(pageResponse, axiosParam = null) {
  return getTargetAxios(axiosParam);
}
