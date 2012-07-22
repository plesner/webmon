function displayData(data) {
  var root = document.body;
  var ul = document.createElement("ul");
  root.appendChild(ul);
  data.forEach(function (entry) {
    var name = entry.name;
    var value = entry.value;
    var li = document.createElement("li");
    ul.appendChild(li);
    li.innerText = name + ": " + value;
  });
}

function onLoad() {
  chrome.extension.sendMessage({}, function (data) {
    displayData(JSON.parse(data));
  });
}

onLoad();
