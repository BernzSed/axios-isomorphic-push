import axios from 'axios';

export default function getTargetAxios(axiosParam) {
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
