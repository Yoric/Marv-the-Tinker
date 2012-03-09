let Ast = {};
exports = Ast;

// Logistics

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
Ast.Comments = function(comments) {
  this.value = comments;
};
Ast.Comments.prototype = {
  toString: function() {
    let result = "";
    for (let i = 0; i < this.value.length; ++i) {
      let current = this.value[i];
      if (current.type == "Block") {
        result += "/*" + current.value + "*/\n";
      } else if (current.type == "Line") {
        result += "// "+current.value+"\n";
      } else {
        throw new Error(current.toSource());
      }
    }
    return result;
  }
};

Ast.Node = function(loc, range, comments) {
  this.loc = loc;
  this.range = range;
  this.comments = comments;
};
Ast.Node.prototype = {
  toJS: function() {
    return ""+this.type+".toJS() not implemented yet";
  }
};

Ast.Program = function(loc, range, comments, elements) {
  Ast.Node.call(this, loc, range, comments);
  this.elements = elements; // SpiderMonkey-style
  this.body = elements; // esprima-style
};
Ast.Program.prototype = new Ast.Node();
Ast.Program.prototype.type = "Program";
Ast.Program.prototype.toJS = function(options) {
    let result = "";
    for (let i = 0; i < this.body.length - 1; ++i) {
      result += this.body[i].toJS();
      result += "\n";
    }
    if (this.body.length > 0) {
      result += this.body[this.body.length - 1].toJS();
    }
    return result;
  };


Ast.Expression = function(loc, range, comments) {
  Ast.Node.call(this, loc, range, comments);
  return this;
};

Ast.Expression.Bin = function(loc, range, comments,
                              operator, left, right) {
  Ast.Expression.call(this, loc, range, comments);
  this.operator = operator;
  this.left = left;
  this.right = right;
};
Ast.Expression.Bin.prototype = {
  type: "BinaryExpression"
};

Ast.Expression.Call = function(loc, range, comments, callee, args) {
  Ast.Expression.call(this, loc, range, comments);
  this.callee = callee;
  this['arguments'] = args;
  this.args = args; // Shorthand
};
Ast.Expression.Call.prototype = new Ast.Expression.Call();
Ast.Expression.Call.prototype.type = "CallExpression";

Ast.Expression.Function = function(loc, range, comments,
                                   id, params, body, meta) {
  Ast.Expression.call(this, loc, range, comments);
  this.id = id;
  this.params = params;
  this.body = body;
  this.meta = meta;
};
Ast.Expression.Function.prototype = {
  type: "FunctionExpression"
};


Ast.Expression.Member = function(loc, range, comments,
                                 object, property,
                                 computed) {
  Ast.Expression.call(this, loc, range, comments);
  this.object = object;
  this.property = property;
  this.computed = computed;
};
Ast.Expression.Member.prototype = {
  type: "MemberExpression"
};

Ast.Expression.This = function(loc, range, comments) {
  Ast.Expression.call(this, loc, range, comments);
};
Ast.Expression.This.prototype = {
  type: "ThisExpression"
};

Ast.Statement = function(loc, range, comments) {
  Ast.Node.call(this, loc, range, comments);
};
Ast.Statement.prototype = new Ast.Node();

Ast.Statement.Block = function(loc, range, comments, body) {
  Ast.Statement.call(this, loc, range, comments);
  this.body = body;
};
Ast.Statement.Block.prototype = {
  type: "BlockStatement"
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

Ast.Statement.Try = function(loc, range, comments, block, handlers, finalizer) {
  Ast.Statement.call(this, loc, range, comments);
  this.block = block;
  this.handlers = handlers;
  this.finalizer = finalizer;
};
Ast.Statement.Try.prototype = new Ast.Statement();
Ast.Statement.Try.prototype.type = "TryStatement";


Ast.Identifier = function(loc, range, comments, name) {
  Ast.Node.call(this, loc, range, comments);
  this.name = name;
};
Ast.Identifier.prototype = {
  type: "Identifier"
};

Ast.Literal = function(loc, range, comments, value) {
  Ast.Expression.call(this, loc, range, comments);
  this.value = value;
};
Ast.Literal.prototype = {
  type: "Literal"
};

Ast.Declarator = function(loc, range, comments, id, init) {
  Ast.Node.call(this, loc, range, comments);
  this.id = id;
  this.init = init;
};
Ast.Declarator.prototype = new Ast.Node();
Ast.Declarator.prototype.type = "VariableDeclarator";

Ast.Statement.Declaration.Var = function(loc, range, comments,
                                         declarations, kind) {
  Ast.Statement.Declaration.call(this, loc, range, comments);
  this.declarations = declarations;
  this.kind = kind;
};
Ast.Statement.Declaration.Var.prototype = new Ast.Statement.Declaration();
Ast.Statement.Declaration.Var.prototype.type = "VariableDeclaration";
Ast.Statement.Declaration.Var.prototype.toJS = function(options) {
  let result = this.kind + " ";
  let declarations = [];
  this.declarations.forEach(
    function(v) {
      declarations.push(v.toJS());
    }
  );
  result += declarations.join(", ");
  result += ";";
  return result;
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
