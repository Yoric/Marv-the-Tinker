let Ast = {};
exports = Ast;

// Logistics

function walk_array(array, cb) {
  for (let i = 0; i < array.length; ++i) {
    print(array[i].type);
    let current = array[i].walk(cb);
    if (current) {
      array[i] = current;
    }
  }
}

function walk_enter(obj, walker) {
  print("Entering "+obj.type);
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
Ast.Directive = function(lines, range, type, string, key, code, name) {
  this.type  = type;
  this.value = string;
  this.key = key;
  this.code = code;
  this.name = name;
  this.lines = lines;
};

Ast.Node = function(loc, range, comments) {
  this.loc = loc;
  this.range = range;
  this.comments = comments;
};
Ast.Node.prototype = {
  toJS: function() {
    print(""+this.type+".toJS() not implemented yet");
  },
  walk: function() {
    print(""+this.type+".walk() not implemented yet");
  }
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

Ast.Expression.Assignment = function(loc, range, comments,
                                     operator, left, right) {
  Ast.Expression.Call(this, loc, range, comments);
  this.operator = operator;
  this.left = left;
  this.right = right;
};
Ast.Expression.Assignment.prototype.type = "AssignmentExpression";
Ast.Expression.Assignment.prototype.walk = function(cb) {
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

Ast.Expression.Bin = function(loc, range, comments,
                              operator, left, right) {
  Ast.Expression.call(this, loc, range, comments);
  this.operator = operator;
  this.left = left;
  this.right = right;
};
Ast.Expression.Bin.prototype = new Ast.Expression();
Ast.Expression.Bin.prototype.type = "BinaryExpression";
Ast.Expression.Bin.prototype.walk = function(cb) {
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

Ast.Expression.Call = function(loc, range, comments, callee, args) {
  Ast.Expression.call(this, loc, range, comments);
  this.callee = callee;
  this['arguments'] = args;
  this.args = args; // Shorthand
};
Ast.Expression.Call.prototype = new Ast.Expression();
Ast.Expression.Call.prototype.type = "CallExpression";
Ast.Expression.Call.prototype.walk = function(cb) {
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

Ast.Expression.Function = function(loc, range, comments,
                                   id, params, body, meta) {
  Ast.Expression.call(this, loc, range, comments);
  this.id = id;
  this.params = params;
  this.body = body;
  this.meta = meta;
};
Ast.Expression.Function.prototype = new Ast.Expression();
Ast.Expression.Function.prototype.type = "FunctionExpression";
Ast.Expression.Function.prototype.walk = function(cb) {
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

Ast.Expression.Member = function(loc, range, comments,
                                 object, property,
                                 computed) {
  Ast.Expression.call(this, loc, range, comments);
  this.object = object;
  this.property = property;
  this.computed = computed;
};
Ast.Expression.Member.prototype = new Ast.Expression();
Ast.Expression.Member.prototype.type = "MemberExpression";
Ast.Expression.Member.prototype.walk = function(cb) {
  if (cb.MemberExpression && cb.MemberExpression.enter) {
    cb.MemberExpression.enter(this);
  }
  let result;
  result = this.object.walk(cb);
  if (result) {
    this.object = result;
  }
  if (this.computed) {
    result = this.property.walk(cb);
    if (result) {
      this.property = property;
    }
  }
  if (cb.MemberExpression && cb.MemberExpression.exit) {
    return cb.MemberExpression.exit(this);
  }
  return null;
};

Ast.Expression.This = function(loc, range, comments) {
  Ast.Expression.call(this, loc, range, comments);
};
Ast.Expression.This.prototype = new Ast.Expression();
Ast.Expression.This.prototype.type = "ThisExpression";
Ast.Expression.This.prototype.walk = function(cb) {
  walk_enter(this, cb.ThisExpression);
  return walk_exit(this, cb.ThisExpression);
};

Ast.Statement = function(loc, range, comments) {
  Ast.Node.call(this, loc, range, comments);
};
Ast.Statement.prototype = new Ast.Node();

Ast.Statement.Block = function(loc, range, comments, body) {
  Ast.Statement.call(this, loc, range, comments);
  this.body = body;
};
Ast.Statement.Block.prototype = new Ast.Statement();
Ast.Statement.Block.prototype.type = "BlockStatement";
Ast.Statement.Block.prototype.walk = function(cb) {
  print("Walking through a block statement");
  walk_enter(this, cb.BlockStatement);
  walk_array(this.body, cb);
  return walk_exit(this, cb.BlockStatement);
};


Ast.Statement.Declaration = function(loc, range, comments) {
  Ast.Statement.call(this, loc, range, comments);
};
Ast.Statement.Declaration.prototype = new Ast.Statement();

Ast.Statement.Expression = function(loc, range, comments, expr) {
  Ast.Statement.call(this, loc, range, comments);
  this.expression = expr;
};
Ast.Statement.Expression.prototype = new Ast.Statement();
Ast.Statement.Expression.prototype.type = "ExpressionStatement";
Ast.Statement.Expression.prototype.walk = function(cb) {
  if (cb.ExpressionStatement && cb.ExpressionStatement.enter) {
    cb.ExpressionStatement.enter(this);
  }
  let result = this.expression.walk(cb);
  if (result) {
    this.expression = result;
  }
  if (cb.ExpressionStatement && cb.ExpressionStatement.exit) {
    return cb.ExpressionStatement.exit(this);
  }
};

Ast.Statement.Try = function(loc, range, comments, block, handlers, finalizer) {
  Ast.Statement.call(this, loc, range, comments);
  this.block = block;
  this.handlers = handlers;
  this.finalizer = finalizer;
};
Ast.Statement.Try.prototype = new Ast.Statement();
Ast.Statement.Try.prototype.type = "TryStatement";


Ast.Identifier = function(loc, range, comments, name, isexpr, info) {
  Ast.Node.call(this, loc, range, comments);
  this.name = name;
  this.isexpr = isexpr || false;
  this.info = info || {};
};
Ast.Identifier.prototype = new Ast.Node();
Ast.Identifier.prototype.type = "Identifier";
Ast.Identifier.prototype.become = function(original) {
  this.name = original.name; // Canonicalize string
  this.info = original.info;
};
Ast.Identifier.prototype.walk = function(cb) {
  print("Walking through an identifier");
  print(Object.keys(cb));
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
Ast.Definition = function(loc, range, comments, id, init, kind) {
  Ast.Node.call(this, loc, range, comments);
  this.id = id;
  this.init = init;
  this.kind = kind;
};
Ast.Definition.prototype = new Ast.Node();
Ast.Definition.prototype.type = "VariableDeclarator";
Ast.Definition.prototype.isLet = function() {
  return this.kind == "let";
};
Ast.Definition.prototype.isVar = function() {
  return this.kind == "var";
};
Ast.Definition.prototype.isConst = function() {
  return this.kind == "const";
};
Ast.Definition.prototype.isParam = function() {
  return this.kind == "argument";
};
Ast.Definition.prototype.walk = function(cb) {
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
 * @param {Array.<Ast.Definition>} declarations
 */
Ast.Statement.Declaration.Var = function(loc, range, comments,
                                         declarations, kind,
                                         info) {
  Ast.Statement.Declaration.call(this, loc, range, comments);
  this.declarations = declarations;
  this.kind = kind;
  this.info = info || {};
};
Ast.Statement.Declaration.Var.prototype = new Ast.Statement.Declaration();
Ast.Statement.Declaration.Var.prototype.type = "VariableDeclaration";
Ast.Statement.Declaration.Var.prototype.walk = function(cb) {
  walk_enter(this, cb.VariableDeclaration);
  walk_array(this.declarations, cb);
  return walk_exit(this, cb.VariableDeclaration);
};

Ast.Statement.Declaration.Fun = function(loc, range, comments,
                                         id, params, body,
                                         meta) {
  Ast.Statement.Declaration.call(this, loc, range, comments);
  this.id = id;
  this.params = params;
  this.body = body;
  this.meta = meta;
};
Ast.Statement.Declaration.Fun.prototype = new Ast.Statement.Declaration();
Ast.Statement.Declaration.Fun.prototype.type = "FunctionDeclaration";
Ast.Statement.Declaration.Fun.prototype.walk = function(cb) {
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

Ast.Clause.Catch = function(loc, range, comments, param, guard, body) {
  Ast.Clause.call(this, loc, range, comments);
  this.param = param;
  this.guard = guard;
  this.body = body;
};
Ast.Clause.Catch.prototype = new Ast.Clause.Catch();
Ast.Clause.Catch.prototype.type = "CatchClause";
