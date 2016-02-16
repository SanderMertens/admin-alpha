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
    var jsonLine = /^( *)("[\w]+": )?("[^"]*"|[\w.+-]*)?([,[{])?$/mg;
    return JSON.stringify(obj, null, 3)
       .replace(/&/g, '&amp;').replace(/\\"/g, '&quot;')
       .replace(/</g, '&lt;').replace(/>/g, '&gt;')
       .replace(jsonLine, corto.json.replacer);
    }
  };

$(function() {
  
var t_object = _.template($("#object").html());
var t_objectList = _.template($("#objectList").html());

$.get("http://" + window.location.host + "/api?select=*&meta=true&value=true", function(data) {
  $("#scope").html(t_objectList({objects: data, objectTemplate: t_object}))
  $("tr.object:even").css("background-color", "#23272e");
});

});
