/**
 * ESLint rule: no-unsafe-row-access
 * Flags `.rows[0].` without optional chaining (`?.`) as a warning.
 * Pattern: accessing a property on rows[N] without null safety.
 */

const rule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Disallow unsafe property access on query result rows without optional chaining',
    },
    schema: [],
    messages: {
      unsafeRowAccess:
        'Unsafe row access: use optional chaining (rows[{{index}}]?.{{property}}) to guard against undefined rows.',
    },
  },
  create(context) {
    return {
      MemberExpression(node) {
        // Match pattern: X.rows[N].property (without optional chaining)
        if (
          node.object?.type === 'MemberExpression' &&
          node.object.computed === true &&
          node.object.object?.type === 'MemberExpression' &&
          node.object.object.property?.name === 'rows' &&
          !node.optional // no ?. on the final access
        ) {
          const indexNode = node.object.property;
          const indexValue = indexNode?.type === 'Literal' ? indexNode.value : '?';
          const propertyName =
            node.property?.type === 'Identifier' ? node.property.name : 'unknown';

          context.report({
            node,
            messageId: 'unsafeRowAccess',
            data: {
              index: String(indexValue),
              property: propertyName,
            },
          });
        }
      },
    };
  },
};

export default rule;
