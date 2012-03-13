let IO = require("io.js");

Object.defineProperty(
  this, "logfile",
  {
    get: function() {
      delete this.logfile;
      return this.logfile = IO.open_truncate("debug.log");
    },
    configurable: true
  }
);

let source_of = function(x) {
  if (x === undefined) {
    return "undefined";
  } else if (x === null) {
    return "null";
  } else {
    return x.toSource();
  }
};

let args_to_string = function() {
  let result = "[ ";
  if (arguments.length != 0) {
    result += source_of(arguments[0]);
  }
  let i;
  for (i = 1; i < arguments.length; ++i) {
    result += ", " + source_of(arguments[i]);
  }
  result += " ]";
  return result;
};

let log = function(text) {
  logfile.write("INFO "+Date.now()+": "+text);
};

let error = function(text) {
  logfile.write("ERROR "+Date.now()+": "+text);
};

exports.source_of = source_of;
exports.args_to_string = args_to_string;
exports.log = log;
exports.error = error;
