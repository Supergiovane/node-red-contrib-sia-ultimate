'use strict';

// Run with: node --test test/*.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const { CEREBRUM_REGISTRY_KEY, getCerebrumRegistry } = require('../nodes/lib/cerebrumIntegration.js');
const { createSiaCerebrumIntegration, parseSiaMessage } = require('../nodes/lib/sia-cerebrum.js');

const configNode = () => ({
  id: 'sia1',
  name: 'Centrale',
  port: 4628,
  deviceList: '3,PIR Soggiorno\n5,Porta garage',
  SIACodes: [
    { code: 'BA', description: 'BURGLARY ALARM' },
    { code: 'BR', description: 'BURGLARY RESTORAL' },
    { code: 'CL', description: 'CLOSING REPORT' },
    { code: 'OP', description: 'OPENING REPORT' },
    { code: 'RP', description: 'AUTOMATIC TEST' }
  ]
});

test('parses SIA data messages', () => {
  assert.deepEqual(parseSiaMessage('#000|Nri1/BA0003'), { code: 'BA', deviceId: '0003', area: '1' });
  assert.deepEqual(parseSiaMessage('#000|Nri0/RP0000'), { code: 'RP', deviceId: '0000', area: '0' });
});

test('publishes link, arming state and zone events read-only', async () => {
  delete globalThis[CEREBRUM_REGISTRY_KEY];
  const integration = createSiaCerebrumIntegration({ configNode: configNode() });
  const provider = getCerebrumRegistry().providers.get('sia-ultimate:sia1');
  assert.equal(provider.adapterId, 'sia-ultimate');
  assert.equal(provider.callService, undefined);

  const events = [];
  provider.subscribe((event) => events.push(event));
  integration.handleMessage({ data_message: '#000|Nri0/RP0000' });
  integration.handleMessage({ data_message: '#000|Nri0/CL0000' });
  integration.handleMessage({ data_message: '#000|Nri1/BA3' });
  integration.handleMessage({ data_message: '#000|Nri1/BA3' });
  integration.handleHeartbeatTimeout('no messages');

  assert.deepEqual(events.map((event) => [event.entityId, event.eventType, event.state]), [
    ['sia1/link', 'state_changed', 'ok'],
    ['sia1/arming', 'state_changed', 'armed'],
    ['sia1/zone/0000', 'state_changed', 'CL CLOSING REPORT'],
    ['sia1/zone/0000', 'sia_event', 'CL CLOSING REPORT'],
    ['sia1/zone/3', 'state_changed', 'BA BURGLARY ALARM'],
    ['sia1/zone/3', 'sia_event', 'BA BURGLARY ALARM'],
    // A repeated alarm is not a new state, but it is still delivered as an event.
    ['sia1/zone/3', 'sia_event', 'BA BURGLARY ALARM'],
    ['sia1/link', 'state_changed', 'timeout']
  ]);
  const zone = await provider.getEntity('sia1/zone/3');
  assert.equal(zone.name, 'PIR Soggiorno');
  assert.equal(zone.code, 'BA');

  integration.dispose();
  assert.equal(getCerebrumRegistry().providers.has('sia-ultimate:sia1'), false);
});
