export default function emptyPromise() {
  console.log('emptyPromise()');
  const ep = new Promise(() => {});
  ep.empty = true;
  return ep;
}
