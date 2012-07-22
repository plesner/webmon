function PageRegistry() {
  this.pageMap = {};
}

PageRegistry.INSTANCE = new PageRegistry();

/**
 * Returns the singleton page registry instance.
 */
PageRegistry.get = function () {
  return this.INSTANCE;
};

/**
 * Records that there is a connection to the tab with the given id.
 */
PageRegistry.prototype.register = function (tabId, connection) {
  this.pageMap[tabId] = connection;
};

/**
 * Removes the record of the connection to the tab with the given id.
 */
PageRegistry.prototype.unregister = function (tabId) {
  delete this.pageMap[tabId];
};

/**
 * Returns the connection to the given tab.
 */
PageRegistry.prototype.getConnection = function (tabId) {
  return this.pageMap[tabId];
};

/**
 * A connection between this background page and a page using webmon.
 */
function PageConnection(port) {
  this.port = port;
  this.callback = null;
  this.port.onMessage.addListener(this._handleResponse.bind(this));
  PageRegistry.get().register(this.getTabId(), this);
  this.port.onDisconnect.addListener(this._handleDisconnect.bind(this));
}

/**
 * Returns the tab id of the tab this connection connects to.
 */
PageConnection.prototype.getTabId = function () {
  return this.port.sender.tab.id;
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

PageConnection.prototype._handleDisconnect = function () {
  PageRegistry.get().unregister(this.getTabId());
};

/**
 * Called when a new connection is created.
 */
function onConnected(connection) {
  var tabId = connection.getTabId();
  chrome.pageAction.show(tabId);
  // Holy smokes batman, that's some cheesy hackery!
  chrome.pageAction.setPopup({
    popup: "popup.html?tabId=" + tabId,
    tabId: tabId
  });
}

/**
 * Called when we display a popup.
 */
function onPopup(tabId, sendResponse) {
  var connection = PageRegistry.get().getConnection(tabId);
  if (!connection) {
    sendResponse();
  } else {
    connection.send(["getVariables"], function (response) {
      sendResponse(response);
    });
    return true;
  }
}

function onLoad() {
  chrome.extension.onConnect.addListener(function (port) {
    var connection = new PageConnection(port);
    onConnected(connection, port.sender);
  });
  chrome.extension.onMessage.addListener(function (message, sender, sendResponse) {
    return onPopup(message.tabId, sendResponse);
  });
}

onLoad();
