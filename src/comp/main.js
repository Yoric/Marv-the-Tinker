/*
 * Marv the Tinkerer
 *
 * marv0 compiler.
 *
 * At this stade, we transform JS into JS, without comments.
 *
 * Feathres to add:
 * - keep comments;
 * - bootstrap;
 */

/* Just a test*/
load("src/comp/require.js");
let Debug = require("debug.js");
let Parse = require("parse.js");


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

      // Reprinting manually
      print("Generated code");
      print(code.toJS());
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

