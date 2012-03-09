load("lib/esprima.js");
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
    print("Translating node "+node.type);
    let loc = to_typed_loc(node.loc, fileName);
    let range = node.range;
    let comments;
    if (node.comments) {
      comments = new Ast.Comments(node.comments);
      print("This node has comments: "+node.comments);
    }
    switch(node.type) {
    case "Program":
      {
        // Do something special with comments
        let elements = loop(node.body);
        return new Ast.Program(loc, range, comments, elements);
      }
    case "Function":
      {
        let params = loop(node.params);
        let body = loop(node.body);
        return new Ast.Function(loc, range, comments,
                                node.id,
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
        let params = loop(node.params);
        let body = loop(node.body);
        let meta = loop(node.meta);
        return new Ast.Statement.Declaration.Fun(loc, range, comments,
                                                 id, params,
                                                 body, meta);
      }
    case "VariableDeclaration":
      {
        let declarations = loop(node.declarations);
        return new Ast.Statement.Declaration.Var(loc, range, comments,
                                                 declarations,
                                                 node.kind);
      }
    case "VariableDeclarator":
      {
        let id = loop(node.id);
        let init = loop(node.init);
        return new Ast.Declarator(loc, range, comments,
                                  id, init);
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
        let args = loop(node.arguments);
        return new Ast.Expression.Call(loc, range, comments,
                                       callee, args);
      }
    case "FunctionExpression":
      {
        let id = loop(node.id);
        let params = loop(node.params);
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
      print(Debug.source_of(node));
      print(error.stack);
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
    // FIXME: Nicer filename
    let source = read("../../"+fileName);
    let untyped_ast = esprima.parse(source, options);
    print(untyped_ast);
    let typed_ast = to_typed_ast(untyped_ast);
    print(typed_ast.toSource());
    return typed_ast;
  },
  toJS: function(code) {
    return esprima.generate(code);
  }
};

exports = Parse;

