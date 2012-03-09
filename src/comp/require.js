{
  let modules = {};
  function require(file) {
    if (modules[file]) {
      return modules[file];
    }
    let source = read(file);
    let module =
      (function(exports) {
        Object.defineProperty(Error.prototype,
                            "fileName",
                            {
                              value: file
                            }
                           );
        eval(source);
        return exports;
      })({});
    return modules[file] = module;
  }
}