print("Opening debug.js");

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
    result += Debug.source_of(arguments[0]);
  }
  let i;
  for (i = 1; i < arguments.length; ++i) {
    result += ", " + Debug.source_of(arguments[i]);
  }
  result += " ]";
  return result;
};

exports.source_of = source_of;
exports.args_to_string = args_to_string;

print("Debug.js opened");