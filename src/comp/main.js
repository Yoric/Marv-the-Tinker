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
let Log = require("log.js");

function main(args)
{
  print("Welcome to Marv 0");
  print(Debug.args_to_string(args));
  let text = "";
  args.forEach(
    function(file) {
      Log.progress("Reading file "+file);
      try {

      let code = Parse.fromFile(file);

      // Reprinting with esprima
      Debug.log("Sanity check");
      Debug.log(Parse.toJS(code));

      // Analyzing identifiers
      Log.progress("Analyzing identifiers");
      let rewritten = Identifiers.resolve(code);
        let js = Parse.toJS(rewritten);
        text += js + "\n";
        Debug.log(js);
      } catch (x) {
        Debug.error(x);
        Debug.error(x.stack);
      }
    }
  );
  Log.progress("All files compiled, writing output.");
  let out = IO.open_truncate("out.js");
  out.write(text);
  out.close();
}

main.call(this, arguments);

