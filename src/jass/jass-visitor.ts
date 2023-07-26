// noinspection JSAssignmentUsedAsCondition

import {DiagnosticSeverity} from 'vscode';
import type VscodeBridge from '../utils/vscode-bridge';
import TokenLegend from '../semantic/token-legend';
import ITokenToRange from '../utils/i-token-to-range';
import JassRule from './jass-rule';
import {type IToken} from '@chevrotain/types';
import type JassCstNode from './jass-cst-node';
import JassParser from "./jass-parser";

const parser = new JassParser();
const ParserVisitor = parser.getBaseCstVisitorConstructor();

export class JassVisitor extends ParserVisitor {
    constructor() {
        super();
        this.bridge = undefined;
        this.validateVisitor();
    }

    bridge?: VscodeBridge;

    #comment(ctx: JassCstNode) {
        ctx[JassRule.end]?.map(item => this.visit(item));
        ctx[JassRule.comment]?.map(item => this?.bridge?.mark(item, TokenLegend.jass_comment));
    }

    #string(ctx: JassCstNode) {
        const strings = ctx[JassRule.stringliteral];
        if (strings == null) return;
        for (const string of strings) {
            if (string.startLine === string.endLine) {
                this?.bridge?.mark(string, TokenLegend.jass_stringliteral);
                continue;
            }
            if (string) {
                this.bridge?.diagnostics.push({
                    message: 'Avoid multiline strings. Use |n or \\n to linebreak.',
                    range: ITokenToRange(string),
                    severity: DiagnosticSeverity.Warning
                });
            }
        }
    }

    [JassRule.jass](ctx: JassCstNode) {
        //console.log(JassRule.jass, ctx);
        return ctx[JassRule.root]?.map(item => this.visit(item));
    }

    [JassRule.root](ctx: JassCstNode) {
        this.#comment(ctx);
        let node;
        if ((node = ctx[JassRule.type_declare]) != null) return this.visit(node);
        if ((node = ctx[JassRule.native_declare]) != null) return this.visit(node);
        if ((node = ctx[JassRule.function_declare]) != null) return this.visit(node);
        if ((node = ctx[JassRule.globals_declare]) != null) return this.visit(node);
    }

    [JassRule.end](ctx: JassCstNode) {
        this.#comment(ctx);
    }

    [JassRule.globals_declare](ctx: JassCstNode) {
        this.#comment(ctx);

        this?.bridge?.mark(ctx[JassRule.globals]?.[0], TokenLegend.jass_globals);
        this?.bridge?.mark(ctx[JassRule.endglobals]?.[0], TokenLegend.jass_endglobals);

        const vardecl = ctx[JassRule.variable_declare];

        if (vardecl != null) {
            for (const vd of vardecl) {
                const variable = this.visit(vd);
                const typedname = variable?.[JassRule.typedname];
                const local = variable?.[JassRule.local];

                if (local) {
                    this.bridge?.diagnostics.push({
                        message: 'Local variable not allowed in globals block.',
                        range: ITokenToRange(local),
                        severity: DiagnosticSeverity.Error
                    });
                }

                if (typedname) {
                    const {
                        type,
                        name
                    } = typedname;
                    this?.bridge?.mark(type, TokenLegend.jass_type_name);
                    this?.bridge?.mark(name, TokenLegend.jass_variable);
                }
            }
        }

        return ctx;
    }

    [JassRule.type_declare](ctx: JassCstNode) {
        ctx[JassRule.end]?.map(item => this.visit(item));

        const name = ctx[JassRule.identifier]?.[0];
        const base = ctx[JassRule.identifier]?.[1];

        this?.bridge?.mark(name, TokenLegend.jass_type_name);
        this?.bridge?.mark(base, TokenLegend.jass_type_name);

        this?.bridge?.mark(ctx[JassRule.type]?.[0], TokenLegend.jass_type);
        this?.bridge?.mark(ctx[JassRule.extends]?.[0], TokenLegend.jass_extends);

        return {
            name: name?.image,
            base: base?.image
        };
    }

    [JassRule.native_declare](ctx: JassCstNode) {
        this.#comment(ctx);

        const b = this?.bridge;
        if (b != null) {
            b.mark(ctx[JassRule.constant]?.[0], TokenLegend.jass_constant);
            b.mark(ctx[JassRule.identifier]?.[0], TokenLegend.jass_function_native);
            b.mark(ctx[JassRule.native]?.[0], TokenLegend.jass_native);
            b.mark(ctx[JassRule.takes]?.[0], TokenLegend.jass_takes);
            b.mark(ctx[JassRule.returns]?.[0], TokenLegend.jass_returns);
        }

        this.visit(ctx[JassRule.function_args]!);
        this.visit(ctx[JassRule.function_returns]!);
    }

    [JassRule.function_declare](ctx: JassCstNode) {
        this.#comment(ctx);

        this?.bridge?.mark(ctx[JassRule.function]?.[0], TokenLegend.jass_function);
        this?.bridge?.mark(ctx[JassRule.identifier]?.[0], TokenLegend.jass_function_user);
        this?.bridge?.mark(ctx[JassRule.takes]?.[0], TokenLegend.jass_takes);
        this?.bridge?.mark(ctx[JassRule.returns]?.[0], TokenLegend.jass_returns);
        this?.bridge?.mark(ctx[JassRule.endfunction]?.[0], TokenLegend.jass_endfunction);

        // argument
        const args = this.visit(ctx[JassRule.function_args]!);

        // check array in argument
        if (args?.list) {
            for (const arg of args.list) {
                const array = arg[JassRule.array];
                if (array) {
                    this.bridge?.diagnostics.push({
                        message: 'Array not allowed in function argument.',
                        range: ITokenToRange(array),
                        severity: DiagnosticSeverity.Error
                    });
                }
            }
        }

        const locals = ctx?.[JassRule.function_locals];

        // locals, check locals with same name, check local redeclare argument
        if (locals != null) {
            const localMap: Record<string, IToken[]> = {};

            for (const local of locals) {
                const typedname = this.visit(local)?.[JassRule.typedname];
                if (!typedname) continue;
                const {
                    type,
                    name
                } = typedname;
                this?.bridge?.mark(type, TokenLegend.jass_type_name);
                this?.bridge?.mark(name, TokenLegend.jass_variable);
                if (name) {
                    (localMap[name.image] ??= []).push(name);
                    const argList = args.map[name.image];
                    if (argList) {
                        for (const t of [name, ...argList]) {
                            this.bridge?.diagnostics.push({
                                message: `Local variable redeclare argument: ${t.image}`,
                                range: ITokenToRange(t),
                                severity: DiagnosticSeverity.Warning
                            });
                        }
                    }
                }
            }

            for (const v of Object.values(localMap)) {
                if (v.length < 2) continue;
                for (const t of v) {
                    this.bridge?.diagnostics.push({
                        message: `Local variable with same name: ${t.image}`,
                        range: ITokenToRange(t),
                        severity: DiagnosticSeverity.Warning
                    });
                }
            }
        }

        // statement
        const statements = ctx[JassRule.statement];
        if (statements != null) {
            for (const statement of statements) {
                this.visit(statement);
            }
        }

        // return
        this.visit(ctx[JassRule.function_returns]!);

        // final
        return {};
    }

    [JassRule.function_locals](ctx: JassCstNode) {
        this.#comment(ctx);

        const variableDeclare = ctx[JassRule.variable_declare];
        if (variableDeclare == null) return null;
        const variable = this.visit(variableDeclare);

        const constant = variable?.[JassRule.constant];
        if (constant) {
            this.bridge?.diagnostics.push({
                message: 'Constant not allowed in function.',
                range: ITokenToRange(constant),
                severity: DiagnosticSeverity.Error
            });
        }

        const local = variable?.[JassRule.local];
        if (!local) {
            const {type} = variable?.[JassRule.typedname];
            if (type) {
                this.bridge?.diagnostics.push({
                    message: 'Missing local keyword.',
                    range: ITokenToRange(type),
                    severity: DiagnosticSeverity.Error
                });
            }
        }

        return variable;
    }

    [JassRule.typedname](ctx: JassCstNode) {
        const array = ctx[JassRule.array]?.[0];
        this?.bridge?.mark(array, TokenLegend.jass_array);

        const list = ctx[JassRule.identifier];
        if (list == null) return {};

        const [type, name] = list;
        return {
            type: type?.isInsertedInRecovery ?? false ? null : type,
            name: name?.isInsertedInRecovery ?? false ? null : name,
            array
        };
    }

    [JassRule.function_call](ctx: JassCstNode) {
        // console.log('function_call', ctx);
        this?.bridge?.mark(ctx[JassRule.identifier]?.[0], TokenLegend.jass_function_user);
        this?.bridge?.mark(ctx[JassRule.lparen]?.[0], TokenLegend.jass_lparen);
        this?.bridge?.mark(ctx[JassRule.rparen]?.[0], TokenLegend.jass_rparen);
        ctx[JassRule.comma]?.map(item => this?.bridge?.mark(item, TokenLegend.jass_comma));
        ctx[JassRule.expression]?.map(item => this.visit(item));
        return ctx;
    }

    [JassRule.function_args](ctx: JassCstNode) {
        let token;

        // nothing
        if ((token = ctx?.[JassRule.nothing]?.[0]) != null) {
            this?.bridge?.mark(token, TokenLegend.jass_type_name);
            return {
                map: {},
                list: []
            };
        }

        // commas
        if ((token = ctx[JassRule.comma]) != null) {
            for (const comma of token) {
                this?.bridge?.mark(comma, TokenLegend.jass_comma);
            }
        }

        // args
        const args = ctx?.[JassRule.typedname]?.map(item => this.visit(item));
        const argMap: Record<string, IToken[]> = {};

        // typedname, check type same name
        if (args != null) {
            for (const arg of args) {
                const {
                    type,
                    name
                } = arg;
                this?.bridge?.mark(type, TokenLegend.jass_type_name);
                this?.bridge?.mark(name, TokenLegend.jass_argument);
                if (name) (argMap[name.image] ??= []).push(name);
            }

            for (const v of Object.values(argMap)) {
                if (v.length < 2) continue;
                for (const t of v) {
                    this.bridge?.diagnostics.push({
                        message: `Arguments with same name: ${t.image}`,
                        range: ITokenToRange(t),
                        severity: DiagnosticSeverity.Warning
                    });
                }
            }
        }

        // return
        return {
            map: argMap,
            list: args
        };
    }

    [JassRule.function_returns](ctx: JassCstNode) {
        let token;

        if ((token = ctx[JassRule.nothing]?.[0]) != null) {
            this?.bridge?.mark(token, TokenLegend.jass_type_name);
            return token.image;
        }

        if ((token = ctx[JassRule.identifier]?.[0]) != null) {
            this?.bridge?.mark(token, TokenLegend.jass_type_name);
            return token.image;
        }

        return null;
    }

    [JassRule.variable_declare](ctx: JassCstNode) {
        // console.log(JassRule.variable_declare, ctx);
        this.#comment(ctx);

        const equals = ctx[JassRule.assign]?.[0];
        const typedname = this.visit(ctx[JassRule.typedname]!);
        const array = typedname[JassRule.array];

        // check array assing
        if (equals != null && array) {
            this.bridge?.diagnostics.push({
                message: 'Array varriables can\'t be initialised.',
                range: ITokenToRange(array),
                severity: DiagnosticSeverity.Error
            });
        }

        const local = ctx[JassRule.local]?.[0];
        if (local != null) this?.bridge?.mark(local, TokenLegend.jass_local);

        const constant = ctx[JassRule.constant]?.[0];
        if (constant != null) this?.bridge?.mark(constant, TokenLegend.jass_constant);

        this?.bridge?.mark(ctx[JassRule.assign]?.[0], TokenLegend.jass_equals);
        this.visit(ctx[JassRule.expression]!);
        return {
            [JassRule.typedname]: typedname,
            [JassRule.local]: local,
            [JassRule.constant]: constant
        };
    }

    [JassRule.statement](ctx: JassCstNode) {
        this.#comment(ctx);
        let node;
        if ((node = ctx[JassRule.if_statement]) != null) return this.visit(node);
        if ((node = ctx[JassRule.set_statement]) != null) return this.visit(node);
        if ((node = ctx[JassRule.call_statement]) != null) return this.visit(node);
        if ((node = ctx[JassRule.loop_statement]) != null) return this.visit(node);
        if ((node = ctx[JassRule.exitwhen_statement]) != null) return this.visit(node);
        if ((node = ctx[JassRule.return_statement]) != null) return this.visit(node);
        return null;
    }

    [JassRule.call_statement](ctx: JassCstNode) {
        //console.log(JassRule.call_statement, ctx)
        this.#comment(ctx);
        this?.bridge?.mark(ctx[JassRule.debug]?.[0], TokenLegend.jass_debug);
        this?.bridge?.mark(ctx[JassRule.call]?.[0], TokenLegend.jass_call);
        this.visit(ctx[JassRule.function_call]!);
        return null;
    }

    [JassRule.set_statement](ctx: JassCstNode) {
        // console.log(JassRule.set_statement, ctx);

        this.#comment(ctx);
        this?.bridge?.mark(ctx[JassRule.set]?.[0], TokenLegend.jass_set);
        this?.bridge?.mark(ctx[JassRule.identifier]?.[0], TokenLegend.jass_variable);
        this?.bridge?.mark(ctx[JassRule.assign]?.[0], TokenLegend.jass_assign);

        this.visit(ctx[JassRule.expression]!);
        this.visit(ctx[JassRule.arrayaccess]!);
        return null;
    }

    [JassRule.loop_statement](ctx: JassCstNode) {
        this.#comment(ctx);
        this?.bridge?.mark(ctx[JassRule.loop]?.[0], TokenLegend.jass_loop);
        this?.bridge?.mark(ctx[JassRule.endloop]?.[0], TokenLegend.jass_endloop);
        ctx[JassRule.statement]?.map(item => this.visit(item));
        return ctx;
    }

    [JassRule.exitwhen_statement](ctx: JassCstNode) {
        this.#comment(ctx);
        this?.bridge?.mark(ctx[JassRule.exitwhen]?.[0], TokenLegend.jass_loop);

        this.visit(ctx[JassRule.expression]!);
        return ctx;
    }

    [JassRule.return_statement](ctx: JassCstNode) {
        this.#comment(ctx);
        this?.bridge?.mark(ctx[JassRule.return]?.[0], TokenLegend.jass_return);

        this.visit(ctx[JassRule.expression]!);
        return null;
    }

    [JassRule.if_statement](ctx: JassCstNode) {
        // console.log('if_statement', ctx);
        this.#comment(ctx);

        this?.bridge?.mark(ctx[JassRule.if]?.[0], TokenLegend.jass_if);
        this?.bridge?.mark(ctx[JassRule.then]?.[0], TokenLegend.jass_then);
        this?.bridge?.mark(ctx[JassRule.endif]?.[0], TokenLegend.jass_endif);

        this.visit(ctx[JassRule.expression]!);
        ctx[JassRule.statement]?.map(item => this.visit(item));
        ctx[JassRule.elseif_statement]?.map(item => this.visit(item));
        this.visit(ctx[JassRule.else_statement]!);
        return null;
    }

    [JassRule.elseif_statement](ctx: JassCstNode) {
        this.#comment(ctx);

        this.visit(ctx[JassRule.expression]!);
        this?.bridge?.mark(ctx[JassRule.elseif]?.[0], TokenLegend.jass_elseif);
        this?.bridge?.mark(ctx[JassRule.then]?.[0], TokenLegend.jass_then);
        ctx[JassRule.statement]?.map(item => this.visit(item));
        return null;
    }

    [JassRule.else_statement](ctx: JassCstNode) {
        this.#comment(ctx);
        this?.bridge?.mark(ctx[JassRule.else]?.[0], TokenLegend.jass_else);
        ctx[JassRule.statement]?.map(item => this.visit(item));
        return null;
    }

    [JassRule.expression](ctx: JassCstNode) {
        // console.log(JassRule.expression, ctx);
        ctx[JassRule.and]?.map(item => this?.bridge?.mark(item, TokenLegend.jass_and));
        ctx[JassRule.or]?.map(item => this?.bridge?.mark(item, TokenLegend.jass_or));
        ctx[JassRule.equals]?.map(item => this?.bridge?.mark(item, TokenLegend.jass_equals));
        ctx[JassRule.notequals]?.map(item => this?.bridge?.mark(item, TokenLegend.jass_notequals));
        ctx[JassRule.lessorequal]?.map(item => this?.bridge?.mark(item, TokenLegend.jass_lessorequal));
        ctx[JassRule.great]?.map(item => this?.bridge?.mark(item, TokenLegend.jass_great));
        ctx[JassRule.greatorequal]?.map(item => this?.bridge?.mark(item, TokenLegend.jass_greatorequal));

        ctx[JassRule.addition]?.map(item => this.visit(item));
        return null;
    }

    [JassRule.primary](ctx: JassCstNode) {
        // console.log(JassRule.primary, ctx);
        this.#string(ctx);
        const b = this?.bridge;
        if (b != null) {
            b.mark(ctx[JassRule.sub]?.[0], TokenLegend.jass_sub);
            b.mark(ctx[JassRule.integer]?.[0], TokenLegend.jass_integer);
            b.mark(ctx[JassRule.real]?.[0], TokenLegend.jass_real);
            b.mark(ctx[JassRule.idliteral]?.[0], TokenLegend.jass_idliteral);
            b.mark(ctx[JassRule.identifier]?.[0], TokenLegend.jass_variable);
            b.mark(ctx[JassRule.function]?.[0], TokenLegend.jass_function);
        }
        this.visit(ctx[JassRule.arrayaccess]!);
        this.visit(ctx[JassRule.function_call]!);
        this.visit(ctx[JassRule.expression]!);
        return null;
    }

    [JassRule.addition](ctx: JassCstNode) {
        // console.log('addition', ctx);
        ctx[JassRule.add]?.map(item => this?.bridge?.mark(item, TokenLegend.jass_add));
        ctx[JassRule.sub]?.map(item => this?.bridge?.mark(item, TokenLegend.jass_sub));

        ctx[JassRule.multiplication]?.map(item => this.visit(item));
        return null;
    }

    [JassRule.multiplication](ctx: JassCstNode) {
        // console.log('multiplication', ctx);
        ctx[JassRule.mult]?.map(item => this?.bridge?.mark(item, TokenLegend.jass_mult));
        ctx[JassRule.div]?.map(item => this?.bridge?.mark(item, TokenLegend.jass_div));

        ctx[JassRule.primary]?.map(item => this.visit(item));
        return null;
    }

    [JassRule.arrayaccess](ctx: JassCstNode) {
        // console.log(JassRule.arrayaccess, ctx);
        this?.bridge?.mark(ctx[JassRule.lsquareparen]?.[0], TokenLegend.jass_lsquareparen);
        this?.bridge?.mark(ctx[JassRule.rsquareparen]?.[0], TokenLegend.jass_rsquareparen);

        this.visit(ctx[JassRule.expression]!);
        return null;
    }
}