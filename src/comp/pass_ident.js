let Ast = require("ast.js");
let Log = require("log.js");

function resolve_identifiers(code) {
  let identifiers = [];
  function Scope(parent) {
    this.parent = parent || null;
  }
  Scope.prototype = {
    get: function(key) {
      let inner_key = ":" + key;
      return this._get(":" + key);
    },
    /**
     * @param {Ast.Definition} declaration
     */
    put: function(declaration) {
      let inner_key = ":" + declaration.id.name;
      let uid = identifiers.push(declaration);
      this[inner_key] = declaration;
      return uid;
    },
    local_get: function(key) {
      return this[":" + key];
    },
    _get: function(key) {
      if (this[inner_key]) {
        return this[inner_key];
      }
      if (this.parent) {
        return this.parent._get(key);
      }
      return null;
    },
    enter: function() {
      return new Scope(this);
    }
  };
  let function_scope = new Scope();
  let block_scope    = new Scope();
  let unfound        = new Scope();
  let report_redef = function(newdef, olddef, subblock) {
    Log.warning("Variable '"+newdef.id.name+"' was defined twice in the same scope");
    Log.warning("First definition "+olddef.kind+"-style", olddef.loc);
    Log.warning("Second definition"+(subblock?", in a subblock,":"")+
                " "+newdef.kind+"-style",
                newdef.loc);
  };
  let report_const_redef = function(newdef, olddef, subblock) {
    Log.error("Constant '"+newdef.id.name+"' was defined twice in the same scope");
    Log.error("First definition "+olddef.kind+"-style", olddef.loc);
    Log.error("Second definition "+(subblock?", in a subblock,":""),
              " "+newdef.kind+"-style",
              newdef.loc);
  };

  let result = code.walk(
    {
      VariableDeclaration: {
        exit: function(node) {
          print("VariableDeclaration.exit");
          for (let i = 0; i < node.declarations.length; ++i) {
            let variable = node.declarations[i];
            // We may have several declarations with the same name
            // in the same scope. In this case, merge them if they
            // are |var|/|let|, reject if one is |const|.
            let previous;
            if (variable.isLet()) {
              if ((previous = block_scope.local_get(variable.id.name))) {
                // Another let-definition exists in the exact same
                // (block) scope
                report_redefinition(variable, previous, false);
                // Merge
                variable.id.become(previous.id);
              } else if ((previous = function_scope.local_get(variable.id.name))) {
                // Another var or const-definition exists
                if (previous.isConst()) {
                  report_const_redef(variable, previous, false);
                } else if (previous.id.info.block == block_scope) {
                  // Two definitions in the same block scope, this weird
                  report_redef(variable, previous, false);
                } else {
                  // This definition is in a deeper scope, this is a little
                  // strange, but probably ok
                  report_redef(variable, previous, true);
                }
                // Merge
                variable.id.become(previous.id);
              } else {
                // Nothing weird here, just update the scope
                variable.id.info.uid = block_scope.put(variable);
                variable.id.info.block = block_scope;
              }
            } else if (variable.isVar()) {
              if ((previous = block_scope.local_get(variable.id.name))) {
                report_redef(variable, previous, false);
                // Merge
                variable.id.become(previous.id);
              } else if ((previous = function_scope.local_get(variable.id.name))) {
                // Another var or const-definition exists
                if (previous.isConst()) {
                  report_const_redef(variable, previous, false);
                } else {
                  // Two definitions in the same function scope, this weird
                  report_redef(variable, previous, false);
                }
                // Merge
                variable.id.become(previous.id);
              } else {
                // Nothing weird here, just update the scope
                variable.id.info.uid = function_scope.put(variable);
                variable.id.info.block = block_scope;
              }
            } else if (variable.isConst()) {
              if ((previous = function_scope.local_get(variable.id))) {
                report_const_redef(variable, previous, false);
                variable.id.become(previous.id);
              } else if ((previous = function_scope.local_get(variable.id))) {
                report_const_redef(variable, previous, false);
                variable.id.become(previous.id);
              } else {
                variable.id.info.uid = function_scope.put(variable);
                variable.id.info.block = block_scope;
              }
            }
          }
        }
      },
      Identifier: {
        exit: function(node) {
          if (!node.isexpr) {
//            print("Ignoring definition of "+node.name+ " at "+node.loc);
            return; // This is an identifier definition, handled above
          }
          print("Checking usage of "+node.name);
          let def;
          if (!(def = block_scope.get(node.id))) {
            def = function_scope.get(node.id);
          }
          if (!def) {
            Log.warning("Undefined identifier", def.loc);
            def = node;
            unfound.put(def);
          }
          this.become(def);
        }
      },
      BlockStatement: {
        enter: function() {
          block_scope = block_scope.enter();
        },
        exit:  function() {
          block_scope = block_scope.parent;
        }
      },
      FunctionDeclaration: {
        enter: function(node) {
          print("FunctionDeclaration.enter "+node.params.toSource());
          block_scope = block_scope.enter();
          function_scope = function_scope.enter();
          for (let i = 0; i < node.params.length; ++i) {
            let current = node.params[i];
            function_scope.put(new Ast.Definition(current.loc, current.range,
                                                  null, current, null, "argument"));
          }
        },
        exit: function() {
          print("FunctionDeclaration.exit");
          block_scope = block_scope.parent;
          function_scope = function_scope.parent;
        }
      }
    }
  );
  return result || code;
}

exports.resolve = resolve_identifiers;