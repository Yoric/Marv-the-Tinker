/**
 * Implementation of the JavaScript AST.
 *
 * This AST attempts to be compatible with the SpiderMonkey Parser API
 * https://developer.mozilla.org/en/SpiderMonkey/Parser_API
 */

let Log = require("log.js");
let Debug = require("debug.js");

let Ast = {};
exports = Ast;

// Logistics

function walk_array(array, cb) {
  for (let i = 0; i < array.length; ++i) {
    Debug.log(array[i].type);
    let current = array[i].walk(cb);
    if (current) {
      array[i] = current;
    }
  }
}

/**
 * @param {number} line
 * @param {number} column
 * @constructor
 */
Ast.Position = function Position(line, column) {
  this.line = line;
  this.column = column;
};
Ast.Position.prototype = {
  toString: function() {
    return ""+this.line+":"+this.column;
  }
};
Ast.SourceLocation = function SourceLocation(fileName, start, end) {
  this.source = fileName;
  this.start  = start;
  this.end    = end;
};
Ast.SourceLocation.prototype = {
  toString: function() {
    return this.source+" ["+this.start+"-"+this.end+"]";
  }
};
Ast.Directive = function Directive(range, type, string, key, code, name) {
  this.type  = type;
  this.value = string;
  this.key = key;
  this.code = code;
  this.name = name;
};

Ast.Node = function Node(loc, range, comments) {
  this.loc = loc;
  this.range = range;
  this.comments = comments;
};
Ast.Node.prototype = {
  walk: function() {
    throw new Error(this.type+".walk() not implemented yet");
  },
  walk_enter: function(walker) {
    if (walker && walker.enter) {
      return walker.enter(this);
    }
    return null;
  },
  walk_exit: function(walker) {
    if (walker && walker.exit) {
      return walker.exit(this);
    }
    return null;
  },
  get isExpression() {
    throw new Error(this.type+".isExpression not implemented yet");
  },
  get isStatement() {
    throw new Error(this.type+".isStatement not implemented yet");
  },
  get isDeclaration() {
    throw new Error(this.type+".isDeclaration not implemented yet");
  },
  withType: function(type) {
    this.type = type;
    return this;
  }
};

// Special nodes

Ast.Property = function Property(loc, range, comments, key, value, kind)
{
  Ast.Node.call(this, loc, range, comments);
  this.key = key;
  this.value = value;
  this.kind = kind;
};
Ast.Property.prototype = new Ast.Node().withType("Property");
Ast.Property.prototype.walk = function(cb) {
  let result;
  if ((result = this.walk_enter(cb.Property))) {
    return result;
  }
  if ((result = this.value.walk(cb))) {
    this.value = result;
  }
  return this.walk_exit(cb.Property);
};



Ast.Program = function Program(loc, range, comments, elements, directives) {
  Ast.Node.call(this, loc, range, comments);
  this.elements = elements; // SpiderMonkey-style
  this.body = elements; // esprima-style
  this.directives = directives;
};
Ast.Program.prototype = new Ast.Node();
Ast.Program.prototype.type = "Program";

Ast.Program.prototype.walk = function(cb) {
  if (cb.Program && cb.Program.enter) {
    cb.Program.enter(this);
  }
  walk_array(this.body, cb);
  if (cb.Program && cb.Program.exit) {
    return cb.Program.exit(this);
  }
  return null;
};

// Expressions

Ast.Expression = function Expression(loc, range, comments) {
  Ast.Node.call(this, loc, range, comments);
  return this;
};
Ast.Expression.prototype = new Ast.Node();
Ast.Expression.isExpression = true;
Ast.Expression.isStatement = false;

Ast.AssignmentExpression = function AssignmentExpression(loc, range, comments,
                                     operator, left, right) {
  Ast.Expression.call(this, loc, range, comments);
  this.operator = operator;
  this.left = left;
  this.right = right;
};
Ast.AssignmentExpression.prototype = new Ast.Expression().withType("AssignmentExpression");
Ast.AssignmentExpression.prototype.walk = function(cb) {
  let result;
  if ((result = this.walk_enter(cb.AssignmentExpression))) {
    return result;
  }
  if ((result = this.left.walk(cb))) {
    this.left = result;
  }
  if ((result = this.right.walk(cb))) {
    this.right = result;
  }
  return this.walk_exit(cb.AssignmentExpression);
};

