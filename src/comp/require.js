{
  let modules = {};
  function require(fileName) {
    if (modules[fileName]) {
      return modules[fileName];
    }
    let source = read(fileName);
    let module =
      (function() {
         evalWithLocation(
           '"use strict";\n\n'+
             'let exports = {};\n'+
             'let module = {};\n' +
             source, fileName, 1);
         return exports;
      })({});
    return modules[fileName] = module;
  }
}