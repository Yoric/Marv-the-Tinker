require("io.js");

let logfile;
{
  let _logfile;
  logfile = function() {
    if (_logfile) {
      return _logfile;
    }
    return _logfile = IO.open_truncate("out.log");
  };
}

function print_error(msg, loc) {
  let text = "MARV ERROR: ";
  if (loc) {
    text += loc + " ";
  }
  text += msg;
  printErr(text);
  logfile().write(text+"\n");
}

function print_warning(msg, loc) {
  let text = "MARV WARNING: ";
  if (loc) {
    text += loc + " ";
  }
  text += msg;
  printErr(text);
  logfile().write(text+"\n");
}

exports.error = print_error;
exports.warning = print_warning;