Ast.BinaryExpression = function BinaryExpression(loc, range, comments,
                              operator, left, right) {
  Ast.Expression.call(this, loc, range, comments);
  this.operator = operator;
  this.left = left;
  this.right = right;
};
Ast.BinaryExpression.prototype = new Ast.Expression();
Ast.BinaryExpression.prototype.type = "BinaryExpression";
Ast.BinaryExpression.prototype.walk = function(cb) {
  let result;
  if ((result = this.walk_enter(cb.BinaryExpression))) {
    return result;
  }
  if ((result = this.left.walk(cb))) {
    this.left = result;
  }
  if ((result = this.right.walk(cb))) {
    this.right = result;
  }
  return this.walk_exit(cb.BinaryExpression);
};

Ast.CallExpression = function CallExpression(loc, range, comments, acallee, args) {
  Ast.Expression.call(this, loc, range, comments);
  this._callee = acallee;
  this._arguments = args;
  this.lambda = acallee; // Shorthand
  this.args = args;      // Shorthand
};
Ast.CallExpression.prototype = new Ast.Expression();
Ast.CallExpression.prototype.type = "CallExpression";
// Workaround as `callee` and `arguments` are keywords in strict mode
Object.defineProperty(Ast.CallExpression.prototype,
                      "arguments", {
                        get: function() { return this._arguments ; },
                        set: function(x) { this._arguments = x; }
                      });
Object.defineProperty(Ast.CallExpression.prototype,
                      "callee", {
                        get: function() { return this._callee ; },
                        set: function(x) { this._callee = x; }
                      });
Ast.CallExpression.prototype.walk = function(cb) {
  if (cb.CallExpression && cb.CallExpression.enter) {
    cb.CallExpression.enter(this);
  }
  let result = this.callee.walk(cb);
  if (result) {
    this.callee = result;
  }
  walk_array(this.args, cb);
  if (cb.CallExpression && cb.CallExpression.exit) {
    return cb.CallExpression.exit(this);
  }
  return null;
};

Ast.FunctionExpression = function FunctionExpression(loc, range, comments,
                                   id, params, body, meta) {
  Ast.Expression.call(this, loc, range, comments);
  this.id = id;
  this.params = params;
  this.body = body;
  this.meta = meta;
};
Ast.FunctionExpression.prototype = new Ast.Expression();
Ast.FunctionExpression.prototype.type = "FunctionExpression";
Ast.FunctionExpression.prototype.walk = function(cb) {
  let result;
  if ((result = this.walk_enter(cb.FunctionExpression))) {
    return result;
  }
  if (this.id && (result = this.id.walk(cb))) {
    this.id = result;
  }
  walk_array(this.params, cb);
  if ((result = this.body.walk(cb))) {
    this.body = result;
  }
  return this.walk_exit(cb.FunctionExpression);
};

Ast.MemberExpression = function MemberExpression(loc, range, comments,
                                 object, property,
                                 computed) {
  Ast.Expression.call(this, loc, range, comments);
  this.object = object;
  this.property = property;
  this.computed = computed;
};

Ast.MemberExpression.prototype = new Ast.Expression();
Ast.MemberExpression.prototype.type = "MemberExpression";
Ast.MemberExpression.prototype.walk = function(cb) {
  let result;
  if ((result = this.walk_enter(cb.MemberExpression))) {
    return result;
  }
  if ((result = this.object.walk(cb))) {
    this.object = result;
  }
  if (this.computed && (result = this.property.walk(cb))) {
    this.property = result;
  }
  return this.walk_exit(cb.MemberExpression);
};

Ast.NewExpression = function NewExpression(loc, range, comments,
                                           constructor, args)
{
  Ast.Expression.call(this, loc, range, comments);
  this.constructor = constructor; // esprima-style
  this.callee = constructor; // SpiderMonkey-style
  this._arguments = args;
};
Ast.NewExpression.prototype = new Ast.Expression().withType("NewExpression");
// Workaround as `arguments` is a keyword in strict mode
Object.defineProperty(Ast.NewExpression.prototype,
                      "arguments", {
                        get: function() { return this._arguments ; },
                        set: function(x) { this._arguments = x; }
                      });
Ast.NewExpression.prototype.walk = function(cb) {
  let result;
  if ((result = this.walk_enter(cb.NewExpression))) {
    return result;
  }
  if ((result = this.constructor.walk(cb))) {
    this.constructor = result;
  }
  walk_array(this._arguments, cb);
  return this.walk_exit(cb.NewExpression);
};

