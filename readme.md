# Axios-Push

[![npm version](https://img.shields.io/npm/v/axios-push.svg?style=flat)](https://www.npmjs.com/package/axios-push)
[![Build Status](https://travis-ci.org/BernzSed/axios-push.svg?branch=master)](https://travis-ci.org/BernzSed/axios-push)

A wrapper around Axios that will improve the performance of your isomorphic websites by pushing API responses to the client.

### About isomorphic websites:
Isomorphic websites run on both the server and client, doing much of the initial work on the server side so the user doesn’t have to wait for multiple request/response round-trips.

By running client-side code on the server first, we can find out exactly what API requests the client will make, and make those requests on the server first.

### About server push:
When serving a webpage over HTTP/2, the server can also promise to send other related files (like css, js, images, or even api calls), so the client doesn't have to request them.  
[More info](https://en.wikipedia.org/wiki/HTTP/2_Server_Push)

## Installation

`npm i --save axios-push`

## Usage

`import prepareAxios from 'axios-push';`

Call it just before server-side rendering. The function takes two arguments:

`const axios = prepareAxios(res, [axiosInit])`

- `res` – [`<Http2ServerResponse>`](https://nodejs.org/api/http2.html#http2_class_http2_http2serverresponse) for the currently rendering webpage.
- `axiosInit` – (Optional) Either an [Axios instance](https://github.com/axios/axios#creating-an-instance), or an Axios config object.

It returns an instance of Axios. Use it in place of `axios.create()` on the server side.

### Basic usage

Any API calls you make using axios-push are pushed to the client.

On the server side, all Axios functions return a promise that never resolves. This allows you to write your code as if it were client-side only.

```js
axios.get('/foo').then(response => { /* this block only runs on the client side */ });
```

### Chained API calls

If you want to chain API calls on the server side, add `chained: true` to the request config:

```js
axios.get('/foo', { chained: true })
  .then(response => axios.get(`/bar?fooId=${response.data.id}`))
  .then(response => { /* this block only runs on the client side */ });
```

You'll have to keep the page's response stream open a bit longer for chaining to work.

When server-side rendering, instead of this:

```js
res.end(html);
```
Use this:

```js
res.write(html);
axios.whenSafeToEnd().then(() => res.end());
```

## Example:

This is an example of an isomorphic React website. ([You can find a more complete example here.](https://github.com/BernzSed/axios-push-koa-redux-example))

`componentWillMount()` runs on both the client and the server. However, the browser does not call the API. It waits for the pushed data instead.

```js
import http2 from 'http2';
import thunk from 'redux-thunk'
import prepareAxios from 'axios-push';
import express from 'express';

const options = {
  key: fs.readFileSync('./server.key'),
  cert: fs.readFileSync('./server.crt'),
  allowHTTP1: true
};
const app = express();

const server = http2.createSecureServer(options, app);

app.use((request, response) => {
  const axios = prepareAxios(response);
  const reducer = combineReducers(reducers);
  const store = createStore(reducer, applyMiddleware(thunk.withExtraArgument(axios)));

  // [...] render and respond here
});
```

If using Redux, you can use redux-thunk's `withExtraArgument` function.
Your Redux action would look like this:

```js
export function getThing(id) {
  return (dispatch, getState, axios) => {
    axios.get(`/api/things/${id}`).then(
      (response) => dispatch(putThingInStore(response.data)),
      (error) => dispatch(couldNotGetThing(error))
    );
  };
}
```

Call the action from inside `componentWillMount()` in any component.

```js
class MyComponent extends Component {
  componentWillMount() {
    this.props.dispatch(
      getThing(this.props.thingId)
    );
  }
}
```

### What if I'm not using Redux?
This is just one example. You could also place the axios instance in [React context](https://facebook.github.io/react/docs/context.html) instead.

### Use in the browser
When bundled by webpack for use in a browser, `prepareAxios()` simply calls `axios.create()` and returns the instance.

### Use in Next.js

You can use this in [Next.js’s](https://github.com/zeit/next.js) `getInitialProps({ req, res })` function to create a wrapped axios instance for the page. In `componentWillMount`, make your api calls with the resulting axios instance if it exists, or create a new instance if it doesn't.

If using [next-redux-wrapper](https://github.com/kirill-konshin/next-redux-wrapper), you can create the axios instance in your `makeStore(initialState, { req, res })` callback function.

## Advantages

Other solutions, such as [redux-connect](https://www.npmjs.com/package/redux-connect) or [react-resolver](https://www.npmjs.com/package/react-resolver), delay the whole page response until all the API calls have been made. Server push has a few advantages over that:

- The browser receives HTML sooner and can begin fetching static content from a CDN immediately (if you're not also pushing that).
- It provides a better user experience by displaying some content, even if just a loading icon, as soon as possible.
- Greater flexibility of where in your code you make your API calls. This can result in cleaner code, and it's easier to add this library to existing code.

<a href="docs/sequence.png"><img src="docs/sequence.png" alt="A sequence diagram shows the advantage of using HTTP/2 push for api calls."/></a>

## Caveats

While browsers do accept push promises of static resources on other domains, no major browser currently accepts push promises for API endpoints on a different domain.

The http2 spec does allow for this, however, so long as both domains use the same security certificate. Hopefully browser behavior will soon change to match the spec.

##### What this means:

If your website is at `www.example.com`, today's browsers won't accept push promises for `api.example.com`.

##### The simple workaround:

Simply use `www.example.com/api`.  
If your api is at `api.example.com`, forward requests from `www.example.com/api/<stuff>` to `api.example.com/<stuff>`. (Do this on the server side, NOT by using 3xx redirects.)

### Notes
 - If you add a request interceptor, it may break something. Instead, consider using [axios instance defaults](https://github.com/axios/axios#custom-instance-defaults) for things like auth headers.

 - To test this on localhost, you may have to set `process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"` so node will connect to your own local server via TLS. *DO NOT DO THIS IN PRODUCTION.*

 - This works with Node.js v8.8.0 or greater, or Node.js v8.5.0 with the `--enable-http2` flag.
