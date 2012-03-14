let esprima = require("../../lib/esprima/esprima.js");
let escodegen = require("../../lib/escodegen/escodegen.js");
let Ast = require("ast.js");
let Debug = require("debug.js");

let options = {
  comment: true,
  raw: true,
  loc: true,
  range: true
};

let to_typed_loc = function(loc, fileName) {
  if (loc == null) {
    return null;
  }
  let start = new Ast.Position(loc.start.line, loc.start.column);
  let end   = new Ast.Position(loc.end.line, loc.end.column);
  return new Ast.SourceLocation(fileName, start, end);
};

let to_typed_ast = function(node, fileName) {
  /**
   * Handler for directives (i.e. comments)
   */
  let Directives = {
    _unattached: [], // Line -> arrays of comments finishing at that line
    _first_attached_comment: -1,
    _regexp_extract:  /[ \t*]*(@([a-zA-Z0-9_]*) *{([^}]*)} *([a-zA-Z0-9]*))/,
    _directives: {},
    add_comments: function(comments) {
      for (let i = 0; i < comments.length; ++i) {
        let comment = comments[i];
        let first_char = comment.value[0];
        Debug.log("Examining comment '"+comment.value+"'");
        if (first_char != '*') {
          Debug.log("Not a meaningful comment");
          continue;
        }
        let last_line = comment.end.line;
        let entry = this._unattached[last_line];
        if (!entry) {
          this._unattached[last_line] = entry = [];
        }
        entry.push(comment);
        Debug.log("This is a meaningful comment, ending at line "+last_line);
      }
    },
    /**
     * Get the comments that are attached to the node.
     *
     * Rules are the following:
     * - comments can be attached only to statements and declarations;
     * - to be attached, a comment must appear on the same line as the
     * statement/declaration or on the line immediately before.
     */
    extract_comments_for_node: function(node) {
      if (node.type.search(/Statement|Declaration/) == -1) {
        return null;
      }
      let line_start = node.loc.start.line;
      let result = null;
      if (line_start > 0) {
        if (this._unattached[line_start - 1]) {
          Debug.log("Attaching comments from previous line "+(line_start - 1));
          result = this._unattached[line_start - 1];
          delete this._unattached[line_start - 1];
        }
      }
      if (this._unattached[line_start]) {
          Debug.log("Attaching comments from same line "+line_start);
        if (!result) {
          result = [];
        }
        result.concat(this._unattached[line_start]);
        delete this._unattached[line_start];
      }
      if (!result) {
        return null;
      }
      if (this._first_attached_comment == -1) {
        this._first_attached_comment = line_start;
      }
      return this.parse_comment(result, node);
    },
    get_unattached_comments: function() {
      let result;
      for(let i = 0; i < this._first_attached_comment; ++i) {
        let current = this._unattached[i];
        if (current) {
          let directives = Directives.parse_comment(current, node);
          if (directives) {
            if (!result) {
              result = [];
            }
            directives.forEach(
              function(v) {
                result.push(v);
              }
            );
          }
        }
      }
      return result;
    },
    parse_comment: function(comments, node) {
      let result = null;
      for (let i = 0; i < comments.length; ++i) {
        let current = comments[i];
        let matched = current.value.match(Directives._regexp_extract);
        if (!matched) continue;
        let [ignore, string, directive, param, optname] = matched;
        if (!result) {
          result = [];
        }
        string = '* ' + string;
        result.push(new Ast.Directive(current.range,
                                      current.type, string,
                                      directive, param, optname));
        let table = Directives._directives[directive];
        if (!table) {
          Directives._directives[directive] = table = [];
        }
        table.push(node);
      }
      return result;
    },
    get_directives: function() {
      return Directives._directives;
    }
  };
  let program;
  let loop = function(node) {
    if (node == null) {
      return null;
    }
    if (Array.isArray(node)) {
      let result = [];
      node.forEach(
        function(current) {
          result.push(loop(current));
        }
      );
      return result;
    }
    let loc = to_typed_loc(node.loc, fileName);
    let range = node.range;
    let comments;
    if (node.type != "Program") {
      comments = Directives.extract_comments_for_node(node);
      if (comments) {
        Debug.log("Node "+node.type+" has comments "+comments.toSource());
      }
    };
    switch(node.type) {
    case "Program":
      {
        Directives.add_comments(node.comments);

        let elements = loop(node.body);
        return new Ast.Program(loc, range,
                               Directives.get_unattached_comments(),
                               elements,
                               Directives.get_directives());
      }
    case "Function":
      {
        let params = loop(node.params);
        params.forEach(
          function(param) {
            param.binder = true;
          }
        );
        let id = loop(node.id);
        if (id) {
          id.binder = true;
        }
        let body = loop(node.body);
        return new Ast.Function(loc, range, comments,
                                id,
                                params, body,
                                node.generator, node.expression);
      }
    case "EmptyStatement":
      {
        return new Ast.Statement.Empty(loc, range, comments);
      }
    case "BlockStatement":
      {
        let body = loop(node.body);
        return new Ast.Statement.Block(loc, range, comments, body);
      }
    case "ExpressionStatement":
      {
        let expr = loop(node.expression);
        return new Ast.Statement.Expression(loc, range, comments, expr);
      }
    case "IfStatement":
      {
        let test = loop(node.test);
        let consequent = loop(node.consequent);
        let alternate = loop(node.alternate);
        return new Ast.Statement.If(loc, range, comments,
                                    test, consequent, alternate);
      }
    case "LabeledStatement":
      {
        let body = loop(node.body);
        return new Ast.Statement.Labeled(loc, range, comments,
                                         node.label,
                                         body);
      }
    case "BreakStatement":
      {
        return new Ast.Statement.Break(loc, range, comments,
                                       node.label);
      }
    case "ContinueStatement":
      {
        return new Ast.Statement.Continue(loc, range, comments,
                                          node.label);
      }
    case "WithStatement":
      {
        let object = loop(node.object);
        let body = loop(node.body);
        return new Ast.Statement.With(loc, range, comments,
                                      object, body);
      }
    case "SwitchStatement":
      {
        let discriminant = loop(node.discriminant);
        let cases = loop(node.cases);
        return new Ast.Statement.Switch(loc, range, comments,
                                        discrimant, cases,
                                        node.lexical);
      }
    case "ReturnStatement":
      {
        let argument = loop(node.argument);
        return new Ast.Statement.Return(loc, range, comments,
                                        argument);
      }
    case "ThrowStatement":
      {
        let argument = loop(node.argument);
        return new Ast.Statement.Throw(loc, range, comments,
                                       argument);
      }
    case "TryStatement":
      {
        let block = loop(node.block);
        let handlers = loop(node.handlers);
        let finalizer = loop(node.finalizer);
        return new Ast.Statement.Try(loc, range, comments,
                                     block, handlers, finalizer);
      }
    case "CatchClause":
      {
        let param = loop(node.param);
        let guard = loop(node.guard);
        let body = loop(node.body);
        return new Ast.Clause.Catch(loc, range, comments,
                                    param, guard, body);
      }
      // FIXME: All the other statements
    case "FunctionDeclaration":
      {
        let id = loop(node.id);
        if (id) {
          id.binder = true;
        }
        let params = loop(node.params);
        params.forEach(
          function(param) {
            param.binder = true;
          }
        );
        let body = loop(node.body);
        let meta = loop(node.meta);
        return new Ast.Statement.Declaration.Fun(loc, range, comments,
                                                 id, params,
                                                 body, meta);
      }
    case "VariableDeclaration":
      {
        let declarators = loop(node.declarations);
        let kind = node.kind;
        declarators.forEach(
          function(decl) {
            decl.kind = kind;
          }
        );
        return new Ast.Statement.Declaration.Var(loc, range, comments,
                                                 declarators,
                                                 kind);
      }
    case "VariableDeclarator":
      {
        let id = loop(node.id);
        let init = loop(node.init);
        return new Ast.Definition(loc, range, comments,
                                  id, init);
      }
    case "AssignmentExpression":
      {
        let left = loop(node.left);
        let right= loop(node.right);
        return new Ast.Expression.Assignment(loc, range, comments,
                                             node.operator, left, right);
      }
    case "BinaryExpression":
      {
        let left = loop(node.left);
        let right= loop(node.right);
        return new Ast.Expression.Bin(loc, range, comments,
                                      node.operator, left, right);
      }
    case "CallExpression":
      {
        let callee = loop(node.callee);
        let args = loop(node["arguments"]);
        return new Ast.Expression.Call(loc, range, comments,
                                       callee, args);
      }
    case "FunctionExpression":
      {
        let id = loop(node.id);
        if (id) {
          id.binder = true;
        }
        let params = loop(node.params);
        params.forEach(
          function(param) {
            param.binder = true;
          }
        );
        let body = loop(node.body);
        return new Ast.Expression.Function(loc, range, comments,
                                           id, params, body,
                                           node.meta);
      }
    case "MemberExpression":
      {
        let object = loop(node.object);
        let property = loop(node.property);
        return new Ast.Expression.Member(loc, range, comments,
                                         object, property,
                                         node.computed);
      }
    case "ThisExpression":
      {
        return new Ast.Expression.This(loc, range, comments);
      }
    case "Identifier":
      {
        return new Ast.Identifier(loc, range, comments, node.name);
      }
    case "Literal":
      {
        return new Ast.Literal(loc, range, comments, node.value);
      }
    default:
      let error = new Error("Node type "+node.type+" not handled yet");
      throw error;
    }
  };
  return loop(node);
};

let Parse = {
  fromString: function(source) {
    let untyped_ast = esprima.parse(source, options);
    return to_typed_ast(untyped_ast);
  },
  fromFile: function(fileName) {
    let source = read(fileName);
    let untyped_ast = esprima.parse(source, options);
    Debug.log(untyped_ast.toSource());
    let typed_ast = to_typed_ast(untyped_ast, fileName);
    return typed_ast;
  },
  toJS: function(code) {
    return escodegen.generate(code);
  }
};

exports = Parse;