Ast.ObjectExpression = function ObjectExpression(loc, range, comments,
                                                 properties) {
  Ast.Expression.call(this, loc, range, comments);
  this.properties = properties;
};
Ast.ObjectExpression.prototype = new Ast.Expression();
Ast.ObjectExpression.prototype.type = "ObjectExpression";
Ast.ObjectExpression.prototype.walk = function(cb) {
  let result;
  if ((result = this.walk_enter(cb.ObjectExpression))) {
    return result;
  }
  walk_array(this.properties, cb);
  return this.walk_exit(cb.ObjectExpression);
};

Ast.ThisExpression = function ThisExpression(loc, range, comments) {
  Ast.Expression.call(this, loc, range, comments);
};
Ast.ThisExpression.prototype = new Ast.Expression().withType("ThisExpression");
Ast.ThisExpression.prototype.walk = function(cb) {
  let result;
  if ((result = this.walk_enter(cb.ThisExpression))) {
    return result;
  }
  return this.walk_exit(cb.ThisExpression);
};

Ast.UnaryExpression = function UnaryExpression(loc, range, comments,
                                               operator, prefix, arg) {
  Ast.Expression.call(this, loc, range, comments);
  this.operator = operator;
  this.argument = arg;
  this.prefix = prefix;
};
Ast.UnaryExpression.prototype = new Ast.Expression().withType("UnaryExpression");
Ast.UnaryExpression.prototype.walk = function(cb) {
  let mycb = cb.UnaryExpression;
  let result;
  if ((result = this.walk_enter(mycb))) {
    return result;
  }
  if ((result = this.argument.walk(cb))) {
    this.argument = result;
  }
  return this.walk_exit(mycb);
};


Ast.UpdateExpression = function UpdateExpression(loc, range, comments,
                                                 operator, prefix, arg) {
  Ast.Expression.call(this, loc, range, comments);
  this.operator = operator;
  this.argument = arg;
  this.prefix = prefix;
};
Ast.UpdateExpression.prototype = new Ast.Expression().withType("UpdateExpression");
Ast.UpdateExpression.prototype.walk = function(cb) {
  let mycb = cb.UpdateExpression;
  let result;
  if ((result = this.walk_enter(mycb))) {
    return result;
  }
  if ((result = this.argument.walk(cb))) {
    this.argument = result;
  }
  return this.walk_exit(mycb);
};

Ast.Statement = function Statement(loc, range, comments) {
  Ast.Node.call(this, loc, range, comments);
};
Ast.Statement.prototype = new Ast.Node();
Object.defineProperty(Ast.Statement.prototype,
                      "isStatement",
                      {
                        value: true
                      }
                     );
Object.defineProperty(Ast.Statement.prototype,
                      "isExpression",
                      {
                        value: false
                      }
                     );


Ast.BlockStatement = function BlockStatement(loc, range, comments, body) {
  Ast.Statement.call(this, loc, range, comments);
  this.body = body;
};
Ast.BlockStatement.prototype = new Ast.Statement();
Ast.BlockStatement.prototype.type = "BlockStatement";
Ast.BlockStatement.prototype.walk = function(cb) {
  let result;
  if ((result = this.walk_enter(cb.BlockStatement))) {
    return result;
  }
  walk_array(this.body, cb);
  return this.walk_exit(cb.BlockStatement);
};


Ast.Declaration = function Declaration(loc, range, comments) {
  Ast.Statement.call(this, loc, range, comments);
};
Ast.Declaration.prototype = new Ast.Statement();

Ast.EmptyStatement = function EmptyStatement(loc, range, comments) {
  Ast.Statement.call(this, loc, range, comments);
};
Ast.EmptyStatement.prototype = new Ast.Statement();

Ast.ExpressionStatement = function ExpressionStatement(loc, range, comments, expr) {
  Ast.Statement.call(this, loc, range, comments);
  this.expression = expr;
};
Ast.ExpressionStatement.prototype = new Ast.Statement();
Ast.ExpressionStatement.prototype.type = "ExpressionStatement";
Ast.ExpressionStatement.prototype.walk = function(cb) {
  let result;
  if ((result = this.walk_enter(cb.ExpressionStatement))) {
    return result;
  }
  if ((result = this.expression.walk(cb))) {
    this.expression = result;
  }
  return this.walk_exit(cb.ExpressionStatement);
};

