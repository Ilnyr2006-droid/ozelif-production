import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
const html = readFileSync(new URL('./index.html', import.meta.url), 'utf8');
const match = html.match(/<script>([\s\S]*?)<\/script>/);
assert(match, 'stage2 html must have an inline script');

function load(hostname, shared = new Map()) {
  const elements = { send: { disabled: true, handlers: {}, addEventListener(event, listener) {
    this.handlers[event] = listener;
  } }, status: { textContent: '' } };
  const tags = [];
  const document = {
    getElementById: key => elements[key],
    createElement: tag => ({ tag }),
    head: { appendChild: tag => tags.push(tag) }
  };
  const storage = {
    getItem: key => shared.get(key) ?? null,
    setItem: (key, value) => shared.set(key, value)
  };
  const window = {};
  runInNewContext(match[1], {
    document, window, localStorage: storage,
    location: { hostname, protocol: 'https:' },
    crypto: { getRandomValues(arr) { for(let i = 0; i < arr.length; i++) arr[i]=i; return arr; } }
  });
  return { window, elements, tags, shared };
}
test('staging page pins the only permissible independent counter and goal', () => {
  assert.match(html, /113963518/);
  assert.match(html, /677252576/);
  assert.match(html, /ozelif_stage2_test_order_created/);
  assert.doesNotMatch(html,/112275551|609951402|112275468/);
});
test('production and arbitrary hosts cannot initialize or send goals', () => {
  for(const host of ['ozelifkoja.ru','www.ozelifkoja.ru','example.org']) {
    const page=load(host);
    assert.equal(page.tags.length,0);
    assert.equal(page.elements.send.disabled,true);
    assert.match(page.elements.status.textContent,/ЗАПРЕТ/);
  }
});
test('one browser click claims a random ref and queues exactly one goal', () => {
  const page=load('stage2-test.ozelifkoja.ru');
  assert.equal(page.tags.length,1);
  assert.equal(page.elements.send.disabled,true);
  page.tags[0].onload();
  assert.equal(page.elements.send.disabled,false);
  assert.match(page.tags[0].src,/^https:\/\/mc\.yandex\.ru\/metrika\/tag\.js\?id=113963518$/);
  page.elements.send.handlers.click();
  page.elements.send.handlers.click();
  const calls=page.window.ym.a;
  const goals=calls.filter(entry => entry[1]==='reachGoal');
  assert.equal(goals.length,1);
  assert.equal(goals[0][0],113963518);
  assert.equal(goals[0][2],'ozelif_stage2_test_order_created');
  assert.match(goals[0][3].ozelif_order_ref,/^[0-9a-f]{32}$/);
  const record=JSON.parse(page.shared.get('ozelif:stage2-test:one-goal:113963518:677252576'));
  assert.equal(record.order_ref,goals[0][3].ozelif_order_ref);
  assert.equal(record.goal_id,677252576);
});
test('reload in same browser cannot queue a second goal', () => {
  const shared=new Map();
  const first=load('stage2-test.ozelifkoja.ru',shared);
  first.tags[0].onload();
  first.elements.send.handlers.click();
  const second=load('stage2-test.ozelifkoja.ru',shared);
  assert.equal(second.elements.send.disabled,true);
  assert.equal(second.tags.length,0);
  assert.equal(second.window.ym,undefined);
});
test('both official CDN URLs must fail before script aborts without goal', () => {
  const page=load('stage2-test.ozelifkoja.ru');
  assert.equal(page.elements.send.disabled,true);
  page.tags[0].onerror();
  assert.equal(page.tags.length,2);
  assert.match(page.tags[1].src,/^https:\/\/mc\.yandex\.com\/metrika\/tag\.js\?id=113963518$/);
  assert.equal(page.elements.send.disabled,true);
  page.tags[1].onerror();
  assert.equal(page.elements.send.disabled,true);
  assert.match(page.elements.status.textContent,/Не удалось загрузить/);
});
test('the official alternative CDN enables sending only after successful load',()=>{
  const page=load('stage2-test.ozelifkoja.ru');
  page.tags[0].onerror();
  page.tags[1].onload();
  assert.equal(page.elements.send.disabled,false);
  page.elements.send.handlers.click();
  assert.equal(page.window.ym.a.filter(entry=>entry[1]==='reachGoal').length,1);
});
