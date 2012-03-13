/**
 * A simple implementation of CommonJS require.
 *
 * At the time of this writing, the implementation is not fully compliant
 * with CommonJS, as it does not handle module names
 */

{
  let modules = {};
  function require(moduleName, filePaths) {
    if (modules[":"+moduleName]) {
      return modules[":"+moduleName];
    }
    if (!filePaths) {
      filePaths = [moduleName];
    } else {
      filePaths = filePaths.slice(filePaths).push(moduleName);
    }
    for (let i = 0; i < filePaths.length; ++i) {
      let fileName, source;
      try {
        fileName = filePaths[i];
        source = read(fileName);
      } catch(x) {
        continue;
      }
      let evaluated =
        (function() {
           evalWithLocation(
             '"use strict";\n\n'+
               'let exports = {};\n'+
               'let module = {};\n' + // Unused atm
               source, fileName, 1);
           return {exports: exports,
                   module:  module};
         })();
      modules[":"+fileName] = evaluated.exports;
      modules[":"+moduleName] = evaluated.exports;
      if (evaluated.module && evaluated.module.id) {
        modules[":"+evaluated.module.id] = evaluated.exports;
      };
      return evaluated.exports;
    }
    printErr("Could not load module "+moduleName);
    printErr("I have searched in "+filePaths.toSource());
    return null;
  }
}