Ast.ReturnStatement = function ReturnStatement(loc, range, comments, argument) {
  Ast.Statement.call(this, loc, range, comments);
  this.argument = argument;
};
Ast.ReturnStatement.prototype = new Ast.Statement().withType("ReturnStatement");
Ast.ReturnStatement.prototype.walk = function(cb) {
  let result;
  if ((result = this.walk_enter(cb.ReturnStatement))) {
    return result;
  }
  if ((result = this.argument.walk(cb))) {
    this.argument = result;
  }
  return this.walk_exit(cb.ReturnStatement);
};

Ast.ThrowStatement = function ThrowStatement(loc, range, comments,
                                             argument) {
  Ast.Statement.call(this, loc, range, comments);
  this.argument = argument;
};
Ast.ThrowStatement.prototype = new Ast.Statement().withType("ThrowStatement");
Ast.ThrowStatement.prototype.walk = function(cb) {
  let result;
  if ((result = this.walk_enter(cb.ThrowStatement))) {
    return result;
  }
  if ((result = this.argument.walk(cb))) {
    this.argument = result;
  }
  return this.walk_exit(cb.ThrowStatement);
};

Ast.TryStatement = function TryStatement(loc, range, comments, block, handlers, finalizer) {
  Ast.Statement.call(this, loc, range, comments);
  this.block = block;
  this.handlers = handlers;
  this.finalizer = finalizer;
};
Ast.TryStatement.prototype = new Ast.Statement().withType("TryStatement");
Ast.TryStatement.prototype.walk = function(cb) {
  let result;
  if ((result = this.walk_enter(cb.TryStatement))) {
    return result;
  }
  if ((result = this.block.walk(cb))) {
    this.block = result;
  }
  walk_array(this.handlers, cb);
  if (this.finalizer && (result = this.finalizer.walk(cb))) {
    this.finalizer = result;
  }
  return this.walk_exit(cb.TryStatement);
};

Ast.ForStatement = function ForStatement(loc, range, comments,
                            init, test, update, body) {
  Ast.Statement.call(this, loc, range, comments);
  this.init = init;
  this.test = test;
  this.update = update;
  this.body = body;
};
Ast.ForStatement.prototype = new Ast.Statement().withType("ForStatement");
Ast.ForStatement.prototype.walk = function(cb) {
  let mycb = cb.ForStatement;
  let result;
  if ((result = this.walk_enter(mycb))) {
    return result;
  }
  if (this.init && (result = this.init.walk(cb))) {
    this.init = result;
  }
  if (this.test && (result = this.test.walk(cb))) {
    this.test = result;
  }
  if (this.update && (result = this.update.walk(cb))) {
    this.update = result;
  }
  if (this.body && (result = this.body.walk(cb))) {
    this.body = result;
  }
  return this.walk_exit(mycb);
};


Ast.IfStatement = function IfStatement(loc, range, comments,
                           test, consequent, alternate) {
  Ast.Statement.call(this, loc, range, comments);
  this.test = test;
  this.consequent = consequent;
  this.alternate = alternate;
};
Ast.IfStatement.prototype = new Ast.Statement().withType("IfStatement");
Ast.IfStatement.prototype.walk = function(cb) {
  let result;
  if ((result = this.walk_enter(cb.IfStatement))) {
    return result;
  }
  if ((result = this.test.walk(cb))) {
    this.test = result;
  }
  if ((result = this.consequent.walk(cb))) {
    this.consequent = result;
  }
  if (this.alternate && (result = this.alternate.walk(cb))) {
    this.alternate = result;
  }
  return this.walk_exit(cb.IfStatement);
};

Ast.Identifier = function Identifier(loc, range, comments, name, isexpr, info) {
  Ast.Node.call(this, loc, range, comments);
  this.name = name;
  this.isexpr = isexpr || false;
  this.info = info || {};
};
Ast.Identifier.prototype = new Ast.Node();
Ast.Identifier.prototype.type = "Identifier";
Ast.Identifier.prototype.become = function(original) {
  if (!(original instanceof Ast.Identifier)) {
    throw new TypeError("Ast.Identifier.prototype.become "+original.type);
  }
  this.name = original.name; // Canonicalize string
  this.info = original.info;
};
Ast.Identifier.prototype.walk = function(cb) {
  let result;
  if ((result = this.walk_enter(cb.Identifier))) {
    return result;
  }
  return this.walk_exit(cb.Identifier);
};

Ast.Literal = function Literal(loc, range, comments, value) {
  Ast.Expression.call(this, loc, range, comments);
  this.value = value;
};
Ast.Literal.prototype = new Ast.Expression().withType("Literal");
Ast.Literal.prototype.walk = function(cb) {
  let result;
  if ((result = this.walk_enter(cb.Literal))) {
    return result;
  }
  return this.walk_exit(cb.Literal);
};

