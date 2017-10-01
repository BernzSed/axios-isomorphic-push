# Axios-Isomorphic-Push

A wrapper around Axios that will improve the performance of your isomorphic websites by pushing API responses to the client.

### About isomorphic websites:
Isomorphic websites run on both the server and client, doing much of the initial work on the server side so the user doesn’t have to wait for multiple request/response round-trips.

By running client-side code on the server first, we can find out exactly what API requests the client will make, and make those requests on the server first.

### About push promises:
Push promises are a feature of HTTP/2. When serving a webpage, the server can also promise to send other related files (like css, js, images, or even api calls), so the client doesn't have to request them.  
[More info](https://en.wikipedia.org/wiki/HTTP/2_Server_Push)

## Usage

`import prepareAxios from 'axios-isomorphic-push'`.

Call it just before server-side rendering. The function takes two arguments:

`prepareAxios(response, [axios])`

- `response` – [`<Http2ServerResponse>`](https://nodejs.org/api/http2.html#http2_class_http2_http2serverresponse) for the currently rendering webpage.
- `axios` – (Optional) Either an instance of axios created by `axios.create()`, or a [config object](https://github.com/axios/axios#creating-an-instance) to pass into `axios.create()`.

On the client side, simply use `axios.create()` instead.

## Example:

This is an example of an isomorphic React website.

In this example, componentWillMount() runs twice; once on the client and once on the server. However, the API call is only made once, because the browser will use the pushed data instead.

```js
import http2 from 'http2';
import thunk from 'redux-thunk'
import prepareAxios from 'axios-isomorphic-push'

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
}
```

If using Redux, you can use redux-thunk's `withExtraArgument` function.

```js
export function getThing(id) {
  return (dispatch, getState, axios) => {
    axios.get('/api/things/' + id).then(
      (thing) => dispatch(putThingInStore(thing)),
      (error) => dispatch(couldNotGetThing(error))
    );
  }
}
```

Call the action from inside componentWillMount, as usual:

```js
class MyComponent extends Component {
  componentWillMount() {
    this.props.dispatch(
      getThing(this.props.thingId)
    );
  }
}
```

### What if I'm not using redux?
This is just one example. You could also place the axios instance in [React context](https://facebook.github.io/react/docs/context.html) instead.

## Caveats

While browsers do accept push promises of static resources from domains that share the same security certificate, no major browser currently accepts push promises of XHR requests from a different domain.

The http2 spec does allow for this, however, so long as both domains use the same security certificate. Hopefully browser behavior will soon change to match the spec.

##### What this means:

If your website is at `www.example.com`, today's browsers won't accept push promises for `api.example.com`.

##### The simple workaround:

Simply use `www.example.com/api`.  
If your api is at `api.example.com`, forward requests from `www.example.com/api/<stuff>` to `api.example.com/<stuff>`. (Do this on the server side, NOT by using 3xx redirects.)

### Notes
 - To test this on localhost, you may have to set `process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"` so node will connect to your own local server via TLS. *DO NOT DO THIS IN PRODUCTION.*

 - This will work with Node.js v9, and currently works with Node.js v8.5.0 or greater with the `--enable-http2` flag.
