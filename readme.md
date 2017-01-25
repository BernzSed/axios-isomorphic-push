# Axios-Isomorphic-Push

Improve the performance of your isomorphic React websites by pushing API responses to the client before they even request them.

### Example:

Create an isomorphic React website with Redux.

In this example, componentWillMount() runs twice; once on the client and once on the server.

Use the [spdy library](https://github.com/indutny/node-spdy), which supports HTTP/2 and is compatible with express.

```js
import * as spdy from 'spdy';
import thunk from 'redux-thunk'
import prepareAxios from '@bernzsed/axios-isomorpic-push'

const options = {
  key: fs.readFileSync('./server.key'),
  cert: fs.readFileSync('./server.crt')
};
const app = express();

const server = spdy.createServer(options, app);

app.use((request, response) => {
  const axios = prepareAxios(response);
  const reducer = combineReducers(reducers);
  const store = createStore(reducer, applyMiddleware(thunk.withExtraArgument(axios)));

	// [...] more react stuff here
}
```

In your redux action action:

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
