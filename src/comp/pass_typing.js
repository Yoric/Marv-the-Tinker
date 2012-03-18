//What we do not attempt to handle so far:
// - operators and other overloaded functions
// - Object.defineProperty, etc.
// - call, apply
// - prototypes (although this should happen soon)

/**
 * A constraint collected during the analysis of the source code.
 *
 * Two kinds of constraints exist: _may_ constraints and _should_ constraints.
 * A _may_ constraint represents how a JavaScript value has been created or
 * modified, while a _should_ constraint represents how a JavaScript value is
 * used. During the analysis, _should_ constraints are progressively replaced
 * by _may_ constraints. Errors arise if, at the end of analysis, _should_
 * constraints remain.
 *
 * Example:
 * { var a = []; }
 * In this example, |a| has a _may_ constraint that states that it may be
 * an array.
 *
 * { b[5] = 1; }
 * In this example, |b| has a _should_ constraint that states that it should
 * be an array.
 *
 * @param {boolean} may If |true|, this is a _may_ constraint. Otherwise, a
 * _should_ constraint.
 * @param {TypeVar} upon The content of the constraint
 * @constructor
 */
function Constraint(may, upon)
{
  if (may) {
    this._may = upon;
    this._should = null;
  } else {
    this._may = null;
    this._should = upon;
  }
}
Constraint.prototype = {
  isMay: function() {
    return this._may;
  },
  isShould: function() {
    return this._should;
  }
};
Constraint.may = function(upon) {
  return new Constraint(true, upon);
};
Constraint.should = function(upon) {
  return new Constraint(false, upon);
};

/**
 * A type variable.
 *
 * Each JS value can be:
 * - a function
 * - an object
 * - a string
 * - a number
 * - a boolean
 *
 * At this stage, we permit any subset of these 5 cases. Note that a JS value
 * can only have at most one function type and/or one object type.
 *
 * @constructor
 */
function TypeVar()
{
  /**
   * If |undefined|, the variable has never been used or defined as a function.
   * Otherwise, the variable has been used and/or defined as a function in at
   * least one path of execution.
   *
   * @type {undefined|FunctionType}
   */
  this.as_function = null;

  /**
   * If |undefined|, the variable has never been used or defined as a object.
   * Otherwise, the variable has been used and/or defined as an object in at
   * least one path of execution.
   *
   * @type {undefined|ObjectType}
   */
  this.as_object   = null;

  /**
   * If |undefined|, the variable has never been used or defined as a string.
   * If a _may_ constraint, the variable has been defined as a string in at
   * least one path. If a _should_ constraint, the variable has been used as a
   * string in at least one path.
   *
   * @type {undefined|Constraint.<*>}
   */
  this.as_string   = null;
  this.as_number   = null;// As above, but a number
  this.as_boolean  = null;// As above, bot a boolean
}

TypeVar.prototype = {
  /**
   * Unify two type variables.
   *
   * Take into account the fact that two type variables represent exactly the
   * same type, hence that the constraints of both variables must be merged,
   * and that any further constraint added to one of the variables must also
   * be added to the other variable.
   *
   * @return this
   */
  unify: function(tv) {
    // Compute unified version
    this.as_string  = TypeVar.unify_trivial(this.as_string,  tv.as_string);
    this.as_number  = TypeVar.unify_trivial(this.as_number,  tv.as_number);
    this.as_boolean = TypeVar.unify_trivial(this.as_boolean, tv.as_boolean);
    this.as_object  = TypeVar.unify_object(this.as_object,   tv.as_object);
    this.as_function= TypeVar.unify_function(this.as_function, tv.as_function);

    // Turn |tv| into an indirection for |this|
    delete tv.as_string;
    delete tv.as_number;
    delete tv.as_boolean;
    delete tv.as_object;
    delete tv.as_function;
    Object.defineProperty(
      tv,
      "as_string",
      {
        get: get_as_string.bind(this),
        set: set_as_string.bind(this),
        configurable: true
      }
    );
    Object.defineProperty(
      tv,
      "as_number",
      {
        get: get_as_number.bind(this),
        set: set_as_number.bind(this),
        configurable: true
      }
    );
    Object.defineProperty(
      tv,
      "as_boolean",
      {
        get: get_as_boolean.bind(this),
        set: set_as_boolean.bind(this),
        configurable: true
      }
    );
    Object.defineProperty(
      tv,
      "as_object",
      {
        get: get_as_object.bind(this),
        set: set_as_object.bind(this),
        configurable: true
      }
    );
    Object.defineProperty(
      tv,
      "as_function",
      {
        get: get_as_function.bind(this),
        set: set_as_function.bind(this),
        configurable: true
      }
    );
    return this;
  }
};

function get_as_string() {
  return this.as_string;
}
function get_as_number() {
  return this.as_number;
}
function get_as_boolean() {
  return this.as_boolean;
}
function get_as_object() {
  return this.as_object;
}
function get_as_boolean() {
  return this.as_boolean;
}
function get_as_function() {
  return this.as_function;
}

