import _ from 'lodash';
import tagNames from './tagNames';

const getFunctionParameterNames = (functionNode : Object) : Array<string> => {
  return _.map(functionNode.params, (param) => {
    if (_.has(param, 'name')) {
      return param.name;
    }

    if (_.has(param, 'left.name')) {
      return param.left.name;
    }

    if (param.type === 'ObjectPattern' || _.get(param, 'left.type') === 'ObjectPattern') {
      return '<ObjectPattern>';
    }

    if (param.type === 'ArrayPattern' || _.get(param, 'left.type') === 'ArrayPattern') {
      return '<ArrayPattern>';
    }

    if (param.type === 'RestElement') {
      return param.argument.name;
    }

    throw new Error('Unsupported function signature format.');
  });
};

/**
 * Gets all parameter names, including those that refer to a path, e.g. "@param foo; @param foo.bar".
 */
const getJsdocParameterNamesDeep = (jsdoc : Object, targetTagName : string) : Array<string> => {
  let jsdocParameterNames;

  jsdocParameterNames = _.filter(jsdoc.tags, {
    tag: targetTagName
  });

  jsdocParameterNames = _.map(jsdocParameterNames, 'name');

  return jsdocParameterNames;
};

const getJsdocParameterNames = (jsdoc : Object, targetTagName : string) : Array<string> => {
  let jsdocParameterNames;

  jsdocParameterNames = getJsdocParameterNamesDeep(jsdoc, targetTagName);

  jsdocParameterNames = jsdocParameterNames.filter((name) => {
    return !name.includes('.');
  });

  return jsdocParameterNames;
};

const getPreferredTagName = (name : string, tagPreference : Object = {}) : string => {
  if (_.values(tagPreference).includes(name)) {
    return name;
  }

  const preferredTagName = _.findKey(tagNames, (aliases) => {
    return aliases.includes(name);
  });

  if (preferredTagName) {
    return preferredTagName;
  }

  return _.has(tagPreference, name) ? tagPreference[name] : name;
};

const isValidTag = (name : string, additionalTagNames : Object) : boolean => {
  const validTagNames = _.keys(tagNames).concat(_.flatten(_.values(tagNames)));
  const additionalTags = additionalTagNames.customTags || [];
  const allTags = validTagNames.concat(additionalTags);

  return allTags.includes(name);
};

const hasTag = (jsdoc : Object, targetTagName : string) : boolean => {
  const targetTagLower = targetTagName.toLowerCase();

  return _.some(jsdoc.tags, (doc : Object) => {
    return doc.tag.toLowerCase() === targetTagLower;
  });
};

const hasATag = (jsdoc : Object, targetTagNames : Array) : boolean => {
  return targetTagNames.some((targetTagName) => {
    return hasTag(jsdoc, targetTagName);
  });
};

/**
 * Checks if the JSDoc comment declares a return value.
 *
 * @param {JsDocTag} tag
 *   the tag which should be checked.
 * @returns {boolean}
 *   true in case a return value is declared; otherwise false.
 */
const hasDefinedTypeReturnTag = (tag) => {
  // The function should not continue in the event @returns is not defined...
  if (typeof tag === 'undefined' || tag === null) {
    return false;
  }

  // .. same applies if it declares `@returns {undefined}` or `@returns {void}`
  const tagType = tag.type.trim();
  if (tagType === 'undefined' || tagType === 'void') {
    return false;
  }

  // In any other case, something must be returned, and
  // a return statement is expected
  return true;
};

const namepathDefiningTags = [
  // NOT USEFUL WITHOUT NAMEPATH
  'external', 'host',
  'name',
  'typedef',

  // MAY BE USEFUL WITHOUT NAMEPATH
  'event',

  // MAY BE USEFUL WITHOUT NAMEPATH (OR
  //  BLOCK CAN USE NAMEPATH FROM ELSEWHERE)
  'class', 'constructor',
  'constant', 'const',
  'callback',
  'function', 'func', 'method',
  'interface',
  'member', 'var',
  'mixin',
  'namespace'
];

