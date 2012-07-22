function displayData(data) {
  var root = document.body;
  var ul = document.createElement("ul");
  root.appendChild(ul);
  data.forEach(function (entry) {
    var li = document.createElement("li");
    ul.appendChild(li);
    li.innerText = entry.name + ": " + entry.value;
    li.title = entry.description;
  });
}

function onLoad() {
  chrome.extension.sendMessage({}, function (data) {
    console.log(data);
    displayData(JSON.parse(data));
  });
}

onLoad();
