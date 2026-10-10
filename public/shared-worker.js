// SHARED WORKER: a single instance shared by EVERY open tab of the app.
// When one tab changes data (jobs, candidates, applications...), it tells the others so they reload.

const ports = new Set();
let lastChange = null; // shared state: the latest change, even for tabs opened afterwards

function sendToAll(message) {
  for (const port of ports) port.postMessage(message);
}

function sendToOthers(message, origin) {
  for (const port of ports) {
    if (port !== origin) port.postMessage(message);
  }
}

self.onconnect = (event) => {
  const port = event.ports[0];
  ports.add(port);

  port.onmessage = (message) => {
    const data = message.data || {};

    if (data.type === 'data-changed') {
      lastChange = { action: String(data.action || 'cambio'), time: Date.now() };
      sendToOthers({ type: 'data-changed', ...lastChange }, port);
    }

    if (data.type === 'disconnect') {
      ports.delete(port);
      sendToAll({ type: 'tabs', total: ports.size });
    }
  };

  // The new tab gets the current state and every other tab learns there is one more
  port.postMessage({ type: 'hello', total: ports.size, lastChange });
  sendToOthers({ type: 'tabs', total: ports.size }, port);
};