const namepathPointingTags = [
  // NOT USEFUL WITHOUT NAMEPATH
  'alias',
  'augments', 'extends',

  // `borrows` has a different format, however, so needs special parsing
  'borrows',
  'lends',
  'memberof',
  'memberof!',
  'mixes',
  'this',

  // MAY BE USEFUL WITHOUT NAMEPATH
  'emits',
  'fires',
  'listens'
];

const isNamepathDefiningTag = (tagName) => {
  return namepathDefiningTags.includes(tagName);
};

const isNamepathPointingTag = (tagName, checkSeesForNamepaths) => {
  return namepathPointingTags.includes(tagName) ||
    tagName === 'see' && checkSeesForNamepaths;
};

const isNamepathTag = (tagName, checkSeesForNamepaths) => {
  return isNamepathDefiningTag(tagName) ||
    isNamepathPointingTag(tagName, checkSeesForNamepaths);
};

const potentiallyEmptyNamepathTags = [
  // These may serve some minor purpose when empty or
  //  their namepath can be expressed elsewhere on the block
  'event',
  'callback',
  'class', 'constructor',
  'constant', 'const',
  'function', 'func', 'method',
  'interface',
  'member', 'var',
  'mixin',
  'namespace',
  'listens', 'fires', 'emits'
];

const isPotentiallyEmptyNamepathTag = (tag) => {
  return potentiallyEmptyNamepathTags.includes(tag);
};

let tagsWithTypes = [
  'class',
  'constant',
  'enum',
  'implements',
  'member',
  'module',
  'namespace',
  'param',
  'property',
  'returns',
  'throws',
  'type',
  'typedef',
  'yields'
];

const closureTagsWithTypes = [
  'package', 'private', 'protected', 'public', 'static'
];

const tagsWithTypesAliases = [
  'constructor',
  'const',
  'var',
  'arg',
  'argument',
  'prop',
  'return',
  'exception',
  'yield'
];

tagsWithTypes = tagsWithTypes.concat(tagsWithTypesAliases, closureTagsWithTypes);

const isTagWithType = (tagName) => {
  return tagsWithTypes.includes(tagName);
};

const LOOP_STATEMENTS = ['WhileStatement', 'DoWhileStatement', 'ForStatement', 'ForInStatement', 'ForOfStatement'];

const STATEMENTS_WITH_CHILDREN = [
  '@loop',
  'SwitchStatement',
  'IfStatement',
  'BlockStatement',
  'TryStatement'
];

const RETURNFREE_STATEMENTS = [
  'VariableDeclarationInFunction',
  'VariableDeclarationInModule',
  'ThrowStatement',
  'FunctionDeclaration',
  'BreakStatement',
  'ContinueStatement',
  'LabeledStatement',
  'DebuggerStatement',
  'EmptyStatement',
  'WithStatement',
  'ThrowStatement',
  'ExpressionStatement'
];

const ENTRY_POINTS = ['FunctionDeclaration', 'ArrowFunctionExpression', 'FunctionExpression'];

