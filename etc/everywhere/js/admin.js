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
  prettyPrint: function(obj) {
      if (obj != undefined) {
        var jsonLine = /^( *)("[\w]+": )?("[^"]*"|[\w.+-]*)?([,[{])?$/mg;
        return JSON.stringify(obj, null, 3)
           .replace(/&/g, '&amp;').replace(/\\"/g, '&quot;')
           .replace(/</g, '&lt;').replace(/>/g, '&gt;')
           .replace(jsonLine, corto.json.replacer);
      }
    }
  };

// Compile templates
var t_object = _.template($("#object").html());
var t_objectList = _.template($("#objectList").html());
var t_valueTree = _.template($("#valueTree").html());

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

// Populate scope table
corto.updateScope = function(data) {
  $("#scope").html(t_objectList({objects: data, objectTemplate: t_object}))
  $("#scope tr.object:even").css("background-color", "#23272e");
}

// Set parent
corto.updateParent = function(id) {
  $("#navigator").html(corto.linkSplitUp(id));
}

// Request a scope
corto.request = function(id) {
  corto.parent = id;
  corto.updateScope([]);
  corto.updateParent(id);
  $.get("http://" + window.location.host +
    "/api" + id + "?select=*&meta=true&value=true",
    corto.updateScope);
}

// Document.ready
$(function() {

// Initialization of tables
$("#scope").html(t_objectList({objects: [], objectTemplate: t_object}));
$("#value").html(t_valueTree({}));

// Initial request
corto.request("");

});
