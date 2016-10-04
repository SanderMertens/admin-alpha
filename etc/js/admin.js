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
var t_objectTableEmpty = _.template($("#objectTableEmpty").html());
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
var t_dialogEdit = _.template($("#dialogEdit").html());
var t_dialogDelete = _.template($("#dialogDelete").html());
var t_dialogFail = _.template($("#dialogFail").html());

corto.parent = "";
corto.page = 1;
corto.itemsPerPage = 200;
corto.numObjects = 0;
corto.boxes = [];
corto.table = {};
corto.objectViews = {};
corto.itemsChecked = [];
corto.data = {};

// Delayed execution of a task
corto.timer = 0;

corto.htmlId = function(str) {
  return str.replace(/\//g, "_")
}

corto.delay = function(callback, delay) {
  clearTimeout(corto.timer);
  corto.timer = setTimeout(callback, delay);
}

corto.findTypeInLocalDb = function(id) {
  for (var key in corto.data.t) {
    if (key == id) {
      return corto.data.t[key];
    }
  }
}

corto.findInLocalDb = function(id) {
  if (id[0] != "/") {
    id = "/" + id
  }

  for (var i = 0; i < corto.data.o.length; i ++) {
    var dbId = corto.data.o[i].id;
    if (corto.data.o[i].meta.parent != undefined) {
      dbId = corto.data.o[i].meta.parent + "/" + dbId;
    }
    if (corto.parent != "/") {
      dbId = corto.parent + "/" + dbId;
    } else {
      dbId = corto.parent + dbId;
    }
    if (dbId == id) {
      return corto.data.o[i];
    }
  }
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
  case 0: return "content-binary";
  case 1: return "content-bool";
  case 2: return "content-char";
  case 3: return "content-int";
  case 4: return "content-uint";
  case 5: return "content-float";
  case 6: return "content-text";
  case 7: return "content-enum";
  case 8: return "content-bitmask";
  case 9: return "content-ref";
  }
}

corto.contentRegexp = function(type) {
  var identifier = "[a-zA-Z_][a-zA-Z_0-9]*"
  switch (type) {
  case 0: /* binary */ return "[0-9]+";
  case 3: /* int */    return "-?[0-9]+";
  case 4: /* uint */   return "[0-9]+";
  case 1: /* bool */   return "true|false";
  case 2: /* char */   return ".";
  case 5: /* float */  return "[-+]?[0-9]*\.?[0-9]+";
  case 6: /* string */ return undefined;
  case 7: /* enum */   return identifier;
  case 8: /* bitmask */return identifier + "([\|]" + identifier + ")*";
  case 9: /* ref */    return "/?" + identifier + "(\/" + identifier + ")*";
  }
}

corto.contentName = function(type) {
  switch (type) {
  case 3: /* int */    return "number";
  case 4: /* uint */
  case 0: /* binary */ return "unsigned number";
  case 1: /* bool */   return "boolean";
  case 2: /* char */   return "character";
  case 5: /* float */  return "floating point number";
  case 6: /* string */ return "string";
  case 7: /* enum */   return "enumeration";
  case 8: /* bitmask */return "bitmask";
  case 9: /* ref */    return "reference";
  }
}

corto.resolveMember = function(value, item, truncate, embed) {
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
    if (embed != true) {
      result = null;
    }
  }

  if (truncate) {
      result = "<span class=" + corto.contentClass(type) + ">" + result + "</span>"
  }

  return result;
}

corto.setMember = function(object, member, value) {
  if (value != undefined) {
    result = object.value;

    if (member) {
      members = member.split(".");
      for (var i = 1; i < members.length - 1; i++) {
        result = result[members[i]];
      }

      var last = members[i];
      if (typeof(result[last]) == "number") {
        result[last] = Number.parseFloat(value);
      } else if (typeof(result[last]) == "boolean") {
        console.log(value);
        if (value == "on") {
          result[last] = true;
        } else {
          result[last] = false;
        }
      } else {
        result[last] = value;
      }
    } else {
      object.value = value;
    }
  }
}

// Function is called on checkbox
corto.onCheckChange = function(event) {
  row = event.target.parentNode.parentNode.parentNode;
  var id = row.id.substring(4, row.id.length); /* strip row- */
  var parent = row.dataset.parent;
  if (corto.parent != "/") {
      parent = corto.parent + "/" + parent;
  } else {
      parent = "/" + parent;
  }

  if (parent.substr(parent.length - 1) != "/") {
    parent += "/";
  }

  if (event.target.checked) {
    $(row).addClass("is-selected");
    corto.itemsChecked.push(parent + id);
    $("#admin-group-delete").show();
  } else {
    $(row).removeClass("is-selected");
    var index = jQuery.inArray(parent + id, corto.itemsChecked);
    if (index != -1) {
        corto.itemsChecked.splice(index, 1);
    }
    if (!corto.itemsChecked.length) {
      $("#admin-group-delete").hide();
    }
  }
};

corto.hideDialog = function() {
  $('#overlay-disable-page, #dialog').fadeOut(100);
}

