'use strict';

// Publishes a SIA DC-09 receiver to Cerebrum Ultimate, read-only: link to the
// panel, arming state reported by the panel, and the last event of every zone.
// Every received SIA event is also delivered to Cerebrum as an event, so
// repeated alarms are never collapsed.

const { registerCerebrumIntegration } = require('./cerebrumIntegration.js');

// SIA event codes that report the arming state (openings = disarm, closings = arm).
const ARMING_STATE_BY_CODE = Object.freeze({
  CL: 'armed', CA: 'armed', CG: 'armed', CS: 'armed', CF: 'armed', CQ: 'armed',
  NL: 'armed_partial',
  OP: 'disarmed', OA: 'disarmed', OG: 'disarmed', OS: 'disarmed', OQ: 'disarmed'
});
const TEST_CODES = new Set(['RP', 'RX', 'TX']);

// data_message such as "#000|Nri0/BA0003": code BA, device 0003, area ri0.
function parseSiaMessage(dataMessage) {
  const text = String(dataMessage || '');
  const body = text.includes('|') ? text.split('|')[1] : text;
  const parts = body.split('/');
  const event = parts.length > 1 ? parts[1] : '';
  const area = parts.length > 1 ? (parts[0].match(/ri(\d+)/) || [])[1] || '' : '';
  return { code: event.substring(0, 2), deviceId: event.substring(2), area };
}

function parseDeviceList(text) {
  const names = new Map();
  String(text || '').split('\n').forEach((row) => {
    const [id, ...rest] = row.split(',');
    if (id && id.trim() && rest.length) names.set(id.trim(), rest.join(',').trim());
  });
  return names;
}

function createSiaCerebrumIntegration({ configNode, now = () => Date.now(), packageName = 'node-red-contrib-sia-ultimate' }) {
  const entitiesById = new Map();
  const base = `${configNode.id}`;
  const panelName = configNode.name || `SIA receiver ${configNode.port || ''}`.trim();
  const describe = (code) => {
    const found = (configNode.SIACodes || []).find((item) => item.code === code);
    return found ? found.description : 'Unknown';
  };
  const setEntity = (entity) => {
    entitiesById.set(entity.id, entity);
    return entity;
  };
  setEntity({ id: `${base}/link`, name: `${panelName} link`, kind: 'connectivity', capability: 'status', state: 'waiting' });
  setEntity({ id: `${base}/arming`, name: `${panelName} arming state`, kind: 'alarm_panel', capability: 'alarm_state', state: 'unknown' });

  const integration = registerCerebrumIntegration({
    adapter: {
      id: 'sia-ultimate',
      title: 'SIA alarm receiver',
      packageName,
      kind: 'security',
      capabilities: ['alarm-events', 'zones', 'arming-state', 'panel-link'],
      access: 'observe',
      operations: [
        { id: 'list-entities', description: 'SIA alarm receiver: link with the panel (ok/timeout), arming state reported by the panel (armed, armed_partial, disarmed, unknown) and the last SIA event of every zone with its code and description (for example BA burglary alarm, BR burglary restoral, FA fire alarm, TA tamper). Read-only.' },
        { id: 'read-entity', description: 'Current state of one SIA entity (link, arming state or zone) by its exact id.' }
      ]
    },
    provider: {
      id: `sia-ultimate:${configNode.id}`,
      title: panelName,
      ownerNodeId: configNode.id,
      isReady: () => true,
      listEntities: async () => Array.from(entitiesById.values()).map((entity) => ({ ...entity })),
      getEntity: async (id) => {
        const entity = entitiesById.get(String(id || ''));
        return entity ? { ...entity } : null;
      }
    }
  });

  const publish = (entity, eventType = 'state_changed', state = entity.state) => {
    const details = { ...entity };
    ['id', 'name', 'kind', 'capability', 'state'].forEach((key) => delete details[key]);
    integration.emit({
      entityId: entity.id,
      eventType,
      state,
      resourceName: entity.name,
      resourceType: 'sia',
      kind: entity.kind,
      capability: entity.capability,
      details
    });
  };

  const markLink = (state, reason) => {
    const entity = setEntity({ ...entitiesById.get(`${base}/link`), state, reason: reason || '', at: new Date(now()).toISOString() });
    publish(entity);
  };

  // sia: the decoded message of the receiver (after a valid ACK).
  function handleMessage(sia) {
    markLink('ok');
    const { code, deviceId, area } = parseSiaMessage(sia && sia.data_message);
    if (!code || TEST_CODES.has(code)) return;
    const description = describe(code);
    const at = new Date(now()).toISOString();
    const deviceName = parseDeviceList(configNode.deviceList).get(deviceId) || '';
    if (ARMING_STATE_BY_CODE[code]) {
      publish(setEntity({ ...entitiesById.get(`${base}/arming`), state: ARMING_STATE_BY_CODE[code], code, description, area, at }));
    }
    const zone = setEntity({
      id: `${base}/zone/${deviceId || 'panel'}`,
      name: deviceName || (deviceId ? `Zone ${deviceId}` : panelName),
      kind: 'alarm_zone',
      capability: 'event',
      state: `${code} ${description}`,
      code,
      description,
      deviceId,
      area,
      at
    });
    publish(zone);
    // The raw event too: repeated alarms with the same code must not be lost.
    publish(zone, 'sia_event', `${code} ${description}`);
  }

  return {
    handleMessage,
    handleHeartbeatTimeout: (reason) => markLink('timeout', reason),
    entities: () => Array.from(entitiesById.values()),
    provider: integration.provider,
    dispose: integration.dispose
  };
}

module.exports = { ARMING_STATE_BY_CODE, createSiaCerebrumIntegration, parseSiaMessage };
