/**
 * The data associated with displaying a single value.
 */
function DataEntry(valueElm) {
  this.valueElm = valueElm;
}

DataEntry.prototype.update = function (rawValue, unit) {
  var str;
  var className = "value";
  var value = rawValue / durationToMillis(unit);
  if (isNaN(value)) {
    str = "...";
    className += " pending";
  } else {
    if (value == (value << 0)) {
      str = String(value);
    } else {
      str = value.toFixed(2);
    }
    var unitStr = getDurationUnit(unit);
    str = unitStr ? str + unitStr : str;
  }
  this.valueElm.innerText = str;
  this.valueElm.className = className;
};

/**
 * The data for all entries.
 */
function DataDisplay() {
  this.entries = {};
}

/**
 * Returns the entry with the given name.
 */
DataDisplay.prototype.getEntry = function (name) {
  return this.entries.hasOwnProperty(name) ? this.entries[name] : null;
};

/**
 * Adds an entry with the given name.
 */
DataDisplay.prototype.addEntry = function (name, data) {
  this.entries[name] = data;
}

DataDisplay.INSTANCE = new DataDisplay();

/**
 * Returns the singleton data display instance.
 */
DataDisplay.get = function () {
  return this.INSTANCE;
};

function displayData(data) {
  var overlay = document.getElementById("overlay");
  if (data.length == 0) {
    overlay.innerText = "No variables exported yet."
  } else {
    var history = processHistory(data);
    overlay.style.display = "none";
    document.getElementById("container").style.display = "inherit";
    refreshVariables(history);
  }
}

function refreshVariables(variables) {
  var display = DataDisplay.get();
  var builder = DomBuilder.attach(document.getElementById("container"));
  variables.forEach(function (variable) {
    var name = variable.name;
    var dataEntry = display.getEntry(name);
  var description = variable.getDescription();
  if (description.length == 0)
    description = "(No description)";
    if (!dataEntry) {
      var valueElm;
      builder
        .begin("div")
          .addClass("variable")
          .begin("span")
            .addClass("name")
            .appendText(name)
          .end()
          .begin("div")
            .addClass("value")
            .delegate(function (_, elm) { valueElm = elm; })
          .end()
          .begin("div")
            .addClass("description")
            .appendText(description)
          .end()
        .end();
      dataEntry = new DataEntry(valueElm);
      display.addEntry(name, dataEntry);
    }
    dataEntry.update(variable.getValue(), variable.getUnit());
  });
}

/**
 * Returns the parameter with the given name or null.
 */
function getParameter(name) {
  var params = window.location.search.split(/[?&]/);
  var result = null;
  params.forEach(function (param) {
    var pair = param.split("=");
    if (pair[0] == name)
      result = pair[1];
  });
  return result;
}

/**
 * A single entry in a vector.
 */
function VectorEntry(timestamp, value) {
  this.timestamp = timestamp;
  this.value = value;
}

/**
 * A vector of value with timestamps that can be filtered.
 */
function Vector(values) {
  this.values = values;
}

/**
 * Returns the scalar value of this vector.
 */
Vector.prototype.toScalar = function () {
  var value;
  if (this.values.length == 0) {
    value = NaN;
  } else {
    value = this.values[this.values.length - 1].value;
  }
  return value;
};

/**
 * Returns a new vector that is the result of applying the specified filter
 * to this vector.
 */
Vector.prototype.applyFilter = function (filter) {
  var result = this;
  Map.wrap(filter).forEach(function (name, params) {
    var methodName = Vector.FILTER_METHODS[name];
    if (methodName)
      result = result[methodName](params);
  });
  return result;
};

/**
 * Applies a rate filter to this vector.
 */
Vector.prototype._filterRate = function () {
  if (this.values.length < 2) {
    // We need at least two entries to calculate a rate.
    return new Vector([], "");
  } else {
    var oldest = this.values[0];
    var newest = this.values[this.values.length - 1];
    var timeDelta = (newest.timestamp - oldest.timestamp);
    var valueDelta = newest.value - oldest.value;
    var valueRate = valueDelta / timeDelta;
    return new Vector([new VectorEntry(newest.timestamp, valueRate)]);
  }
};

/**
 * Converts a duration struct into a number of millis.
 */
