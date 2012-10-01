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

  /**
   * Makes the two given function inherit from each other.
   */
  function inherit(sub, base) {
    function Inheriter() { }
    Inheriter.prototype = base.prototype;
    sub.prototype = new Inheriter();
  }

  /**
   * Parses a duration string (like 1s or 5m) into a duration struct.
   */
  function parseDuration(duration) {
    if (!duration) {
      return {second: 1};
    } else if (typeof(duration) == "string") {
      var start = 0;
      var isReciprocal = false;
      if (duration.charAt(0) == "/") {
        isReciprocal = true;
        start = 1;
      }
      function complete(value) {
        if (isReciprocal)
          value.reciprocal = true;
        return value;
      }
      var type = duration.charAt(duration.length - 1);
      if (/\d/.test(type)) {
        return complete({milli: Number(type)});
      } else {
        var count;
        if (start == duration.length - 1) {
          count = 1;
        } else {
          count = Number(duration.slice(start, duration.length - 1));
        }
        switch (type) {
          case "s":
            return complete({second: count});
          case "m":
            return complete({minute: count});
          case "h":
            return complete({hour: count});
          default:
            throw new Error("Couldn't parse duration " + duration);
        }
      }
    } else {
      return duration;
    }
  }

  /**
   * An abstract variable.
   */
  function Variable(name) {
    this.name = name;
    this.description = "";
    this.filters = [];
    this.unit = this._getDefaultUnit();
    allVariables.push(this);
  }

  Variable.prototype.toJSON = function () {
    return {
      type: this._getTypeName(),
      name: this.name,
      description: this.description,
      filters: this.filters,
      value: this._captureValueJSON(),
      unit: this.unit
    };
  };
  
  /**
   * Sets the description of this variable.
   */
  Variable.prototype.setDescription = function (value) {
    this.description = value;
    return this;
  };

  /**
   * Sets the time unit this variable should be displayed over.
   */
  Variable.prototype.setUnit = function (unit) {
    this.unit = parseDuration(unit);
    return this;
  };

  /**
   * Pushes a filter function onto the set of filters for this variable.
   */
  Variable.prototype._pushFilter = function (filter) {
    this.filters.push(filter);
    return this;
  };

  /**
   * Specified that the rate of change of this variable should be shown,
   * rather than the absolute value.
   */
  Variable.prototype.calcRate = function () {
    return this._pushFilter({rate: true});
  };
  
  /**
   * Implemented by subtypes. Returns the current value of this variable
   * as a json-able value.
   */
  Variable.prototype._captureValueJSON = null;
  
  /**
   * Returns the string tag that identifies this kind of variable.
   */
  Variable.prototype._getTypeName = null;

  Variable.prototype._getDefaultUnit = function () {
    return {milli: 1};
  };

  // Export the counter type.
  webmon.Counter = Counter;
  
  /**
   * A counter that exports a single number.
   */
  function Counter(name) {
    Variable.call(this, name);
    this.value = 0;
  }
  inherit(Counter, Variable);

  Counter.prototype._captureValueJSON = function () {
    return this.value;
  };
  
  Counter.prototype._getTypeName = function () {
    return "Counter";
  };

  Counter.prototype._getDefaultUnit = function () {
    return {second: 1};
  };

  /**`
   * Increases the value of this counter by 1.
   */
  Counter.prototype.increment = function (valueOpt) {
    this.value += (valueOpt === undefined ? 1 : valueOpt);
  };

  /**
   * Sets the value of this counter.
   */
  Counter.prototype.set = function (value) {
    this.value = value;
  }

  // Export the timer type.
  webmon.Timer = Timer;

  /**
   * An event timer that records durations.
   */
  function Timer(name) {
    Variable.call(this, name);
    this.total = 0;
    this.samples = 0;
  }
  inherit(Timer, Variable);

  Timer.prototype._captureValueJSON = function () {
    if (this.samples == 0) {
      return 0;
    } else {
      var result = this.total / this.samples;
      this.total = 0;
      this.samples = 0;
      return result;
    }
  };

  Timer.prototype._getTypeName = function () {
    return "Timer";
  };

  /**
   * Records the duration of an event.
   */
  Timer.prototype.record = function (duration) {
    this.total += duration;
    this.samples++;
  };

  /**
   * Executes the given function, recording the time it took.
   */
  Timer.prototype.measure = function (thunk) {
    var start = Date.now();
    try {
      thunk();
    } finally {
      this.record(Date.now() - start);
    }
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
    var data = event.srcElement.getAttribute("data-webmon-dom-channel-message");
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
    this.script.setAttribute("data-webmon-dom-channel-response", JSON.stringify(data));
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
