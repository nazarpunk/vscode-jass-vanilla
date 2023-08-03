const enum ZincRule {
    // generic
    identifier_name = 'identifier_name',
    identifier_type = 'identifier_type',
    identifier_returns = 'identifier_returns',
    // rules
    zinc = 'zinc',
    library = 'library',
    requires = 'requires',
    optional = 'optional',
    library_constant = 'library_constant',
    library_declare = 'library_declare',
    library_requires = 'library_requires',
    library_root = 'library_root',
    access_scope = 'access_scope',
    variable_declare = 'variable_declare',
    variable_set = 'variable_set',
    function_declare = 'function_declare',
    function_arg = 'function_arg',
    function_call = 'function_call',
    return_statement = 'return_statement',
    if_statement = 'if_statement',
    else_statement = 'else_statement',
    addition = 'addition',
    arrayaccess = 'arrayaccess',
    call_statement = 'call_statement',
    expression = 'expression',
    for_statement = 'for_statement',
    multiplication = 'multiplication',
    primary = 'primary',
    set_statement = 'set_statement',
    statement = 'statement',
    // tokens
    whitespace = 'whitespace',
    comment = 'comment',
    comment_multiline = 'comment_multiline',
    // keyword
    and = 'and',
    constant = 'constant',
    public = 'public',
    private = 'private',
    debug = 'debug',
    else = 'else',
    endfunction = 'endfunction',
    endglobals = 'endglobals',
    extends = 'extends',
    function = 'function',
    globals = 'globals',
    if = 'if',
    for = 'for',
    not = 'not',
    or = 'or',
    returns = 'returns',
    return = 'return',
    type = 'type',
    // someone
    comma = 'comma',
    equals = 'equals',
    assign = 'assign',
    notequals = 'notequals',
    lessorequal = 'lessorequal',
    less = 'less',
    greatorequal = 'greatorequal',
    great = 'great',
    add = 'add',
    sub = 'sub',
    mult = 'mult',
    div = 'div',
    semicolon = 'semicolon',
    lparen = 'lparen',
    rparen = 'rparen',
    lcurlyparen = 'lcurlyparen',
    rcurlyparen = 'rcurlyparen',
    lsquareparen = 'lsquareparen',
    rsquareparen = 'rsquareparen',
    real = 'real',
    integer = 'integer',
    idliteral = 'idliteral',
    stringliteral = 'stringliteral',
    identifier = 'identifier',
}

export default ZincRule
