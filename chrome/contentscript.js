/**
 * A hacky channel that allows communication between the background page and the
 * page itself.
 */
function DomBridge(script, port) {
  this.script = script;
  this.port = port;
  this.script.addEventListener("domChannelResponse", this._forwardResponse.bind(this));
  port.onMessage.addListener(this._forwardMessage.bind(this));
};

/**
 * Forwards a message from the background page to the page.
 */
DomBridge.prototype._forwardMessage = function (message) {
  var event = document.createEvent("Event");
  event.initEvent("domChannelMessage", true, true);
  this.script.setAttribute("data-dom-channel-message", JSON.stringify(message));
  this.script.dispatchEvent(event);
}

/**
 * Forwards a response from the page to the background page.
 */
DomBridge.prototype._forwardResponse = function (event) {
  var data = event.srcElement.getAttribute("data-dom-channel-response");
  this.port.postMessage(data);
};

function onLoad() {
  // Check if there is a dom channel to connect to.
	var script = document.getElementById("_webmon_dom_channel");
  if (!script)
    return;
  // Connect the background page to the page.
  new DomBridge(script, chrome.extension.connect());
}

onLoad();
