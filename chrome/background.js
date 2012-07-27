var POLL_INTERVAL = 1000;

var HISTORY_SIZE = 5;

/**
 * A connection between this background page and a page using webmon.
 */
function PageConnection(port) {
  this.port = port;
  this.callback = null;
  this.port.onMessage.addListener(this._handleResponse.bind(this));
}

/**
 * Adds a thunk to the list of callbacks that will be called with this
 * connection as an argument when the connection is broken.
 */
PageConnection.prototype.addDisconnectListener = function (listener) {
  this.port.onDisconnect.addListener(function () {
    listener(this);
  }.bind(this));
};

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

/**
 * Process a response from the page.
 */
PageConnection.prototype._handleResponse = function (message) {
  try {
    this.callback(JSON.parse(message));
  } finally {
    this.callback = null;
  }
};

/**
 * All the data associated with a single page.
 */
function PageData(connection) {
  this.connection = connection;
  this.history = [];
  this.historyCursor = 0;
}

/**
 * A single entry in the data history.
 */
function HistoryEntry(variables) {
  this.timestamp = Date.now();
  this.variables = variables;
}

/**
 * Returns the page connection.
 */
PageData.prototype.getConnection = function () {
  return this.connection;
};

/**
 * Returns the recorded history for this page.
 */
PageData.prototype.getHistory = function () {
  return this.history;
};

/**
 * Makes this data object poll the page for a fresh scrape of the variables.
 * When the update is complete the callback will be called.
 */
PageData.prototype.update = function (callback) {
  this.connection.send(["getVariables"], this._processResponse.bind(this, callback));
};

/**
 * Processes a response from the page data.
 */
PageData.prototype._processResponse = function (callback, dataStr) {
  var data = JSON.parse(dataStr);
  this.history[this.historyCursor] = new HistoryEntry(data);
  this.historyCursor = (this.historyCursor + 1) % HISTORY_SIZE;
  callback();
};

/**
 * The central object that keeps track of variables for all pages.
 */
function Master() {
  this.pageMap = {};
}

/**
 * Records that there is a connection to the tab with the given id.
 */
Master.prototype.register = function (tabId, connection) {
  var data = new PageData(connection);
  this.pageMap[tabId] = data;
  return data;
};

/**
 * Removes the record of the connection to the tab with the given id.
 */
Master.prototype.unregister = function (tabId) {
  delete this.pageMap[tabId];
};

/**
 * Returns the connection to the given tab.
 */
Master.prototype.getData = function (tabId) {
  return this.pageMap[tabId];
};

/**
 * Called when a new connection is created.
 */
Master.prototype.onConnected = function (connection) {
  var tabId = connection.getTabId();
  this.register(tabId, connection);
  connection.addDisconnectListener(this._onDisconnected.bind(this));
  chrome.pageAction.show(tabId);
  // Holy smokes batman, that's some cheesy hackery!
  chrome.pageAction.setPopup({
    popup: "popup.html?tabId=" + tabId,
    tabId: tabId
  });
};

/**
 * Called when a port disconnects.
 */
Master.prototype._onDisconnected = function (connection) {
  this.unregister(connection.getTabId());
};

/**
 * Called when we display a popup.
 */
Master.prototype.onPopup = function (tabId, sendResponse) {
  var data = this.getData(tabId);
  sendResponse(data ? data.getHistory() : null);
};

/**
 * Fires every time the master has to poll the processes.
 */
Master.prototype.onTick = function () {
  var completeCount = 0;
  var totalCount = 0;
  var master = this;
  function onUpdateDone() {
    completeCount++;
    if (completeCount == totalCount)
      master.scheduleTick();
  }
  for (var tabId in this.pageMap) {
    if (this.pageMap.hasOwnProperty(tabId)) {
      totalCount++;
      var data = this.pageMap[tabId];
      data.update(onUpdateDone);
    }
  }
  // If there are no variables we immediately schedule another tick.
  if (totalCount == 0)
    master.scheduleTick();
};

/**
 * Schedules a call to onTick after the poll interval has passed.
 */
Master.prototype.scheduleTick = function () {
  setTimeout(this.onTick.bind(this), POLL_INTERVAL);
}

function onLoad() {
  var master = new Master();
  chrome.extension.onConnect.addListener(function (port) {
    var connection = new PageConnection(port);
    master.onConnected(connection, port.sender);
  });
  chrome.extension.onMessage.addListener(function (message, sender, sendResponse) {
    return master.onPopup(message.tabId, sendResponse);
  });
  master.scheduleTick();
}

onLoad();
