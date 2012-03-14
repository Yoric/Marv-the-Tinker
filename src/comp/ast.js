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

function walk_enter(obj, walker) {
  Debug.log("Entering "+obj.type);
  if (walker && walker.enter) {
    walker.enter(obj);
  }
}
function walk_exit(obj, walker) {
  if (walker && walker.exit) {
    return walker.exit(obj);
  }
  return null;
}


/**
 * @param {number} line
 * @param {number} column
 * @constructor
 */
Ast.Position = function(line, column) {
  this.line = line;
  this.column = column;
};
Ast.Position.prototype = {
  toString: function() {
    return ""+this.line+":"+this.column;
  }
};
Ast.SourceLocation = function(fileName, start, end) {
  this.source = fileName;
  this.start  = start;
  this.end    = end;
};
Ast.SourceLocation.prototype = {
  toString: function() {
    return this.source+" ["+this.start+"-"+this.end+"]";
  }
};
Ast.Directive = function(range, type, string, key, code, name) {
  this.type  = type;
  this.value = string;
  this.key = key;
  this.code = code;
  this.name = name;
};

Ast.Node = function(loc, range, comments) {
  this.loc = loc;
  this.range = range;
  this.comments = comments;
};
Ast.Node.prototype = {
  walk: function() {
    throw new Error(this.type+".walk() not implemented yet");
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
  },
};

