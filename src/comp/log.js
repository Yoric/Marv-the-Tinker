function print_error(msg, loc) {
  let text = "MARV ERROR: ";
  if (loc) {
    text += loc + " ";
  }
  text += msg;
  print(text);
}

function print_warning(msg, loc) {
  let text = "MARV WARNING: ";
  if (loc) {
    text += loc + " ";
  }
  text += msg;
  print(text);
}

exports.error = print_error;
exports.warning = print_warning;