/* eslint-disable sort-keys */
const lookupTable = {
  ReturnStatement: {
    is (node) {
      return node.type === 'ReturnStatement';
    },
    check (node) {
      if (!lookupTable.ReturnStatement.is(node)) {
        return false;
      }

      // A return without any arguments just exits the function
      // and is typically not documented at all in jsdoc.
      if (node.argument === null) {
        return false;
      }

      return true;
    }
  },
  IfStatement: {
    is (node) {
      return node.type === 'IfStatement';
    },
    check (node) {
      if (!lookupTable.IfStatement.is(node)) {
        return false;
      }

      if (lookupTable['@default'].check(node.consequent)) {
        return true;
      }

      if (node.alternate && lookupTable['@default'].check(node.alternate)) {
        return true;
      }

      return false;
    }
  },
  '@loop': {
    is (node) {
      return LOOP_STATEMENTS.includes(node.type);
    },
    check (node) {
      return lookupTable['@default'].check(node.body);
    }
  },
  SwitchStatement: {
    is (node) {
      return node.type === 'SwitchStatement';
    },
    check (node) {
      for (const item of node.cases) {
        for (const statement of item.consequent) {
          if (lookupTable['@default'].check(statement)) {
            return true;
          }
        }
      }

      return false;
    }
  },
  TryStatement: {
    is (node) {
      return node.type === 'TryStatement';
    },
    check (node) {
      if (!lookupTable.TryStatement.is(node)) {
        return false;
      }

      if (lookupTable.BlockStatement.check(node.block)) {
        return true;
      }

      if (node.handler && node.handler.block) {
        if (lookupTable['@default'].check(node)) {
          return true;
        }
      }

      if (lookupTable.BlockStatement.check(node.finalizer)) {
        return true;
      }

      return false;
    }
  },
  BlockStatement: {
    is (node) {
      return node.type === 'BlockStatement';
    },
    check (node, context) {
      // E.g. the catch block statement is optional.
      if (typeof node === 'undefined' || node === null) {
        return false;
      }

      if (!lookupTable.BlockStatement.is(node)) {
        return false;
      }

      for (const item of node.body) {
        if (lookupTable['@default'].check(item, context)) {
          return true;
        }
      }

      return false;
    }
  },
  FunctionExpression: {
    is (node) {
      return node.type === 'FunctionExpression';
    },
    check (node, context) {
      return node.async || lookupTable.BlockStatement.check(node.body, context);
    }
  },
  ArrowFunctionExpression: {
    is (node) {
      return node.type === 'ArrowFunctionExpression';
    },
    check (node, context) {
      // An expression always has a return value.
      return node.expression ||
        node.async ||
        lookupTable.BlockStatement.check(node.body, context);
    }
  },
  FunctionDeclaration: {
    is (node) {
      return node.type === 'FunctionDeclaration';
    },
    check (node, context) {
      return node.async || lookupTable.BlockStatement.check(node.body, context);
    }
  },
  '@default': {
    check (node, context) {
      // In case it is a `ReturnStatement`, we found what we were looking for
      if (lookupTable.ReturnStatement.is(node)) {
        return lookupTable.ReturnStatement.check(node, context);
      }

      // In case the element has children, we need to traverse them.
      // Examples are BlockStatement, Choices, TryStatement, Loops, ...
      for (const item of STATEMENTS_WITH_CHILDREN) {
        if (lookupTable[item].is(node)) {
          return lookupTable[item].check(node, context);
        }
      }

      // Everything else cannot return anything.
      if (RETURNFREE_STATEMENTS.includes(node.type)) {
        return false;
      }

      // If we end up here, we stumbled upon an unknown elements
      // Most likely it is enough to add it to the blacklist.
      //
      // throw new Error('Unknown node type: ' + node.type);
      return false;
    }
  }
};

/**
 * Checks if the source code returns a return value.
 * It traverses the parsed source code and returns as
 * soon as it stumbles upon the first return statement.
 *
 * @param {Object} node
 *   the node which should be checked.
 * @returns {boolean}
 *   true in case the code returns a return value
 */
const hasReturnValue = (node, context) => {
  // Loop through all of our entry points
  for (const item of ENTRY_POINTS) {
    if (lookupTable[item].is(node)) {
      return lookupTable[item].check(node, context);
    }
  }

  throw new Error('Unknown element ' + node.type);
};

/** @param {string} tag */
/*
const isInlineTag = (tag) => {
  return /^(@link|@linkcode|@linkplain|@tutorial) /.test(tag);
};
*/

export default {
  getFunctionParameterNames,
  getJsdocParameterNames,
  getJsdocParameterNamesDeep,
  getPreferredTagName,
  hasATag,
  hasDefinedTypeReturnTag,
  hasReturnValue,
  hasTag,
  isNamepathDefiningTag,
  isNamepathTag,
  isPotentiallyEmptyNamepathTag,
  isTagWithType,
  isValidTag
};
