// Finds JSDoc type tags written as a BARE container name -- `{Object}`,
// `{Array}`, `{Map}`, `{Set}`, `{Function}`, `{Promise}`.
//
// WHY THESE ARE WORSE THAN NO ANNOTATION. Capital `Object` is the TypeScript
// `Object` interface, which declares `hasOwnProperty`, `toString` and four more
// -- and nothing else. So `@param {Object} params` followed by
// `params.player_id` is not an under-specified annotation, it is a GUARANTEED
// error at every property read, on a tag that reads to a human as
// documentation. `Array`, `Map`, `Set` and `Promise` are generics missing their
// arguments, so every element, value or resolved read through them is `any`.
// `Function` accepts any signature and returns `any`.
//
// This was the single dominant blocker across all twelve producers adopted in
// Stage 3 of the ts-check tier -- not missing types, but existing tags of this
// shape. Which is also why the rule is worth having beyond the tier: it catches
// the class in the ~300 files that are not adopted and may never be.
//
// Lowercase `object` is NOT flagged, and the distinction is the whole point.
// `@param {object} params` with `@param {number} params.lid` beneath it is the
// repo's standard idiom and is correct -- lowercase `object` is TypeScript's
// "any non-primitive", which the sub-tags then describe. Only the capitalized
// interface is the defect.
//
// This module is the single detector. The lint rule and the baseline generator
// both call it, so the two cannot disagree about what counts as a violation --
// a disagreement would make the ratchet either unenforceable or unsatisfiable.

// A container that has type arguments (`Array<string>`, `Promise<void>`,
// `Object<string, number>`) is fine, so the lookahead excludes a following `<`.
// The word boundary keeps `MyObject` and `ObjectId` out.
const BARE_CONTAINER = /\b(Object|Array|Map|Set|Function|Promise)\b(?!\s*<)/g

// Only type-carrying tags. `@type` and `@typedef` are included because a bare
// container is exactly as useless there.
const TYPE_TAG =
  /@(param|arg|argument|returns|return|property|prop|type|typedef|yields|throws)\s*\{([^{}]*)\}/g

export const CONTAINER_ADVICE = {
  Object:
    'use lowercase `object` with `@param x.y` sub-tags, a named typedef, or `Record<string, T>` -- capital `Object` is the TypeScript Object interface, so every property read through it is an error',
  Array: 'give the element type: `T[]` or `Array<T>`',
  Map: 'give both arguments: `Map<K, V>`',
  Set: 'give the element type: `Set<T>`',
  Function:
    'give the signature: `(a: A, b: B) => R`, or a named `@callback` typedef',
  Promise: 'give the resolved type: `Promise<T>`'
}

/**
 * Every bare-container occurrence in a block of source text.
 *
 * @param {object} params
 * @param {string} params.source
 * @returns {{ container: string, tag: string, type_text: string, index: number }[]}
 */
export const find_bare_containers = ({ source }) => {
  const found = []

  TYPE_TAG.lastIndex = 0
  let tag_match
  while ((tag_match = TYPE_TAG.exec(source)) !== null) {
    const [, tag, type_text] = tag_match
    // Offset of the `{` that opens the type expression, so a reported index
    // points at the type rather than at the tag name.
    const type_offset = tag_match.index + tag_match[0].indexOf('{') + 1

    BARE_CONTAINER.lastIndex = 0
    let container_match
    while ((container_match = BARE_CONTAINER.exec(type_text)) !== null) {
      found.push({
        container: container_match[1],
        tag,
        type_text,
        index: type_offset + container_match.index
      })
    }
  }

  return found
}
