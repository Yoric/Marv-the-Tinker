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
let IO = require("io.js");
let Parse = require("parse.js");
let Identifiers = require("pass_ident.js");

function main(args)
{
  print("Welcome to Marv 0");
  print(Debug.args_to_string(args));
  let text = "";
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
        let js = Parse.toJS(rewritten);
        text += js + "\n";
        print(js);
      } catch (x) {
        print(x);
        print(x.stack);
      }
    }
  );
  let out = IO.open_truncate("out.js");
  out.write(text);
  out.close();
}

main.call(this, arguments);

