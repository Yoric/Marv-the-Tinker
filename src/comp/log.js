let IO = require("io.js");
let logfile = IO.open_truncate("result.log");


function print_error(msg, loc) {
  let text = "MARV ERROR: ";
  if (loc) {
    text += loc + " ";
  }
  text += msg;
  printErr(text);
  logfile.write(text+"\n");
}

function print_warning(msg, loc) {
  let text = "MARV WARNING: ";
  if (loc) {
    text += loc + " ";
  }
  text += msg;
  printErr(text);
  logfile.write(text+"\n");
}

function print_progress(msg) {
  print(msg);
  logfile.write("MARV INFO: "+msg+"\n");
}

exports.error = print_error;
exports.warning = print_warning;
exports.progress = print_progress;