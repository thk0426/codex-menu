const assert = require('node:assert/strict');

const base = (process.env.CLOUDFLARE_TEST_URL || 'http://127.0.0.1:8788').replace(/\/$/, '');

async function request(path, { token, body, expected = 200 } = {}) {
  const response = await fetch(`${base}${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(body === undefined ? {} : { 'content-type': 'application/json' })
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const contentType = response.headers.get('content-type') || '';
  const value = contentType.includes('application/json') ? await response.json() : await response.text();
  assert.equal(response.status, expected, `${path}: ${JSON.stringify(value)}`);
  return value;
}

async function main() {
  const home = await request('/');
  assert.match(home, /心动菜单/);
  assert.match(await request('/shared/model.js'), /番茄炒鸡蛋/);
  assert.equal((await request('/api/health')).runtime, 'cloudflare-workers');

  const host = await request('/api/rooms', { body: { clientId: 'cloudflare-host-01' } });
  assert.equal(host.person, 'a');
  assert.equal(host.room.dishes[0].price, 0);
  assert.equal('members' in host.room, false);

  await request(`/api/rooms/${host.room.id}/actions`, {
    token: host.token,
    body: { type: 'mode', value: 'remote' }
  });
  const guest = await request('/api/join', { body: { code: host.room.code, clientId: 'cloudflare-guest-01' } });
  assert.equal(guest.person, 'b');
  assert.equal(guest.room.joined, true);

  await Promise.all([
    request(`/api/rooms/${host.room.id}/actions`, {
      token: host.token,
      body: { type: 'vote', person: 'a', id: 'd13', value: 'yes' }
    }),
    request(`/api/rooms/${host.room.id}/actions`, {
      token: guest.token,
      body: { type: 'vote', person: 'b', id: 'd13', value: 'yes' }
    })
  ]);
  const paired = await request(`/api/rooms/${host.room.id}`, { token: host.token });
  assert.equal(paired.room.votes.a.d13, 'yes');
  assert.equal(paired.room.votes.b.d13, 'yes');

  const snapshot = paired;
  const waiting = request(`/api/rooms/${host.room.id}?wait=1&since=${snapshot.room.version}`, { token: host.token });
  await new Promise(resolve => setTimeout(resolve, 100));
  await request(`/api/rooms/${host.room.id}/actions`, {
    token: guest.token,
    body: { type: 'cart', person: 'b', id: 'd1', delta: 1 }
  });
  const synced = await waiting;
  assert.equal(synced.room.cart.d1, 1);
  assert.equal(synced.room.votes.b.d1, 'yes');

  const checkedOut = await request(`/api/rooms/${host.room.id}/actions`, {
    token: host.token,
    body: { type: 'checkout', note: 'Cloudflare 联调订单' }
  });
  assert.equal(checkedOut.room.orders.length, 1);
  assert.equal(checkedOut.room.orders[0].items[0].dish.price, 0);
  const orderId = checkedOut.room.orders[0].id;
  const deleted = await request(`/api/rooms/${host.room.id}/actions`, {
    token: guest.token,
    body: { type: 'order-delete', id: orderId }
  });
  assert.equal(deleted.room.orders.length, 0);

  console.log(`Cloudflare 运行时联调通过：${base}`);
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