Ast.LogicalExpression = function LogicalExpression(loc, range, comments,
                                                   operator, left, right) {
  Ast.Expression.call(this, loc, range, comments);
  this.operator = operator;
  this.left = left;
  this.right = right;
};
Ast.LogicalExpression.prototype = new Ast.Expression().withType("LogicalExpression");
Ast.LogicalExpression.prototype.walk = function(cb) {
  let result;
  if ((result = this.walk_enter(cb.LogicalExpression))) {
    return result;
  }
  if ((result = this.left.walk(cb))) {
    this.left = result;
  }
  if ((result = this.right.walk(cb))) {
    this.right = result;
  }
  return this.walk_exit(cb.LogicalExpression);
};


/**
 * @param {Ast.Identifier} id
 * @param {Ast.Expression?} init
 */
Ast.VariableDeclarator = function VariableDeclarator(loc, range, comments, id, init, kind) {
  Ast.Node.call(this, loc, range, comments);
  this.id = id;
  this.init = init;
  this.kind = kind;
};
Ast.VariableDeclarator.prototype = new Ast.Node();
Ast.VariableDeclarator.prototype.type = "VariableDeclarator";
Ast.VariableDeclarator.prototype.isLet = function() {
  return this.kind == "let";
};
Ast.VariableDeclarator.prototype.isVar = function() {
  return this.kind == "var";
};
Ast.VariableDeclarator.prototype.isConst = function() {
  return this.kind == "const";
};
Ast.VariableDeclarator.prototype.isParam = function() {
  return this.kind == "argument";
};
Ast.VariableDeclarator.prototype.walk = function(cb) {
  let result;
  if ((result = this.walk_enter(cb.VariableDeclarator))) {
    return result;
  }
  if (this.init && (result = this.init.walk(cb))) {
    this.init = result;
  }
  return this.walk_exit(cb.VariableDeclarator);
};
/**
 * A set of variable declarations
 *
 * @param {Array.<Ast.VariableDeclarator>} declarations
 */
Ast.VariableDeclaration = function VariableDeclaration(loc, range, comments,
                                         declarations, kind,
                                         info) {
  Ast.Declaration.call(this, loc, range, comments);
  this.declarations = declarations;
  this.kind = kind;
  this.info = info || {};
};
Ast.VariableDeclaration.prototype = new Ast.Declaration();
Ast.VariableDeclaration.prototype.type = "VariableDeclaration";
Ast.VariableDeclaration.prototype.walk = function(cb) {
  let result;
  if ((result = this.walk_enter(cb.VariableDeclaration))) {
    return result;
  }
  walk_array(this.declarations, cb);
  return this.walk_exit(cb.VariableDeclaration);
};

Ast.FunctionDeclaration = function FunctionDeclaration(loc, range, comments,
                                         id, params, body,
                                         meta) {
  Ast.Declaration.call(this, loc, range, comments);
  this.id = id;
  this.params = params;
  this.body = body;
  this.meta = meta;
};
Ast.FunctionDeclaration.prototype = new Ast.Declaration();
Ast.FunctionDeclaration.prototype.type = "FunctionDeclaration";
Ast.FunctionDeclaration.prototype.walk = function(cb) {
  let result;
  if ((result = this.walk_enter(cb.FunctionDeclaration))) {
    return result;
  }
  if ((result = this.id.walk(cb))) {
    this.id = result;
  }
  walk_array(this.params, cb);
  if ((result = this.body.walk(cb))) {
    this.body = result;
  }
  return this.walk_exit(cb.FunctionDeclaration);
};

Ast.Clause = function Clause(loc, range, comments) {
  Ast.Node.call(this, loc, range, comments);
};

Ast.CatchClause = function CatchClause(loc, range, comments, param, guard, body) {
  Ast.Clause.call(this, loc, range, comments);
  this.param = param;
  this.guard = guard;
  this.body = body;
};
Ast.CatchClause.prototype = new Ast.Node();
Ast.CatchClause.prototype.type = "CatchClause";
Ast.CatchClause.prototype.walk = function(cb) {
  this.walk_enter(cb.CatchClause);
  let result;
  if ((result = this.param.walk(cb))) {
    this.param = result;
  }
  if (this.guard && (result = this.guard.walk(cb))) {
    this.guard = result;
  }
  if ((result = this.body.walk(cb))) {
    this.body = result;
  }
  return this.walk_exit(cb.CatchClause);
};