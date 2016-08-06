if (!corto) {
   var corto = {};
}

// Colorize JSON. From http://jsfiddle.net/unlsj/
corto.json = {
  replacer: function(match, pIndent, pKey, pVal, pEnd) {
    var key = '<span class=json-key>';
    var val = '<span class=json-value>';
    var str = '<span class=json-string>';
    var r = pIndent || '';
    if (pKey)
       r = r + key + pKey.replace(/[": ]/g, '') + '</span>: ';
    if (pVal)
       r = r + (pVal[0] == '"' ? str : val) + pVal + '</span>';
    return r + (pEnd || '');
    },
  prettyPrint: function(obj, max) {
      if (obj != undefined) {
        var jsonLine = /^( *)("[\w]+": )?("[^"]*"|[\w.+-]*)?([,[{])?$/mg;
        var str = JSON.stringify(obj, null, 3);
        if (str.length > max) return "{ ... }";
        return str
           .replace(/&/g, '&amp;').replace(/\\"/g, '&quot;')
           .replace(/</g, '&lt;').replace(/>/g, '&gt;')
           .replace(jsonLine, corto.json.replacer);
      }
    }
  };

// Compile templates
var t_objectTable = _.template($("#objectTable").html());
var t_objectTableLoading = _.template($("#objectTableLoading").html());
var t_object = _.template($("#object").html());
var t_valueTable = _.template($("#valueTable").html());
var t_valueTableLoading = _.template($("#valueTableLoading").html());
var t_property = _.template($("#property").html());
var t_metaTable = _.template($("#metaTable").html());
var t_objectViewer = _.template($("#objectViewer").html());
var t_inlineScope = _.template($("#inlineScope").html());
var t_inlineScopeElement = _.template($("#inlineScopeElement").html());

// Initialize parent to root
corto.parent = "";
corto.page = 1;
corto.itemsPerPage = 50;
corto.numObjects = 0;
corto.boxes = [];
corto.table = {};
corto.objectViews = {};

// Delayed execution of a task
corto.timer = 0;
corto.delay = function(callback, delay) {
  clearTimeout(corto.timer);
  corto.timer = setTimeout(callback, delay);
}

corto.lastMember = function(item) {
  items = item.split(".");
  return items[items.length - 1];
}

corto.truncate = function(value, length) {
  if (typeof value == "string") {
    if (value.length > length) {
      return value.substring(0, length) + '..';
    } else {
      return value;
    }
  } else {
    return value
  }
}

corto.resolveMember = function(value, item, truncate) {
  if ((value != undefined) && !item || (value instanceof Object)) {
    result = value;

    if (item) {
      members = item.split(".");
      for (var i = 1; i < members.length; i++) {
        result = result[members[i]];
      }
    }
  }

  if (result && result.length > 20) {
    if (truncate) {
      result = corto.truncate(result, 20);
    }
  } else if (!truncate) {
    result = null;
  }

  return result;
}

corto.updatePaneWidth = function(a) {
  views = document.getElementById('admin-objectViews');
  objects = document.getElementById('admin-objects');
  if ((views.childElementCount + a) == 1) {
    $(objects).removeClass('mdl-cell--12-col');
    $(objects).addClass('mdl-cell--8-col');
  } else if ((views.childElementCount + a) == 0) {
    $(objects).removeClass('mdl-cell--8-col');
    $(objects).addClass('mdl-cell--12-col');
  }
  componentHandler.upgradeElement(objects);
  return views.childElementCount;
}

corto.subscribe = function(id, parent) {
  if (parent == "." || parent == undefined) {
    parent = corto.parent;
  }
  console.log("subscribe for " + id + ", " + parent);
  append = function() {
    $(corto.objectViews).append(t_objectViewer({
      id: id
    }));
    viewer = corto.objectViews.querySelector('#viewer-tab-' + id);
    corto.updateTabs(viewer);
    corto.requestValue(parent, id);
    corto.updateColumns();
  }
  if (corto.updatePaneWidth(1) == 0) {
    window.setTimeout(append, 280);
  } else {
    append();
  }
}

corto.unsubscribe = function(id) {
  $('#' + id + '-viewer').remove();
  row = document.getElementById("row-" + id);
  if (row) {
    $(row).removeClass("is-selected");
    checkbox = document.querySelector("#mdl-check-" + id);
    if (checkbox) {
      checkbox.MaterialCheckbox.uncheck()
    }
  }
  corto.updatePaneWidth(0);
  window.setTimeout(corto.updateColumns, 280);
}

corto.checkHandler = function(event) {
  row = event.target.parentNode.parentNode.parentNode.parentNode;
  var id = row.id.substring(4, row.id.length); /* strip row- */
  if (event.target.checked) {
    $(row).addClass("is-selected");
    var parent = row.dataset.parent;
    if (parent != '.') {
      parent = '/' + parent;
    }
    corto.subscribe(id, parent);
  } else {
    corto.unsubscribe(id);
  }
};

// Update MDL checkboxes on dynamic updates
corto.updateCheckboxes = function() {
  $(".mdl-checkbox").each(function() {
    componentHandler.upgradeElement(this);
    input = this.querySelector('input');
    input.addEventListener('change', corto.checkHandler)
  });
  corto.boxes = document.querySelectorAll('tbody .mdl-data-table__select');
}

// Update MDL tabs on dynamic updates
corto.updateTabs = function(elem) {
  var layout = document.querySelector('.mdl-layout');
  var tabs = document.querySelectorAll('.mdl-tabs__tab');
  var panels = document.querySelectorAll('.mdl-tabs__panel');

  for (var i = 0; i < tabs.length; i++) {
    new MaterialTabs(elem);
  }
}

// Translate identifier to link
corto.link = function(ref, name) {
  return "<a class=\"admin-url\" onclick=\"corto.request('" + ref + "')\">" +
    name + "</a>";
}

corto.linkSplitUp = function(name) {
  link = "";

  // First add root
  if (!name.length) {
    result = corto.link("", "corto") + "://";
  } else {
    result = corto.link("", "corto") + ":/";
  }

  // Iterate over sections, add to link
  _.each(name.split("/"), function(item) {
    if (item.length) {
      link += "/" + item;
      result += "/<span class='object-id'>" + corto.link(link, item) + "</span>";
    }
  });

  return result;
}

// Populate value table
corto.updateValue = function(data) {
  $("#meta-" + data.id).html(t_metaTable({id: "", name: "", type: "", owner: ""}));
  $("#value-" + data.id).html(t_valueTable({value: {}, augments: undefined, property: t_property}));

  var name;
  if (data.meta.name == null || data.meta.name == undefined || !data.meta.name.length ) {
      name = data.id;
  } else {
      name = data.meta.name;
  }

  var owner
  if (data.meta.owner == undefined) {
    owner = "me";
  } else {
    owner = data.meta.owner;
  }

  $("#object-table-title-" + data.id).html(name);
  $("#meta-" + data.id).html(t_metaTable({id: data.id, name: name, type: data.meta.type, owner: owner}));
  if ((data.value != undefined) && (data.value != null) && (Object.keys(data.value).length)) {
    $("#value-" + data.id).html(t_valueTable({value: data.value, augments: data.augments, property: t_property}));
  } else {
    dataLink = corto.objectViews.querySelector('#viewer-link-data-' + data.id);
    metaLink = corto.objectViews.querySelector('#viewer-link-meta-' + data.id);
    metaLink.click()
    $(dataLink).css({"color": "#eeeeee"});
  }
}

corto.findColumns = function(columns, prefix, value) {
  var superColumns = [];

  for (var c in value) {
    v = value[c];
    if ((v != undefined) && !(v instanceof Array)) {
      if (v instanceof Object) {
        if (c == "super") {
          superColumns = corto.findColumns(superColumns, prefix + '.' + c, v);
        } else {
          columns = corto.findColumns(columns, prefix + '.' + c, v);
        }
      } else {
        columns.push(prefix + '.' + c);
      }
    }
  }

  if (superColumns.length) {
    columns.push.apply(columns, superColumns);
  }

  return columns;
}

corto.updateColumns = function() {
  var offset = 70;
  var tableWidth = $(corto.adminObjects).width();
  for (var i = 1; i < 11; i++) {
    var maxWidth = 30;
    elems = corto.adminObjects.querySelectorAll("span.tbl-column-" + i);
    for (var j = 0; j < elems.length; j++) {
      e = elems[j];

      /* Determine width of text */
      corto.WidthTool.style.fontSize = 14;
      corto.WidthTool.textContent = e.textContent.trim();
      width = (corto.WidthTool.clientWidth + 1) + 50 /* margin */;

      maxWidth = width > maxWidth ? width : maxWidth;

      if (offset < (tableWidth - width - 50)) {
        e.style.position = "absolute";
        e.style.left = "" + offset + "px";
        e.style.visibility = "visible";
      } else if (i > 1) {
        e.style.position = "absolute";
        e.style.left = "0";
        e.style.visibility = "hidden";
      }
    }

    offset += maxWidth;
  }
}

// Populate scope table
corto.updateScope = function(data) {
  corto.numObjects = data.length;
  corto.updatePage();

  var types = {};
  var objects = $("#admin-objects");

  for(var i = 0; i < data.length; i++) {
    type = data[i].meta.type;
    if (!(type in types)) {
      types[type] = []
    }
    types[type].push(data[i]);
  }
  objects.html("");

  var keys = [];
  for (var k in types) {
    keys.push(k);
  }
  keys.sort();

  for (var i = 0; i < keys.length; i++) {
    k = keys[i];
    columns = corto.findColumns([], '', types[k][0].value).slice(0, 9);
    var typeStr = k[0] == '/' ? k.substring(1) : k;
    objects.append(t_objectTable({type: typeStr, objects: types[k], columns: columns, objectTemplate: t_object}))
    componentHandler.upgradeElement(document.getElementById(typeStr + '-object-table'));
  }
  corto.updateCheckboxes();

  objects.find('[col-id$=-tooltip]').each(function(){
    componentHandler.upgradeElement(this);
  });

  corto.updateColumns();
  $('.toggle-scope-container').hide();
}

// Set parent
corto.updateParent = function(id) {
  $("#navigator").html(corto.linkSplitUp(id));
}

corto.clear = function() {
  $("#objectViews").empty();
}
corto.clearAll = function() {
  corto.clear();
  $("#admin-objects").empty();
}

// Request a value
corto.requestValue = function(parent, id) {
  corto.clear();

  if (id != undefined) {
    $.get("http://" + window.location.host +
      "/api" + parent + "?select=" + id + "&value=true&meta=true&augment=*",
      corto.updateValue);
  } else {
    $.get("http://" + window.location.host +
      "/api" + parent + "?value=true&meta=true&augment=*",
      corto.updateValue);
  }
}

// Query handler
corto.search = function(event){
    corto.query = "";
    var q = event.target.value;
    var typeFilter = "";
    var idFilter = "?select=*";

    // Parse query
    elems = q.split("&") /*.replace(/ /g,'')*/
    for (var i = 0; i < elems.length; i ++) {
      var e = elems[i];
      if (e.substr(0,1) == ':') {
        if (e.substr(1, 5) == "type=") {
          typeFilter = "&type=" + e.substr(6, e.length);
        }
      } else {
        idFilter = "?select=" + e + '*';
      }
    }

    corto.query = idFilter + typeFilter;

    if (event.keyCode == 13) {
      corto.request(corto.parent, corto.query);
    } else {
      corto.delay(function(){
        corto.request(corto.parent, corto.query);
      }, 1000);
    }

    return false;
}

// Inline scope view
corto.toggleScope = function(id) {
  var elem = $('#row-' + id);
  if (elem.hasClass('toggle-scope')) {
    var e = $('#toggle-scope-' + id);
    e.empty();
    e.height(0);
    corto.delay(function(){e.hide()}, 280);
    elem.removeClass('toggle-scope');
  } else {
    elem.addClass('toggle-scope');
    $.get("http://" + window.location.host +
      "/api" + corto.parent + "?select=" + id + "/*&meta=true",
      function(data) {
        if (data.length) {
          var e = $('#toggle-scope-' + id);
          e.show();
          e.height((data.length / 2) * 25 + 90);
          corto.delay(function(){
            e.html(
              t_inlineScope({elementTemplate: t_inlineScopeElement, objects: data}
            ));
          }, 280);
        }
      });
  }
}

// Request a scope
corto.request = function(id, query) {
  corto.parent = id;
  $("#scope").html(t_objectTableLoading({}));
  corto.updateParent(id);
  corto.page = 1;
  corto.refresh(id, query);
}

corto.refresh = function(id, query) {
  var q = "*";
  if (query != undefined) {
      q = query;
  } else {
      q = "?select=*"
  }
  $.get("http://" + window.location.host +
    "/api" + id + q + "&meta=true&value=true&offset=" +
        ((corto.page - 1) * corto.itemsPerPage) + "&limit=" + corto.itemsPerPage,
        corto.updateScope);
}

corto.navigate = function(nav) {
  if (((nav == -1) && (corto.page > 1)) || ((nav == 1) && (corto.numObjects == corto.itemsPerPage))) {
    corto.page += nav;
    corto.refresh(corto.parent);
    corto.updatePage();
  }
}

corto.updatePage = function() {
  $("#pageid").html("<p>" + corto.page + "</p>");
  if (corto.page == 1) {
    $("#pagearrowleft").hide();
  } else {
    $("#pagearrowleft").show();
  }
  if (corto.numObjects < corto.itemsPerPage) {
    $("#pagearrowright").hide();
  } else {
    $("#pagearrowright").show();
  }
}

// Document.ready
$(function() {

corto.WidthTool = document.getElementById("Test");
corto.adminObjects = document.getElementById("admin-objects");

$( window ).resize(function() {
  corto.updateColumns();
});

// Code to select row-checkboxes when header checkbox is clicked
corto.objectViews = document.querySelector('#admin-objectViews');
/*corto.table = document.querySelector('table');

var headerCheckbox = corto.table.querySelector('thead input');
var headerCheckHandler = function(event) {
  if (event.target.checked) {
    for (var i = 0, length = corto.boxes.length; i < length; i++) {
      corto.boxes[i].MaterialCheckbox.check();
      $(corto.boxes[i].parentNode.parentNode).addClass("is-selected");
    }
  } else {
    for (var i = 0, length = corto.boxes.length; i < length; i++) {
      corto.boxes[i].MaterialCheckbox.uncheck();
      $(corto.boxes[i].parentNode.parentNode).removeClass("is-selected");
    }
  }
};
headerCheckbox.addEventListener('change', headerCheckHandler);*/

// Initial request
corto.request("");

});