Ast.Program = function(loc, range, comments, elements, directives) {
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

Ast.Expression = function(loc, range, comments) {
  Ast.Node.call(this, loc, range, comments);
  return this;
};
Ast.Expression.prototype = new Ast.Node();
Ast.Expression.isExpression = true;
Ast.Expression.isStatement = false;

Ast.AssignmentExpression = function(loc, range, comments,
                                     operator, left, right) {
  Ast.Expression.call(this, loc, range, comments);
  this.operator = operator;
  this.left = left;
  this.right = right;
};
Ast.AssignmentExpression.prototype.type = "AssignmentExpression";
Ast.AssignmentExpression.prototype.walk = function(cb) {
  walk_enter(this, cb.AssignmentExpression);
  let result;
  if ((result = this.left.walk(cb))) {
    this.left = result;
  }
  if ((result = this.right.walk(cb))) {
    this.right = result;
  }
  return walk_exit(this, cb.AssignmentExpression);
};

Ast.BinaryExpression = function(loc, range, comments,
                              operator, left, right) {
  Ast.Expression.call(this, loc, range, comments);
  this.operator = operator;
  this.left = left;
  this.right = right;
};
Ast.BinaryExpression.prototype = new Ast.Expression();
Ast.BinaryExpression.prototype.type = "BinaryExpression";
Ast.BinaryExpression.prototype.walk = function(cb) {
  walk_enter(this, cb.BinaryExpression);
  let result;
  if ((result = this.left.walk(cb))) {
    this.left = result;
  }
  if ((result = this.right.walk(cb))) {
    this.right = result;
  }
  return walk_exit(this, cb.BinaryExpression);
};

Ast.CallExpression = function(loc, range, comments, acallee, args) {
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

Ast.FunctionExpression = function(loc, range, comments,
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
  walk_enter(this, cb.FunctionExpression);
  let result;
  if (this.id && (result = this.id.walk(cb))) {
    this.id = result;
  }
  walk_array(this.params, cb);
  if ((result = this.body.walk(cb))) {
    this.body = result;
  }
  return walk_exit(this, cb.FunctionExpression);
};

Ast.MemberExpression = function(loc, range, comments,
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
  walk_enter(this, cb.MemberExpression);
  let result;
  if ((result = this.object.walk(cb))) {
    this.object = result;
  }
  if (this.computed && (result = this.property.walk(cb))) {
    this.property = result;
  }
  return walk_exit(this, cb.MemberExpression);
};

Ast.ObjectExpression = function(loc, range, comments, properties) {
  Ast.Expression.call(this, loc, range, comments);
  this.properties = properties;
};
Ast.ObjectExpression.prototype = new Ast.Expression();
Ast.ObjectExpression.prototype.type = "ObjectExpression";
Ast.ObjectExpression.prototype.walk = function(cb) {
  walk_enter(this, cb.ObjectExpression);
  walk_array(this.properties, cb);
  return walk_exit(this, cb.ObjectExpression);
};

Ast.ThisExpression = function(loc, range, comments) {
  Ast.Expression.call(this, loc, range, comments);
};
Ast.ThisExpression.prototype = new Ast.Expression();
Ast.ThisExpression.prototype.type = "ThisExpression";
Ast.ThisExpression.prototype.walk = function(cb) {
  walk_enter(this, cb.ThisExpression);
  return walk_exit(this, cb.ThisExpression);
};

Ast.UpdateExpression = function(loc, range, comments,
                                operator, argument, prefix) {
  Ast.UpdateExpression.call(this, loc, range, comments);
  this.operator = operator;
  this.argument = argument;
  this.prefix = prefix;
};
Ast.UpdateExpression.prototype = new Ast.Expression().withType("UpdateExpression");
Ast.UpdateExpression.walk = function(cb) {
  let mycb = cb.UpdateExpression;
  walk_enter(this, mycb);
  let result;
  if ((result = this.operator.walk(cb))) {
    this.operator = result;
  }
  if ((result = this.argument.walk(cb))) {
    this.argument = result;
  }
  return walk_exit(this, mycb);
};

Ast.Statement = function(loc, range, comments) {
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


Ast.BlockStatement = function(loc, range, comments, body) {
  Ast.Statement.call(this, loc, range, comments);
  this.body = body;
};
Ast.BlockStatement.prototype = new Ast.Statement();
Ast.BlockStatement.prototype.type = "BlockStatement";
Ast.BlockStatement.prototype.walk = function(cb) {
  walk_enter(this, cb.BlockStatement);
  walk_array(this.body, cb);
  return walk_exit(this, cb.BlockStatement);
};


Ast.Declaration = function(loc, range, comments) {
  Ast.Statement.call(this, loc, range, comments);
};
Ast.Declaration.prototype = new Ast.Statement();

Ast.EmptyStatement = function(loc, range, comments) {
  Ast.Statement.call(this, loc, range, comments);
};
Ast.EmptyStatement.prototype = new Ast.Statement();

Ast.ExpressionStatement = function(loc, range, comments, expr) {
  Ast.Statement.call(this, loc, range, comments);
  this.expression = expr;
};
Ast.ExpressionStatement.prototype = new Ast.Statement();
Ast.ExpressionStatement.prototype.type = "ExpressionStatement";
Ast.ExpressionStatement.prototype.walk = function(cb) {
  walk_enter(this, cb.ExpressionStatement);
  let result = this.expression.walk(cb);
  if (result) {
    this.expression = result;
  }
  return walk_exit(this, cb.ExpressionStatement);
};

Ast.TryStatement = function(loc, range, comments, block, handlers, finalizer) {
  Ast.Statement.call(this, loc, range, comments);
  this.block = block;
  this.handlers = handlers;
  this.finalizer = finalizer;
};
Ast.TryStatement.prototype = new Ast.Statement();
Ast.TryStatement.prototype.type = "TryStatement";
Ast.TryStatement.prototype.walk = function(cb) {
  walk_enter(this, cb.TryStatement);
  let result;
  if ((result = this.block.walk(cb))) {
    this.block = result;
  }
  walk_array(this.handlers, cb);
  if (this.finalizer && (result = this.finalizer.walk(cb))) {
    this.finalizer = result;
  }
  return walk_exit(this, cb.TryStatement);
};

Ast.ForStatement = function(loc, range, comments,
                            init, test, update, body) {
  Ast.Statement.call(this, loc, range, comments);
  this.init = init;
  this.test = test;
  this.update = update;
  this.body = body;
};
Ast.ForStatement.prototype = new Ast.Statement().withType("ForStatement");
Ast.ForStatement.walk = function(cb) {
  let mycb = cb.ForStatement;
  walk_enter(this, mycb);
  let result;
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
  return walk_exit(this, mycb);
};


Ast.IfStatement = function(loc, range, comments,
                           test, consequent, alternate) {
  Ast.Statement.call(this, loc, range, comments);
  this.test = test;
  this.consequent = consequent;
  this.alternate = alternate;
};
Ast.IfStatement.prototype = new Ast.Statement();
Ast.IfStatement.prototype.type = "IfStatement";


Ast.Identifier = function(loc, range, comments, name, isexpr, info) {
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
  Debug.log("Walking through an identifier");
  Debug.log(Object.keys(cb));
  walk_enter(this, cb.Identifier);
  return walk_exit(this, cb.Identifier);
};

Ast.Literal = function(loc, range, comments, value) {
  Ast.Expression.call(this, loc, range, comments);
  this.value = value;
};
Ast.Literal.prototype = new Ast.Expression();
Ast.Literal.prototype.type = "Literal";
Ast.Literal.prototype.walk = function(cb) {
  if (cb.Literal && cb.Literal.enter) {
    cb.Literal.enter(this);
  }
  if (cb.Literal && cb.Literal.exit) {
    return cb.Literal.exit(this);
  }
  return null;
};

/**
 * @param {Ast.Identifier} id
 * @param {Ast.Expression?} init
 */
Ast.VariableDeclarator = function(loc, range, comments, id, init, kind) {
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
  if (cb.VariableDeclarator && cb.VariableDeclarator.enter) {
    cb.VariableDeclarator.enter(this);
  }
  if (this.init) {
    let current = this.init.walk(cb);
    if (current) {
      this.init = init;
    }
  }
  if (cb.VariableDeclarator && cb.VariableDeclarator.exit) {
    return cb.VariableDeclarator.exit(this);
  }
  return null;
};
/**
 * A set of variable declarations
 *
 * @param {Array.<Ast.VariableDeclarator>} declarations
 */
Ast.VariableDeclaration = function(loc, range, comments,
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
  walk_enter(this, cb.VariableDeclaration);
  walk_array(this.declarations, cb);
  return walk_exit(this, cb.VariableDeclaration);
};

Ast.FunctionDeclaration = function(loc, range, comments,
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
  walk_enter(this, cb.FunctionDeclaration);
  let result;
  if ((result = this.id.walk(cb))) {
    this.id = result;
  }
  walk_array(this.params, cb);
  if ((result = this.body.walk(cb))) {
    this.body = result;
  }
  return walk_exit(cb.FunctionDeclaration);
};

Ast.Clause = function(loc, range, comments) {
  Ast.Node.call(this, loc, range, comments);
};

Ast.CatchClause = function(loc, range, comments, param, guard, body) {
  Ast.Clause.call(this, loc, range, comments);
  this.param = param;
  this.guard = guard;
  this.body = body;
};
Ast.CatchClause.prototype = new Ast.Node();
Ast.CatchClause.prototype.type = "CatchClause";
Ast.CatchClause.prototype.walk = function(cb) {
  walk_enter(this, cb.CatchClause);
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
  return walk_exit(this, cb.CatchClause);
};