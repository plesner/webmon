(function (namespace) {

  if (namespace.webmon)
    return;

  /**
   * The webmon namespace.
   */
  var webmon = {};
  namespace.webmon = webmon;

  /**
   * An index of all variables, ordered by declaration order.
   */
  var allVariables = [];

  webmon.Counter = Counter;
  /**
   * A counter that exports a single number.
   */
  function Counter(name) {
    this.name = name;
    this.value = 0;
    allVariables.push(this);
  }

  Counter.prototype.toJSON = function () {
    return {name: this.name, value: this.value};
  };

  /**
   * Increases the value of this counter by 1.
   */
  Counter.prototype.increment = function () {
    this.value++;
  };

  /**
   * A hacky channel that allows the page to communicate with the page action.
   * This channel only allows the page to respond to messages send from the
   * action, it can't initiate messages itself.
   */
  function DomChannel(script) {
    this.script = script;
    this.messageHandler = null;
    this.script.addEventListener("domChannelMessage", this._handleMessage.bind(this));
  }

  /**
   * Sets the message handler that will respond to messages.
   */
  DomChannel.prototype.setMessageHandler = function (handler) {
    this.messageHandler = handler;
  }

  DomChannel.prototype._handleMessage = function (thunk) {
    var data = event.srcElement.getAttribute("data-dom-channel-message");
    var message = JSON.parse(data);
    var method = message[0];
    var args = message.slice(1);
    var handler = this.messageHandler;
    var response = handler[method].apply([handler].concat(args));
    this._sendResponse(JSON.stringify(response));
  };

  DomChannel.prototype._sendResponse = function (data) {
    var event = document.createEvent("Event");
    event.initEvent("domChannelResponse", true, true);
    this.script.setAttribute("data-dom-channel-response", JSON.stringify(data));
    this.script.dispatchEvent(event);
  };

  function MessageDispatcher() {

  }

  MessageDispatcher.prototype.getVariables = function () {
    return allVariables;
  };

  function initCommunication() {
    var script = document.createElement("script");
    script.id = "_webmon_dom_channel";
    document.head.appendChild(script);   
  	var channel = new DomChannel(script);
    channel.setMessageHandler(new MessageDispatcher());
  }

  initCommunication();

})(window);
