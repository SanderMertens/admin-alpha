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

// Initialize parent to root
corto.parent = "";
corto.page = 1;
corto.itemsPerPage = 12;
corto.numObjects = 0;

// Translate identifier to link
corto.link = function(ref, name) {
  return "<a onclick=\"corto.request('" + ref + "')\">" +
    name + "</a>";
}

corto.linkSplitUp = function(name) {
  link = "";

  // First add root
  if (!name.length) {
    result = corto.link("", "corto://");
  } else {
    result = corto.link("", "corto:/");
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
  $("#value").html(t_valueTable({value: {}, augments: undefined, property: t_property}));

  var name;
  if (!data.meta.name) {
      name = data.id;
  } else {
      name = data.meta.name;
  }

  $("#value").html(
    t_metaTable({id: data.id, name: name, type: data.meta.type}) +
    t_valueTable({value: data.value, augments: data.augments, property: t_property}));
}

// Populate scope table
corto.updateScope = function(data) {
  corto.numObjects = data.length;
  corto.updatePage();
  $("#scope").html(t_objectTable({objects: data, objectTemplate: t_object}))
}

// Set parent
corto.updateParent = function(id) {
  $("#navigator").html(corto.linkSplitUp(id));
}

// Request a value
corto.requestValue = function(parent, id) {
  $("#value").html(
    t_metaTable({id: id, name: "...", type: "..."}) +
    t_valueTableLoading({})
  )

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

// Request a scope
corto.request = function(id) {
  corto.parent = id;
  $("#scope").html(t_objectTableLoading({}));
  corto.updateParent(id);
  corto.requestValue(id);
  corto.page = 1;
  corto.refresh(id);
}

corto.refresh = function(id) {
  $.get("http://" + window.location.host +
    "/api" + id + "?select=*&meta=true&offset=" +
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
  console.log(corto.numObjects);
  if (corto.numObjects < corto.itemsPerPage) {
    $("#pagearrowright").hide();
  } else {
    $("#pagearrowright").show();
  }
}

// Document.ready
$(function() {

// Initialization of tables
$("#scope").html(t_objectTable({objects: [], objectTemplate: t_object}));
$("#value").html(t_valueTable({value: {}, augments: undefined, property: t_property}));

// Initial request
corto.request("");

});