function set_as_string(v) {
  return this.as_string = v;
}
function set_as_number(v) {
  return this.as_number = v;
}
function set_as_boolean(v) {
  return this.as_boolean = v;
}
function set_as_object(v) {
  return this.as_object = v;
}
function set_as_boolean(v) {
  return this.as_boolean = v;
}
function set_as_boolean(v) {
  return this.as_function = v;
}

/**
 * The type of an object.
 *
 * An object is an unordered, possibly empty, set of string labels. Each label
 * is associated to a constraint: _may_ labels are fields which have been added
 * to the object in some execution path, while _should_ labels are fields of the
 * object which have been used in some execution path.
 */
function ObjectType() {
  this._fieldList = [];
}
ObjectType.prototype = {
  /**
   * Return the list of fields in the object.
   *
   * @return {Array.<string>}
   */
  getFieldList: function() {
    return this._fieldList;
  },
  /**
   * @param {string} k The name of the field.
   * @param {Constraint.<TypeVar>|null} v The constraint on that field.
   * Can be |null| if the object has never been used.
   */
  addField: function(k, v) {
    this._fieldList.push(k);
    this[":"+k] = v;
  },
  /**
   * @return {Constraint|null} A constraint.
   */
  getField: function(k) {
    return this[":"+k];
  }
};

TypeVar.unify_function = function(a, b) {
  // Guard
  if (!(a instanceof FunctionType)) {
    throw new TypeError();
  }
  if (!(b instanceof FunctionType)) {
    throw new TypeError();
  }

  // Trivial case
  if (!a) {
    return b;
  }
  if (!b) {
    return a;
  }

  let unified = a; // Reuse FunctionType a, for performance reasons

  unified.returnType = TypeVar.unify_constraints(a.returnType, b.returnType);
  unified.thisType   = TypeVar.unify_constraints(a.thisType,   b.thisType);
  let aargs = a.getArguments();
  let bargs = b.getArguments();
  let len = Math.max(aargs.length, bargs.length);
  for (let i = 0; i < len; ++i) { // FIXME: Later, optimize this.
    unified.setArgument(i, TypeVar.unify_constraints(aargs[i], bargs[i]));
  }

  return unified;
};

/**
 * @param {null|ObjectType} a
 * @param {null|ObjectType} b
 */
TypeVar.unify_object = function(a, b) {
  // Firstly, guard
  if (!(a instanceof ObjectType)) {
    throw new TypeError();
  }
  if (!(b instanceof ObjectType)) {
    throw new TypeError();
  }

  if (!a) {
    return b;
  }
  if (!b) {
    return a;
  }
  let fields = [];
  { // Get the field names of a and b, avoiding duplicates
    let tmp_fields = a.getFieldList().concat(b.getFieldList()).sort();
    if (tmp_fields.length > 0) {
      let latest = fields[0] = tmp_fields[0];
      for (let i = 1; i < tmp_fields.length; ++i) {
        let current = tmp_fields[i];
        if (current != latest) {
          fields.push(current);
          latest = current;
        }
      }
    }
  }
  let unified = a; // Reuse ObjectType |a|, for performance reasons
  for (let i = 0; i < fields.length; ++i) {
    let k = fields[i];
    let acons = a.getField(k);
    let bcons = b.getField(k);
    if (!acons && !bcons) {
      throw new Error("Internal error: field "+k+" has two empty constraints");
    }
    // At this stage, both constraints agree on the existence of |k|.
    // If either is a _may_, the result is a _may_
    // If both are _should_, the result is a _should_
    // Either way, we now need to unify the underlying type variable

    unified.addField(k, TypeVar.unify_constraint(acons, bcons));
  }
  return unified;
};

/**
 * Unify two trivial constraints
 *
 * There are ony three sets of trivial constraints:
 * - "is it a string?"
 * - "is it a number?"
 * - "is it a boolean?"
 *
 * Algorithm:   a      b        result
 *              should should   should (with merged locs)
 *              may    _        a
 *              _      may      b
 *              empty  _        b
 *              _      empty    a
 */
TypeVar.unify_trivial = function(a, b) {
  if (!a) {
    return b;
  }
  if (!b) {
    return a;
  }
  if (a.isMay()) {
    return a;
  }
  if (b.isMay()) {
    return b;
  }
  a.locs.concat(b.locs);
  return a;
};

  // Invariant: the children of a _should_ MUST be _should_.
TypeVar.unify_regular = function(a, b) {
  if (!a) {
    return b;
  }
  if (!b) {
    return a;
  }
  let atv, btv;
  if ((atv = a.isShould())) {
    if ((btv = b.isShould())) {
      return Constraints.should(atv.unify(btv),
                                a.getLocs().concat(b.getLocs()));
    } else if ((btv = b.isMay())){
      return Constraints.may(atv.unify(btv));
    } else {
      throw new Error();
    }
  }
  atv = a.isMay();
  btv = b.isMay() || b.isShould();
  return Constraints.may(atv.unify(btv));
};

