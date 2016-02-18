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
  console.log("Update value...");
  $("#value").html(t_valueTable({value: {}, property: t_property}));
  $("#value").html(t_valueTable({value: data.value, property: t_property}));
}

// Populate scope table
corto.updateScope = function(data) {
  $("#scope").html(t_objectTable({objects: data, objectTemplate: t_object}))
}

// Set parent
corto.updateParent = function(id) {
  $("#navigator").html(corto.linkSplitUp(id));
}

// Request a scope
corto.request = function(id) {
  corto.parent = id;
  $("#scope").html(t_objectTableLoading({}))
  $("#value").html(
    t_metaTable({name: id, type: "???"}) +
    t_valueTableLoading({})
  )
  corto.updateParent(id);
  $.get("http://" + window.location.host +
    "/api" + id + "?select=*&meta=true&value=true",
    corto.updateScope);
  $.get("http://" + window.location.host +
    "/api" + id + "?value=true",
    corto.updateValue);
}

// Document.ready
$(function() {

// Initialization of tables
$("#scope").html(t_objectTable({objects: [], objectTemplate: t_object}));
$("#value").html(t_valueTable({value: {}, property: t_property}));

// Initial request
corto.request("");

});
