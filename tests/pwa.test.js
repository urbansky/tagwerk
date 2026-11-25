import { test } from 'node:test';
import assert from 'node:assert/strict';

// pwa.js hängt sich beim Laden an Fenster-Events – in Node gibt es die nicht
globalThis.addEventListener ??= () => {};
const { platform } = await import('../public/js/pwa.js');

const UA = {
  iphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1',
  iphoneChrome: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/138.0 Mobile/15E148 Safari/604.1',
  ipad: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Safari/605.1.15',
  macSafari: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Safari/605.1.15',
  macChrome: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
  macEdge: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36 Edg/138.0.0.0',
  macFirefox: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:140.0) Gecko/20100101 Firefox/140.0',
  android: 'Mozilla/5.0 (Linux; Android 15; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Mobile Safari/537.36',
  androidFirefox: 'Mozilla/5.0 (Android 15; Mobile; rv:140.0) Gecko/140.0 Firefox/140.0',
};

test('Geräteerkennung für die Installationsanleitung', () => {
  assert.equal(platform(UA.iphone, 5), 'ios');
  assert.equal(platform(UA.iphoneChrome, 5), 'ios');
  assert.equal(platform(UA.ipad, 5), 'ios', 'iPadOS meldet sich als Mac, hat aber Touch');
  assert.equal(platform(UA.macSafari, 0), 'mac-safari');
  assert.equal(platform(UA.macChrome, 0), 'chromium');
  assert.equal(platform(UA.macEdge, 0), 'chromium');
  assert.equal(platform(UA.macFirefox, 0), 'firefox');
  assert.equal(platform(UA.android, 5), 'android');
  assert.equal(platform(UA.androidFirefox, 5), 'android-firefox');
});
