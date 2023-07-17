import {createToken, Lexer} from 'chevrotain';

export const JassTokenMap = {
    whitespace: createToken({
        name: 'whitespace',
        pattern: /[^\S\r\n]+/,
        line_breaks: false,
        group: Lexer.SKIPPED,
    }),
    linebreak: createToken({
        name: 'linebreak',
        pattern: /\n|\r\n/,
        label: "\\n",
        line_breaks: true,
    }),
    linecomment: createToken({
        name: 'linecomment',
        pattern: /\/\/[^\r\n]*/,
        label: "\\\\",
        line_breaks: false,
    }),
    type: createToken({
        name: 'type',
        pattern: /type/,
        start_chars_hint: ["t"],
        line_breaks: false,
    }),
    extends: createToken({
        name: 'extends',
        pattern: /extends/,
        start_chars_hint: ["e"],
        line_breaks: false,
    }),
    constant: createToken({
        name: 'constant',
        pattern: /constant/,
        start_chars_hint: ["c"],
        line_breaks: false,
    }),
    native: createToken({
        name: 'native',
        pattern: /native/,
        start_chars_hint: ["n"],
        line_breaks: false,
    }),
    function: createToken({
        name: 'function',
        pattern: /function/,
        start_chars_hint: ["f"],
        line_breaks: false,
    }),
    takes: createToken({
        name: 'takes',
        pattern: /takes/,
        start_chars_hint: ["t"],
        line_breaks: false,
    }),
    comma: createToken({
        name: 'comma',
        pattern: /,/,
        start_chars_hint: [","],
        label: ",",
        line_breaks: false,
    }),
    nothing: createToken({
        name: 'nothing',
        pattern: /nothing/,
        start_chars_hint: ["n"],
        line_breaks: false,
    }),
    returns: createToken({
        name: 'returns',
        pattern: /returns/,
        start_chars_hint: ["r"],
        line_breaks: false,
    }),
    local: createToken({
        name: 'local',
        pattern: /local/,
        start_chars_hint: ["l"],
        line_breaks: false,
    }),
    equalsequals: createToken({
        name: 'equalsequals',
        pattern: /==/,
        start_chars_hint: ["="],
        line_breaks: false,
        label: "==",
    }),
    equals: createToken({
        name: 'equals',
        pattern: /=/,
        start_chars_hint: ["="],
        line_breaks: false,
        label: "=",
    }),
    and: createToken({
        name: 'and',
        pattern: /and/,
        start_chars_hint: ["a"],
        line_breaks: false,
    }),
    or: createToken({
        name: 'or',
        pattern: /or/,
        start_chars_hint: ["o"],
        line_breaks: false,
    }),
    call: createToken({
        name: 'call',
        pattern: /call/,
        start_chars_hint: ["c"],
        line_breaks: false,
    }),
    notequals: createToken({
        name: 'notequals',
        pattern: /!=/,
        start_chars_hint: ["!"],
        line_breaks: false,
        label: "!=",
    }),
    add: createToken({
        name: 'add',
        pattern: /\+/,
        start_chars_hint: ["+"],
        line_breaks: false,
        label: "+",
    }),
    sub: createToken({
        name: 'sub',
        pattern: /-/,
        start_chars_hint: ["-"],
        line_breaks: false,
        label: "-",
    }),
    mult: createToken({
        name: 'mult',
        pattern: /\*/,
        start_chars_hint: ["*"],
        line_breaks: false,
        label: "*",
    }),
    div: createToken({
        name: 'div',
        pattern: /\//,
        start_chars_hint: ["/"],
        line_breaks: false,
        label: "/",
    }),
    not: createToken({
        name: 'not',
        pattern: /not/,
        start_chars_hint: ["n"],
        line_breaks: false,
    }),
    set: createToken({
        name: 'set',
        pattern: /set/,
        start_chars_hint: ["s"],
        line_breaks: false,
    }),
    loop: createToken({
        name: 'loop',
        pattern: /loop/,
        start_chars_hint: ["l"],
        line_breaks: false,
    }),
    exitwhen: createToken({
        name: 'exitwhen',
        pattern: /exitwhen/,
        start_chars_hint: ["e"],
        line_breaks: false,
    }),
    endloop: createToken({
        name: 'endloop',
        pattern: /endloop/,
        start_chars_hint: ["e"],
        line_breaks: false,
    }),
    if: createToken({
        name: 'if',
        pattern: /if/,
        start_chars_hint: ["i"],
        line_breaks: false,
    }),
    then: createToken({
        name: 'then',
        pattern: /then/,
        start_chars_hint: ["t"],
        line_breaks: false,
    }),
    elseif: createToken({
        name: 'elseif',
        pattern: /elseif/,
        start_chars_hint: ["e"],
        line_breaks: false,
    }),
    else: createToken({
        name: 'else',
        pattern: /else/,
        start_chars_hint: ["e"],
        line_breaks: false,
    }),
    endif: createToken({
        name: 'endif',
        pattern: /endif/,
        start_chars_hint: ["e"],
        line_breaks: false,
    }),
    stringliteral: createToken({
        name: 'stringliteral',
        pattern: /".*"/,
        start_chars_hint: ["\""],
        line_breaks: false,
    }),
    lparen: createToken({
        name: 'lparen',
        pattern: /\(/,
        start_chars_hint: ["("],
        line_breaks: false,
        label: "(",
    }),
    rparen: createToken({
        name: 'rparen',
        pattern: /\)/,
        start_chars_hint: [")"],
        line_breaks: false,
        label: ")",
    }),
    lsquareparen: createToken({
        name: 'lsquareparen',
        pattern: /\[/,
        start_chars_hint: ["["],
        line_breaks: false,
        label: "[",
    }),
    rsquareparen: createToken({
        name: 'rsquareparen',
        pattern: /]/,
        start_chars_hint: ["]"],
        line_breaks: false,
        label: "]",
    }),
    endfunction: createToken({
        name: 'endfunction',
        pattern: /endfunction/,
        start_chars_hint: ["e"],
        line_breaks: false,
    }),
    idliteral: createToken({
        name: 'idliteral',
        pattern: /'.*'/,
        line_breaks: false,
    }),
    integer: createToken({
        name: 'integer',
        pattern: /[0-9]+/,
        line_breaks: false,
    }),
    real: createToken({
        name: 'real',
        pattern: /[0-9]+\.[0-9]+/,
        line_breaks: false,
    }),
    identifier: createToken({
        name: 'identifier',
        pattern: /[a-zA-Z][a-zA-Z0-9_]*/,
        line_breaks: false,
    }),
}

