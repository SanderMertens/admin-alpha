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
var t_objectTableTabs = _.template($("#objectTableTabs").html());
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
var t_dialogDelete = _.template($("#dialogDelete").html());
var t_dialogFail = _.template($("#dialogFail").html());

// Initialize parent to root
corto.parent = "";
corto.page = 1;
corto.itemsPerPage = 200;
corto.numObjects = 0;
corto.boxes = [];
corto.table = {};
corto.objectViews = {};
corto.itemsChecked = [];

// Delayed execution of a task
corto.timer = 0;

corto.htmlId = function(str) {
  return str.replace(/\//g, "_")
}

corto.delay = function(callback, delay) {
  clearTimeout(corto.timer);
  corto.timer = setTimeout(callback, delay);
}

corto.lastMember = function(item) {
  items = item.split(".");
  result = items[items.length - 1];
  if (!result.length) {
      result = "value";
  }
  return result;
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

corto.contentClass = function(type) {
  switch (type) {
  case 1: return "content-binary";
  case 2: return "content-bool";
  case 3: return "content-char";
  case 4: return "content-int";
  case 5: return "content-uint";
  case 6: return "content-text";
  case 7: return "content-enum";
  case 8: return "content-bitmask";
  case 9: return "content-ref";
  }
}

corto.resolveMember = function(value, item, truncate) {
  if (value != undefined) {
    result = value;

    key = Object.keys(item)[0];
    type = item[key];

    if (item && key.length) {
      members = key.split(".");
      for (var i = 1; i < members.length; i++) {
        result = result[members[i]];
      }
    }
  }

  if (result && result.length > 40) {
    if (truncate) {
      result = corto.truncate(result, 40);
    }
  } else if (!truncate) {
    result = null;
  }

  if (truncate) {
      result = "<span class=" + corto.contentClass(type) + ">" + result + "</span>"
  }

  return result;
}

// Function is called on checkbox
corto.onCheckChange = function(event) {
  row = event.target.parentNode.parentNode.parentNode;
  var id = row.id.substring(4, row.id.length); /* strip row- */
  var parent = corto.parent + "/" + row.dataset.parent;

  if (event.target.checked) {
    $(row).addClass("is-selected");
    corto.itemsChecked.push(parent + id);
  } else {
    $(row).removeClass("is-selected");
    var index = jQuery.inArray(parent + id, corto.itemsChecked);
    if (index != -1) {
        corto.itemsChecked.splice(index, 1);
    }
  }
};

corto.hideDialog = function() {
  $('#overlay-disable-page, #dialog').fadeOut(100);
}

// Function is called on delete button
corto.onDelete = function() {
  var id = "";
  var count = corto.itemsChecked.length;
  if (count != 0) {
    if (count == 1) {
      id = corto.itemsChecked[0];
    }
    $("#dialogContent").html(t_dialogDelete(
      {count: corto.itemsChecked.length, id: id}
    ));
    $('#overlay-disable-page, #dialog').fadeIn(100);
  } else {
    $("#dialogContent").html(t_dialogFail(
      {msg: "No objects selected"}
    ));
    $('#overlay-disable-page, #dialog').fadeIn(100);
  }
}

// Function is called when pressing OK on delete dialog
corto.delete = function() {
  expr = corto.itemsChecked.join(",");
  console.log(expr);
  $.ajax({
    type: "DELETE",
    url: "http://" + window.location.host + "/api",
    data: "select=" + expr,
    success: function(msg) {
      corto.hideDialog();
      corto.refresh();
    },
    fail: function(msg) {
      $("#dialogContent").html(t_dialogFail(
        {msg: msg}
      ));
    }
  });
}

// Update MDL checkboxes on dynamic updates
corto.updateCheckboxes = function() {
  $(".mdl-checkbox").each(function() {
    componentHandler.upgradeElement(this);
    input = this.querySelector('input');
    input.addEventListener('change', corto.onCheckChange)
  });
  corto.boxes = document.querySelectorAll('tbody .mdl-data-table__select');
}

// Update MDL tabs on dynamic updates
corto.updateTabs = function(elem) {
  var tabs = document.querySelectorAll('.mdl-tabs');
  for (var i = 0; i < tabs.length; i++) {
    new MaterialTabs(tabs[i]);
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

  var owner;
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

  if (value instanceof Object) {
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
          var obj = {};
          obj[prefix + '.' + c] = v
          columns.push(obj);
        }
      }
    }
  } else {
    var obj = {};
    obj[""] = value;
    columns.push(obj);
  }

  if (superColumns.length) {
    columns.push.apply(columns, superColumns);
  }

  return columns;
}

// Populate scope table
corto.updateScope = function(data) {
  if (data.o != undefined) {
    corto.numObjects = data.o.length;
  } else {
    corto.numObjects = 0;
  }
  corto.updatePage();

  var sorted = {};
  var objectTable = $("#admin-objects");

  if (data.o) {
    for(var i = 0; i < data.o.length; i++) {
      type = data.o[i].meta.type;
      if (!(type in sorted)) {
        sorted[type] = []
      }
      sorted[type].push(data.o[i]);
    }
  }

  objectTable.html(t_objectTableTabs({objects: sorted, types: data.t, objectTemplate: t_object, tableTemplate: t_objectTable}));

  corto.updateCheckboxes();
  corto.updateTabs(objectTable[0]);

  $(".mdl-js-data-table").each(function(){
    componentHandler.upgradeElement(this);
  });

  $('.toggle-scope-container').hide();

  if (!corto.numObjects) {
    return;
  }

  corto.parent = corto.requestParent;
  corto.updateParent(corto.parent);
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
      "/api" + parent + "?select=" + id + "&value=true&meta=true&td=true",
      corto.updateValue);
  } else {
    $.get("http://" + window.location.host +
      "/api" + parent + "?value=true&meta=true&td=true",
      corto.updateValue);
  }
}

// Query handler
corto.search = function(event){
    corto.query = "";
    var q = event.target.value;
    var typeFilter = "";
    var idFilter = "?select=*";
    var parent = corto.parent;

    if (q[0] == "/" && q[1] != "/") {
        parent = "/";
        q = q.substring(1);
    } else if (q[0] == "/" && q[1] == "/") {
        parent = "/";
    }

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
      corto.request(parent, corto.query);
    } else {
      corto.delay(function(){
        corto.request(parent, corto.query);
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
  if (id[0] && id[0] != '/') {
      id = corto.parent + "/" + id;
  }
  if (query && query[0] == '/' && query[1] != '/') {
      id = "/";
      query = query.substring(1);
  }

  $("#scope").html(t_objectTableLoading({}));
  corto.requestParent = id;
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
  if (id == undefined) {
    id = corto.parent;
  }
  corto.requestParent = id;
  $.get("http://" + window.location.host +
    "/api" + id + q + "&meta=true&value=true&td=true&offset=" +
        ((corto.page - 1) * corto.itemsPerPage) + "&limit=" + corto.itemsPerPage,
        corto.updateScope);
}

corto.navigate = function(nav) {
  if (((nav == -1) && (corto.page > 1)) || ((nav == 1) && (corto.numObjects == corto.itemsPerPage))) {
    corto.page += nav;
    corto.refresh();
    corto.updatePage();
  }
}

corto.updatePage = function() {
  corto.itemsChecked = [];
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
