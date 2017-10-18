export default function emptyPromise() {
  const ep = new Promise(() => {});
  ep.empty = true;
  return ep;
}
