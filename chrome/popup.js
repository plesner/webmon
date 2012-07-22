/**
 * The data associated with displaying a single value.
 */
function DataEntry(valueElm) {
  this.valueElm = valueElm;
}

DataEntry.prototype.update = function (value) {
  this.valueElm.innerText = String(value);
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
  var display = DataDisplay.get();
  var builder = DomBuilder.attach(document.getElementById("container"));
  data.forEach(function (entry) {
    var name = entry.name;
    var dataEntry = display.getEntry(name);
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
        .end();
      dataEntry = new DataEntry(valueElm);
      display.addEntry(name, dataEntry);
    }
    dataEntry.update(entry.value);
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

function refreshDisplay(tabId) {
  chrome.extension.sendMessage({tabId: tabId}, function (data) {
    displayData(JSON.parse(data));
  });
}

function onLoad() {
  var tabId = Number(getParameter("tabId"));
  refreshDisplay(tabId);
  window.setInterval(refreshDisplay.bind(null, tabId), 1000);
}

onLoad();
