/*
 * Marv the Tinkerer
 *
 * marv0 compiler.
 *
 * At this stage:
 * - we parse the JS source code;
 * - we extract the comments that contain directives;
 * - we store the table of directives in the program node;
 * - 
 * - we reprint the result.
 */

load("src/comp/require.js");
let Debug = require("debug.js");
let Parse = require("parse.js");
let Identifiers = require("pass_ident.js");

function main(args)
{
  print("Welcome to Marv 0");
  print(Debug.args_to_string(args));
  args.forEach(
    function(file) {
      print("Reading file: "+file);
      let code = Parse.fromFile(file);

      // Reprinting with esprima
      print("Sanity check");
      print(Parse.toJS(code));

      // Analyzing identifiers
      print("Analyzing identifiers");
      let rewritten = Identifiers.resolve(code);
      try {
        print(Parse.toJS(rewritten));
      } catch (x) {
        print(x);
        print(x.stack);
      }
    }
  );
  // Parse command-line arguments
  // For each source file
  // ... open file
  // ... parse file (including comments)
  // ... perform passes
  // ... generate .js source
}

main.call(this, arguments);