// Called when delete button is clicked
corto.onDelete = function(expr) {
  event.stopPropagation();

  if (expr == undefined) {
    var count = corto.itemsChecked.length;
    if (count != 0) {
      if (count == 1) {
        expr = corto.itemsChecked[0];
      }
    } else {
      $("#dialogContent").html(t_dialogFail(
        {msg: "No objects selected"}
      ));
      $('#overlay-disable-page, #dialog').fadeIn(100);
    }
  }
  if (expr != undefined) {
    $("#dialogContent").html(t_dialogDelete(
      {count: corto.itemsChecked.length, id: expr}
    ));
    $('#overlay-disable-page, #dialog').fadeIn(100);
  }
}

// Called when pressing OK on delete dialog
corto.delete = function(expr) {
  if (expr == undefined) {
    expr = corto.itemsChecked.join(",");
  }
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

// Called when edit button is clicked
corto.onEdit = function(expr) {
  event.stopPropagation();
  var object = corto.findInLocalDb(expr);
  var type = corto.findTypeInLocalDb(object.meta.type);
  $("#dialogContent").html(t_dialogEdit(
    {object: object, type: corto.findColumns([], "", type)}
  ));
  corto.updateTextfields();
  corto.updateSwitches();
  $('#overlay-disable-page, #dialog').fadeIn(100);
}

// Called when pressing OK on edit dialog
corto.edit = function(expr) {
  var object = corto.findInLocalDb(expr);
  $(".edit_input").each(function() {
    corto.setMember(object, this.getAttribute('id').substr(5), this.value);
  });
  $.ajax({
    type: "PUT",
    url: "http://" + window.location.host + "/api",
    data: "id=" + expr + "&value=" + JSON.stringify(object.value),
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

corto.showHoverButtons = function(row) {
  $(row).find(".admin-button-hover").show();
}

corto.hideHoverButtons = function(row) {
  $(row).find(".admin-button-hover").hide();
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

  // Hack to get ripple effect to work on dynamic updates
  $(".mdl-js-ripple-effect").each(function() {
    componentHandler.upgradeElement(this);
  });
  $(".mdl-js-ripple-effect").each(function() {
    componentHandler.upgradeElement(this);
  });
}

// Update textfields on dynamic updates
corto.updateTextfields = function() {
  $(".mdl-textfield").each(function() {
    componentHandler.upgradeElement(this);
  });
}

// Update switches on dynamic updates
corto.updateSwitches = function() {
  $(".mdl-switch").each(function() {
    componentHandler.upgradeElement(this);
  });
}

// Translate identifier to link
corto.link = function(ref, name, action) {
  if (action == undefined) {
    action = "";
  }
  return "<a class=\"admin-url\" onclick=\"" + action + "corto.request('" + ref + "')\">" +
    name + "</a>";
}

corto.enableNavSpinner = function() {
  $("#admin-navigator-spinner").addClass("is-active");
}

corto.disableNavSpinner = function() {
  $("#admin-navigator-spinner").removeClass("is-active");
}

corto.linkSplitUp = function(name) {
  link = "";

  // First add root
  if (!name.length) {
    result = corto.link("", "corto", "corto.enableNavSpinner();") + "://";
  } else {
    result = corto.link("", "corto", "corto.enableNavSpinner();") + ":/";
  }

  // Iterate over sections, add to link
  _.each(name.split("/"), function(item) {
    if (item.length) {
      link += "/" + item;
      result += "/<span class='object-id'>" + corto.link(link, item, "corto.enableNavSpinner();") + "</span>";
    }
  });

  return result;
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

  corto.disableNavSpinner();
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

  corto.parent = corto.requestParent;
  corto.updateParent(corto.parent);
  corto.data = data;

  if (!corto.numObjects) {
    objectTable.html(t_objectTableEmpty());
  } else {
    objectTable.html(t_objectTableTabs({objects: sorted, types: data.t, objectTemplate: t_object, tableTemplate: t_objectTable}));
  }

  $(".mdl-js-data-table").each(function(){
    componentHandler.upgradeElement(this);
  });

  $('.toggle-scope-container').hide();
  $(".admin-button-hover").hide();
  $(".admin-group-delete").hide();

  corto.updateCheckboxes();
  corto.updateTabs(objectTable[0]);
}

corto.request_w_spinner = function(obj, url) {
  $(obj).html(
    "<div class='mdl-spinner mdl-spinner--single-color mdl-js-spinner admin-button-loading is-active'></div>"
  );

  $("i.admin-button").fadeOut(200);
  $(".mdl-spinner").each(function(){
    componentHandler.upgradeElement(this);
  });

  corto.request(url);
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

corto.id = function(parent, id) {
  if (parent && parent != ".") {
    id = parent + "/" + id;
  }
  if (id[0] && id[0] != '/') {
      id = corto.parent + "/" + id;
  }
  return id;
}

// Request a scope
corto.request = function(id, query) {
  if (query && query[0] == '/' && query[1] != '/') {
      id = "/";
      query = query.substring(1);
  }

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
        corto.updateScope
      )
  .fail(function(data) {
    console.log( "request failed" );
    console.log( data );
  });
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

// Initial request
corto.request("");

});