/** @type {import('chevrotain').TokenType[]} */
export const JassTokenList = [JassTokenMap.whitespace, JassTokenMap.linebreak, JassTokenMap.linecomment, JassTokenMap.type, JassTokenMap.extends, JassTokenMap.constant, JassTokenMap.native, JassTokenMap.function, JassTokenMap.takes, JassTokenMap.comma, JassTokenMap.nothing, JassTokenMap.returns, JassTokenMap.local, JassTokenMap.equalsequals, JassTokenMap.equals, JassTokenMap.and, JassTokenMap.or, JassTokenMap.call, JassTokenMap.notequals, JassTokenMap.add, JassTokenMap.sub, JassTokenMap.mult, JassTokenMap.div, JassTokenMap.not, JassTokenMap.set, JassTokenMap.loop, JassTokenMap.exitwhen, JassTokenMap.endloop, JassTokenMap.if, JassTokenMap.then, JassTokenMap.elseif, JassTokenMap.else, JassTokenMap.endif, JassTokenMap.stringliteral, JassTokenMap.lparen, JassTokenMap.rparen, JassTokenMap.lsquareparen, JassTokenMap.rsquareparen, JassTokenMap.endfunction, JassTokenMap.idliteral, JassTokenMap.integer, JassTokenMap.real, JassTokenMap.identifier];

export const JassLexer = new Lexer(JassTokenList);
for (const error of JassLexer.lexerDefinitionErrors) console.error(error);