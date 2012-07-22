var connections = [];

/**
 * A connection between this background page and a page using webmon.
 */
function PageConnection(port) {
  this.port = port;
  this.callback = null;
  this.port.onMessage.addListener(this._handleResponse.bind(this));
}

/**
 * Sends a message to the page, invoking the given callback with the response
 * when it arrives.
 */
PageConnection.prototype.send = function (message, callback) {
  this.callback = callback;
  this.port.postMessage(message);
};

PageConnection.prototype._handleResponse = function (message) {
  try {
    this.callback(JSON.parse(message));
  } finally {
    this.callback = null;
  }
};

function onConnected(connection, sender) {
  connections.push(connection);
  chrome.pageAction.show(sender.tab.id);
}

function onLoad() {
  chrome.extension.onConnect.addListener(function (port) {
    var connection = new PageConnection(port);
    onConnected(connection, port.sender);
  });
  chrome.extension.onMessage.addListener(function (message, sender, sendResponse) {
    connections[0].send(["getVariables"], sendResponse);
    return true;
  });
}

onLoad();