function durationToMillis(duration) {
  function condMult(value, mult) {
    return value ? (mult * value) : 0;
  }
  var unit = condMult(duration.milli,  1) +
             condMult(duration.second, 1000) +
             condMult(duration.minute, 60000) +
             condMult(duration.hour,   3600000);
  return duration.reciprocal ? (1 / unit) : unit;
}

function getDurationUnit(duration) {
  function condSuffix(value, suffix) {
    return value ? (value == 1 ? suffix : value + suffix) : "";
  }
  var unit = condSuffix(duration.milli,  "") +
             condSuffix(duration.second, "s") +
             condSuffix(duration.minute, "m") +
             condSuffix(duration.hour,   "h");
  return (unit && duration.reciprocal) ? "/" + unit : unit;
};

/**
 * A mapping from filter names to the methods that implement the filter.
 */
Vector.FILTER_METHODS = {
  rate: '_filterRate'
};

/**
 * The history of a single variable.
 */
function VariableHistory(name, entries) {
  this.name = name;
  this.entries = entries;
}

/**
 * Returns the appropriate value for this variable, given the specified
 * variable filters.
 */
VariableHistory.prototype.getValue = function () {
  var lastEntry = this.getMostRecentEntry();
  var filters = lastEntry.getFilters();
  var vector = new Vector(this.entries.map(function (entry) {
    return new VectorEntry(entry.getTimestamp(), entry.getValue());
  }));
  filters.forEach(function (filter) {
    vector = vector.applyFilter(filter);
  });
  return vector.toScalar();
};

/**
 * Returns the unit of the most recent entry of this history.
 */
VariableHistory.prototype.getUnit = function () {
  return this.getMostRecentEntry().getUnit();
};

/**
 * Returns the description for this variable.
 */
VariableHistory.prototype.getDescription = function () {
  return this.getMostRecentEntry().getDescription();
};

/**
 * Returns the most recent history entry.
 */
VariableHistory.prototype.getMostRecentEntry = function () {
  return this.entries[this.entries.length - 1];;
};

/**
 * The value of a single variable at a particular time.
 */
function HistoryEntry(timestamp, variable) {
  this.timestamp = timestamp;
  this.variable = variable;
}

/**
 * Returns this entry's timestamp.
 */
HistoryEntry.prototype.getTimestamp = function () {
  return this.timestamp;
};

/**
 * Returns the raw value of the variable when this entry was captured.
 */
HistoryEntry.prototype.getValue = function () {
  return this.variable.value;
};

/**
 * Returns the unit to use for this entry.
 */
HistoryEntry.prototype.getUnit = function () {
  return this.variable.unit || {milli: 1};
};

/**
 * Returns the description of the variable.
 */
HistoryEntry.prototype.getDescription = function () {
  return this.variable.description;
};

/**
 * Returns the set of filters to apply.
 */
HistoryEntry.prototype.getFilters = function () {
  return this.variable.filters;
};

/**
 * Processes a variable scrape history into a list of variable data objects
 * with data for each individual variable.
 */
function processHistory(history) {
  var vars = new Map();
  var varsOrder = [];
  // Split the history into a history for each variable.
  history.forEach(function (entry) {
    var timestamp = entry.timestamp;
    entry.variables.forEach(function (variable) {
      var name = variable.name;
      if (!vars.contains(name)) {
        vars.put(name, []);
        varsOrder.push(name);
      }
      vars.get(name).push(new HistoryEntry(timestamp, variable));
    });
  });
  // Sort each individual history by timestamp.
  vars.forEach(function (name, entries) {
    entries.sort(function (a, b) {
      return a.timestamp - b.timestamp;
    });
  });
  // Return a list of variable data objects, ordered according to the
  // declaration order from the source script.
  return varsOrder.map(function (name) {
    return new VariableHistory(name, vars.get(name));
  })
}

function refreshDisplay(tabId) {
  chrome.extension.sendMessage({tabId: tabId}, function (history) {
    displayData(history);
  });
}

function onLoad() {
  var tabId = Number(getParameter("tabId"));
  refreshDisplay(tabId);
  window.setInterval(refreshDisplay.bind(null, tabId), 1000);
}

onLoad();
