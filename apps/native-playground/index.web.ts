import { AppRegistry } from 'react-native';

import App from './App';

AppRegistry.registerComponent('main', () => App);

const rootTag = document.getElementById('root');

if (!rootTag) {
  throw new Error('Required HTML element with id "root" was not found.');
}

// React Native Web mounts into an HTMLElement. React Native 0.88's native
// AppRegistry declaration instead types rootTag as an opaque native symbol.
// Keep the existing web runtime behavior; bridge only this platform boundary.
type NativeRootTag = Parameters<typeof AppRegistry.runApplication>[1]['rootTag'];

AppRegistry.runApplication('main', {
  rootTag: rootTag as unknown as NativeRootTag,
});
