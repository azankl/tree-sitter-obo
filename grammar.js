/**
 * @file Tree-sitter grammar for the OBO flat file format (1.2 / 1.4)
 * @license MIT
 */

/// <reference types="tree-sitter-cli/dsl" />
// @ts-check

module.exports = grammar({
  name: 'obo',

  // Newlines are significant, so only horizontal whitespace is "extra".
  extras: (_) => [/[ \t\r\f﻿]/],

  word: ($) => $.tag,

  rules: {
    source_file: ($) => seq(optional($.header), repeat($.stanza)),

    // Header frame: tag-value pairs before the first stanza.
    header: ($) => repeat1($._line),

    stanza: ($) =>
      prec.right(seq($.stanza_header, $._newline, repeat($._line))),

    stanza_header: ($) => seq('[', field('type', $.stanza_type), ']'),
    stanza_type: (_) => /[A-Za-z_][A-Za-z0-9_\-]*/,

    _line: ($) => choice($.clause, seq($.comment, $._newline), $._newline),

    clause: ($) =>
      seq(
        field('tag', $.tag),
        ':',
        optional(field('value', $.value)),
        optional($.comment),
        $._newline,
      ),

    tag: (_) => /[A-Za-z0-9_][A-Za-z0-9_\-.]*/,

    // Two shapes of value:
    //  * quoted   - starts with a "string"; may be followed by scope words,
    //               CURIEs, a [dbxref, list] and a {qualifier} block
    //               (def, synonym, property_value, subsetdef, ...)
    //  * unquoted - free text / identifiers; square brackets are plain text
    //               here (e.g. `name: EC 1.13.* [oxidoreductase ...]`)
    value: ($) =>
      choice(
        seq($.string, repeat($._after_string)),
        seq(
          choice($.url, $.curie, $.text, $.qualifier_block),
          repeat(choice($.url, $.curie, $.text, $.string, $.qualifier_block)),
        ),
      ),

    _after_string: ($) =>
      choice($.string, $.url, $.curie, $.word, $.xref_list, $.qualifier_block),

    // ---- Quoted strings -------------------------------------------------
    string: ($) =>
      seq(
        '"',
        repeat(choice($.string_content, $.escape_sequence)),
        token.immediate('"'),
      ),
    string_content: (_) => token.immediate(prec(1, /[^"\\\n]+/)),
    escape_sequence: (_) => token.immediate(/\\./),

    // ---- Unquoted tokens --------------------------------------------------
    url: (_) =>
      token(prec(3, /[A-Za-z][A-Za-z0-9+.\-]*:\/\/([^\s"!\[\]{}\\]|\\.)+/)),
    curie: (_) =>
      token(prec(2, /[A-Za-z_][A-Za-z0-9_.\-]*:[A-Za-z0-9_.\-#\/]+/)),
    // A bare token following a quoted string (scope, synonym type, ...).
    word: (_) => token(prec(1, /([^\s"!\[\]{}\\]|\\.)+/)),
    // A bare token of free text: brackets and inner quotes allowed.
    text: (_) => token(prec(1, /([^\s"!{}\\]|\\.)([^\s!{}\\]|\\.)*/)),

    // ---- Dbxref lists: [GO:0001 "desc", PMID:123] -------------------------
    xref_list: ($) =>
      seq('[', optional(seq($.xref, repeat(seq(',', $.xref)), optional(','))), ']'),
    xref: ($) => seq(field('id', $.xref_id), optional(field('description', $.string))),
    xref_id: (_) => token(prec(1, /([^\s",\[\]{}\\]|\\.)+/)),

    // ---- Trailing modifiers: {source="X", cardinality="1"} --------------
    qualifier_block: ($) =>
      seq(
        '{',
        optional(seq($.qualifier, repeat(seq(',', $.qualifier)), optional(','))),
        '}',
      ),
    qualifier: ($) =>
      seq(
        field('name', $.qualifier_name),
        '=',
        field('value', choice($.string, $.qualifier_value)),
      ),
    qualifier_name: (_) => /[A-Za-z0-9_:.\-]+/,
    qualifier_value: (_) => /([^\s",{}=\\]|\\.)+/,

    // ---- Comments ---------------------------------------------------------
    comment: (_) => token(seq('!', /[^\n]*/)),

    _newline: (_) => /\n/,
  },
});
