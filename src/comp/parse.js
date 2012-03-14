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
      if (result) {
        result.reverse();
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
  // The definition of all cases we wish to transform
  // We use an object instead of a big switch-case-on-strings
  // for performance reasons
  const cases = {
    Program: function(loc, comments, range, node)
    {
      Directives.add_comments(node.comments);

      let elements = loop(node.body);
      return new Ast.Program(loc, range,
                             Directives.get_unattached_comments(),
                             elements,
                             Directives.get_directives());
    },
    Function: function(loc, comments, range, node)
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
    },
    EmptyStatement: function(loc, comments, range, node)
    {
      return new Ast.EmptyStatement(loc, range, comments);
    },
    BlockStatement: function(loc, comments, range, node)
    {
      let body = loop(node.body);
      return new Ast.BlockStatement(loc, range, comments, body);
    },
    ExpressionStatement: function(loc, comments, range, node)
    {
      let expr = loop(node.expression);
      return new Ast.ExpressionStatement(loc, range, comments, expr);
    },
    ForStatement: function(loc, comments, range, node)
    {
      let init = loop(node.init);
      let test = loop(node.test);
      let update = loop(node.update);
      let body = loop(node.body);
      return new Ast.ForStatement(loc, range, comments,
                                  init, test, update, body);
    },
    IfStatement: function(loc, comments, range, node)
    {
      let test = loop(node.test);
      let consequent = loop(node.consequent);
      let alternate = loop(node.alternate);
      return new Ast.Statement.If(loc, range, comments,
                                  test, consequent, alternate);
    },
    LabeledStatement: function(loc, comments, range, node)
    {
      let body = loop(node.body);
      return new Ast.LabeledStatement(loc, range, comments,
                                      node.label,
                                      body);
    },
    BreakStatement: function(loc, comments, range, node)
    {
      return new Ast.BreakStatement(loc, range, comments,
                                    node.label);
    },
    ContinueStatement: function(loc, comments, range, node)
    {
      return new Ast.ContinueStatement(loc, range, comments,
                                       node.label);
    },
    WithStatement: function(loc, comments, range, node)
    {
      let object = loop(node.object);
      let body = loop(node.body);
      return new Ast.WithStatement(loc, range, comments,
                                   object, body);
    },
    SwitchStatement: function(loc, comments, range, node)
    {
      let discriminant = loop(node.discriminant);
      let cases = loop(node.cases);
      return new Ast.SwitchStatement(loc, range, comments,
                                     discrimant, cases,
                                     node.lexical);
    },
    ReturnStatement: function(loc, comments, range, node)
    {
      let argument = loop(node.argument);
      return new Ast.ReturnStatement(loc, range, comments,
                                     argument);
    },
    ThrowStatement: function(loc, comments, range, node)
    {
      let argument = loop(node.argument);
      return new Ast.ThrowStatement(loc, range, comments,
                                    argument);
    },
    TryStatement: function(loc, comments, range, node)
    {
      let block = loop(node.block);
      let handlers = loop(node.handlers);
      let finalizer = loop(node.finalizer);
      return new Ast.TryStatement(loc, range, comments,
                                  block, handlers, finalizer);
    },
    CatchClause: function(loc, comments, range, node)
    {
      let param = loop(node.param);
      let guard = loop(node.guard);
      let body = loop(node.body);
      return new Ast.CatchClause(loc, range, comments,
                                 param, guard, body);
    },
    // FIXME: All the other statements
    FunctionDeclaration: function(loc, comments, range, node)
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
      return new Ast.FunctionDeclaration(loc, range, comments,
                                         id, params,
                                         body, meta);
    },
    VariableDeclaration: function(loc, comments, range, node)
    {
      let declarators = loop(node.declarations);
      let kind = node.kind;
      declarators.forEach(
        function(decl) {
          decl.kind = kind;
        }
      );
      return new Ast.VariableDeclaration(loc, range, comments,
                                         declarators,
                                         kind);
    },
    VariableDeclarator: function(loc, comments, range, node)
    {
      let id = loop(node.id);
      let init = loop(node.init);
      return new Ast.VariableDeclarator(loc, range, comments,
                                        id, init);
    },
    AssignmentExpression: function(loc, comments, range, node)
    {
      let left = loop(node.left);
      let right= loop(node.right);
      return new Ast.AssignmentExpression(loc, range, comments,
                                          node.operator, left, right);
    },
    BinaryExpression: function(loc, comments, range, node)
    {
      let left = loop(node.left);
      let right= loop(node.right);
      return new Ast.BinaryExpression(loc, range, comments,
                                      node.operator, left, right);
    },
    CallExpression: function(loc, comments, range, node)
    {
      let callee = loop(node.callee);
      let args = loop(node["arguments"]);
      return new Ast.CallExpression(loc, range, comments,
                                    callee, args);
    },
    FunctionExpression: function(loc, comments, range, node)
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
      return new Ast.FunctionExpression(loc, range, comments,
                                        id, params, body,
                                        node.meta);
    },
    MemberExpression: function(loc, comments, range, node)
    {
      let object = loop(node.object);
      let property = loop(node.property);
      return new Ast.MemberExpression(loc, range, comments,
                                      object, property,
                                      node.computed);
    },
    ObjectExpression: function(loc, comments, range, node)
    {
      let properties = loop(node.properties);
      return new Ast.ObjectExpression(loc, range, comments,
                                      properties);
    },
    ThisExpression: function(loc, comments, range, node)
    {
      return new Ast.ThisExpression(loc, range, comments);
    },
    UpdateExpression: function(loc, comments, range, node)
    {
      let argument = loop(node.argument);
      return new Ast.UpdateExpression(loc, range, comments,
                                      node.operator, argument,
                                      node.prefix);
    },
    Identifier: function(loc, comments, range, node)
    {
      return new Ast.Identifier(loc, range, comments, node.name);
    },
    Literal: function(loc, comments, range, node)
    {
      return new Ast.Literal(loc, range, comments, node.value);
    }
  };
  function loop(node) {
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
    let handler = cases[node.type];
    if (!handler) {
      throw new Error("Node type "+node.type+" not handled yet");
    }
    return handler(loc, comments, range, node);
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
    print("Parsing starts");
    let untyped_ast = esprima.parse(source, options);
    print("Parsing done, transformation starts");
    //Debug.log(untyped_ast.toSource());
    let typed_ast = to_typed_ast(untyped_ast, fileName);
    return typed_ast;
  },
  toJS: function(code) {
    return escodegen.generate(code);
  }
};

exports = Parse;

