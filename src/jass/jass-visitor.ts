// noinspection DuplicatedCode

import {DiagnosticSeverity, Range} from 'vscode';
import type VscodeBridge from '../utils/vscode-bridge';
import TokenLegend from '../semantic/token-legend';
import JassRule from './jass-rule';
import {type IToken} from '@chevrotain/types';
import type JassCstNode from './jass-cst-node';
import JassParser from './jass-parser';
import i18next from 'i18next';
import {i18n} from '../utils/i18n';

const parser = new JassParser();
const ParserVisitor = parser.getBaseCstVisitorConstructor();

export class JassVisitor extends ParserVisitor {
    constructor() {
        super();
        this.validateVisitor();
    }

    bridge?: VscodeBridge;

    #string(ctx: JassCstNode) {
        const strings = ctx[JassRule.stringliteral];
        if (!strings) return;
        const b = this.bridge;
        if (b) {
            for (const string of strings) {
                const start = b.document.positionAt(string.startOffset);
                const end = b.document.positionAt(string.startOffset + string.image.length);

                if (start.line === end.line) {
                    b.mark(string, TokenLegend.jass_stringliteral);
                    continue;
                }
                if (string) {
                    b.diagnostics.push({
                        message: i18next.t(i18n.multilineStringError),
                        range: new Range(
                            b.document.positionAt(string.startOffset),
                            b.document.positionAt(string.startOffset + string.image.length),
                        ),
                        severity: DiagnosticSeverity.Warning
                    });
                }
            }
        }
    }

    [JassRule.jass](ctx: JassCstNode) {
        //console.log(JassRule.jass, ctx);
        ctx[JassRule.type_declare]?.map(item => this.visit(item));
        ctx[JassRule.native_declare]?.map(item => this.visit(item));
        ctx[JassRule.function_declare]?.map(item => this.visit(item));
        ctx[JassRule.globals_declare]?.map(item => this.visit(item));
    }

    [JassRule.end](ctx: JassCstNode) {
        return ctx;
    }

    [JassRule.globals_declare](ctx: JassCstNode) {
        const b = this?.bridge;

        if (b) {
            b.mark(ctx[JassRule.globals]?.[0], TokenLegend.jass_globals);
            b.mark(ctx[JassRule.endglobals]?.[0], TokenLegend.jass_endglobals);
        }

        const vardecl = ctx[JassRule.variable_declare];

        if (vardecl) {
            for (const vd of vardecl) {
                const variable = this.visit(vd);
                const typedname = variable?.[JassRule.typedname];
                const local: IToken = variable?.[JassRule.local];

                if (b && local) {
                    b.diagnostics.push({
                        message: i18next.t(i18n.localInGlobalsError),
                        range: new Range(
                            b.document.positionAt(local.startOffset),
                            b.document.positionAt(local.startOffset + local.image.length)
                        ),
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
        const b = this?.bridge;
        if (b) {
            //console.log(ctx[JassRule.takes]?.[0].startColumn);

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
        const b = this?.bridge;

        if (b) {
            b.mark(ctx[JassRule.constant]?.[0], TokenLegend.jass_constant);
            b.mark(ctx[JassRule.function]?.[0], TokenLegend.jass_function);
            b.mark(ctx[JassRule.identifier]?.[0], TokenLegend.jass_function_user);
            b.mark(ctx[JassRule.takes]?.[0], TokenLegend.jass_takes);
            b.mark(ctx[JassRule.returns]?.[0], TokenLegend.jass_returns);
            b.mark(ctx[JassRule.endfunction]?.[0], TokenLegend.jass_endfunction);
        }

        // argument
        const args = this.visit(ctx[JassRule.function_args]!);

        // check array in argument
        if (b && args?.list) {
            for (const arg of args.list) {
                const array = arg[JassRule.array];
                if (array) {
                    b.diagnostics.push({
                        message: i18next.t(i18n.arrayInFunctionArgumentError),
                        range: new Range(
                            b.document.positionAt(array.startOffset),
                            b.document.positionAt(array.startOffset + array.image.length)
                        ),
                        severity: DiagnosticSeverity.Error
                    });
                }
            }
        }

        const locals = ctx?.[JassRule.function_locals];

        // locals, check locals with same name, check local redeclare argument
        if (locals) {
            const localMap: Record<string, IToken[]> = {};

            for (const local of locals) {
                const typedname = this.visit(local)?.[JassRule.typedname];
                if (!typedname) continue;
                const {type, name} = typedname;
                if (b) {
                    b.mark(type, TokenLegend.jass_type_name);
                    b.mark(name, TokenLegend.jass_variable);
                }
                if (name) {
                    (localMap[name.image] ??= []).push(name);
                    const argList = args.map[name.image];
                    if (b && argList) {
                        for (const t of [name, ...argList]) {
                            this.bridge?.diagnostics.push({
                                message: i18next.t(i18n.localRedeclareArgumentError, {name: t.image}),
                                range: new Range(
                                    b.document.positionAt(t.startOffset),
                                    b.document.positionAt(t.startOffset + t.image.length)
                                ),
                                severity: DiagnosticSeverity.Warning
                            });
                        }
                    }
                }
            }

            if (b) for (const v of Object.values(localMap)) {
                if (v.length < 2) continue;
                for (const t of v) {
                    b.diagnostics.push({
                        message: i18next.t(i18n.localRedeclaredError, {name: t.image}),
                        range: new Range(
                            b.document.positionAt(t.startOffset),
                            b.document.positionAt(t.startOffset + t.image.length)
                        ),
                        severity: DiagnosticSeverity.Warning
                    });
                }
            }
        }

        // statement
        const statements = ctx[JassRule.statement];
        if (statements) {
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
        const variableDeclare = ctx[JassRule.variable_declare];
        if (!variableDeclare) return null;
        const variable = this.visit(variableDeclare);

        const b = this.bridge;
        if (b) {
            const constant = variable?.[JassRule.constant];
            if (constant) {
                b.diagnostics.push({
                    message: i18next.t(i18n.constantInFunctionError),
                    range: new Range(
                        b.document.positionAt(constant.startOffset),
                        b.document.positionAt(constant.startOffset + constant.image.length)
                    ),
                    severity: DiagnosticSeverity.Error
                });
            }

            const local = variable?.[JassRule.local];
            if (!local) {
                const {type} = variable?.[JassRule.typedname];
                if (type) {
                    b.diagnostics.push({
                        message: i18next.t(i18n.misssingLocalKeywordError),
                        range: new Range(
                            b.document.positionAt(type.startOffset),
                            b.document.positionAt(type.startOffset + type.image.length)
                        ),
                        severity: DiagnosticSeverity.Error
                    });
                }
            }
        }

        return variable;
    }

    [JassRule.typedname](ctx: JassCstNode) {
        const array = ctx[JassRule.array]?.[0];
        this?.bridge?.mark(array, TokenLegend.jass_array);

        const list = ctx[JassRule.identifier];
        if (!list) return {};

        const [type, name] = list;
        return {
            type: type?.isInsertedInRecovery ?? false ? null : type,
            name: name?.isInsertedInRecovery ?? false ? null : name,
            array
        };
    }

    [JassRule.function_call](ctx: JassCstNode) {
        // console.log(JassRule.function_call, ctx);
        const b = this.bridge;
        if (b) {
            b.mark(ctx[JassRule.identifier]?.[0], TokenLegend.jass_function_user);
            b.mark(ctx[JassRule.lparen]?.[0], TokenLegend.jass_lparen);
            b.mark(ctx[JassRule.rparen]?.[0], TokenLegend.jass_rparen);
            ctx[JassRule.comma]?.map(item => this?.bridge?.mark(item, TokenLegend.jass_comma));
        }
        ctx[JassRule.expression]?.map(item => this.visit(item));
        return ctx;
    }

    [JassRule.function_args](ctx: JassCstNode) {
        const b = this?.bridge;

        // nothing
        const nothing = ctx?.[JassRule.nothing]?.[0];
        if (nothing) {
            b?.mark(nothing, TokenLegend.jass_type_name);
            return {map: {}, list: []};
        }

        // commas
        const commas = ctx[JassRule.comma];
        if (b && commas) for (const comma of commas) {
            this?.bridge?.mark(comma, TokenLegend.jass_comma);
        }

        // args
        const args = ctx?.[JassRule.typedname]?.map(item => this.visit(item));
        const argMap: Record<string, IToken[]> = {};

        // typedname, check type same name
        if (args) {
            for (const arg of args) {
                const {type, name} = arg;
                this?.bridge?.mark(type, TokenLegend.jass_type_name);
                this?.bridge?.mark(name, TokenLegend.jass_argument);
                if (name) (argMap[name.image] ??= []).push(name);
            }

            if (b) for (const v of Object.values(argMap)) {
                if (v.length < 2) continue;
                for (const t of v) {
                    b.diagnostics.push({
                        message: i18next.t(i18n.sameNameArgumentError, {name: t.image}),
                        range: new Range(
                            b.document.positionAt(t.startOffset),
                            b.document.positionAt(t.startOffset + t.image.length)
                        ),
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
        const b = this?.bridge;
        const nothing = ctx[JassRule.nothing]?.[0];
        const type = ctx[JassRule.identifier]?.[0];

        if (b) {
            if (nothing) b.mark(nothing, TokenLegend.jass_type_name);
            if (type) b.mark(type, TokenLegend.jass_type_name);
        }

        return null;
    }

    [JassRule.variable_declare](ctx: JassCstNode) {
        //console.log(JassRule.variable_declare, ctx);
        const equals = ctx[JassRule.assign]?.[0];
        const typedname = this.visit(ctx[JassRule.typedname]!);
        const array = typedname[JassRule.array];
        const b = this.bridge;

        // check array assing
        if (b && equals && array) {
            b.diagnostics.push({
                message: i18next.t(i18n.arrayInitializeError),
                range: new Range(
                    b.document.positionAt(array.startOffset),
                    b.document.positionAt(array.startOffset + array.image.length)
                ),
                severity: DiagnosticSeverity.Error
            });
        }

        const local = ctx[JassRule.local]?.[0];
        const constant = ctx[JassRule.constant]?.[0];

        if (b) {
            if (local) b.mark(local, TokenLegend.jass_local);
            if (constant) b.mark(constant, TokenLegend.jass_constant);
            b.mark(ctx[JassRule.assign]?.[0], TokenLegend.jass_equals);
        }

        const exp = ctx[JassRule.expression];
        if (exp) this.visit(exp);

        return {
            [JassRule.typedname]: typedname,
            [JassRule.local]: local,
            [JassRule.constant]: constant
        };
    }

    [JassRule.statement](ctx: JassCstNode) {
        for (const statement of [
            ctx[JassRule.if_statement],
            ctx[JassRule.set_statement],
            ctx[JassRule.call_statement],
            ctx[JassRule.loop_statement],
            ctx[JassRule.exitwhen_statement],
            ctx[JassRule.return_statement]
        ]) if (statement) return this.visit(statement);

        return null;
    }

    [JassRule.call_statement](ctx: JassCstNode) {
        //console.log(JassRule.call_statement, ctx)
        this?.bridge?.mark(ctx[JassRule.debug]?.[0], TokenLegend.jass_debug);
        this?.bridge?.mark(ctx[JassRule.call]?.[0], TokenLegend.jass_call);
        this.visit(ctx[JassRule.function_call]!);
        return null;
    }

    [JassRule.set_statement](ctx: JassCstNode) {
        // console.log(JassRule.set_statement, ctx);
        this?.bridge?.mark(ctx[JassRule.set]?.[0], TokenLegend.jass_set);
        this?.bridge?.mark(ctx[JassRule.identifier]?.[0], TokenLegend.jass_variable);
        this?.bridge?.mark(ctx[JassRule.assign]?.[0], TokenLegend.jass_assign);

        this.visit(ctx[JassRule.expression]!);
        this.visit(ctx[JassRule.arrayaccess]!);
        return null;
    }

    [JassRule.loop_statement](ctx: JassCstNode) {
        this?.bridge?.mark(ctx[JassRule.loop]?.[0], TokenLegend.jass_loop);
        this?.bridge?.mark(ctx[JassRule.endloop]?.[0], TokenLegend.jass_endloop);
        ctx[JassRule.statement]?.map(item => this.visit(item));
        return ctx;
    }

    [JassRule.exitwhen_statement](ctx: JassCstNode) {
        this?.bridge?.mark(ctx[JassRule.exitwhen]?.[0], TokenLegend.jass_loop);

        this.visit(ctx[JassRule.expression]!);
        return ctx;
    }

    [JassRule.return_statement](ctx: JassCstNode) {
        this?.bridge?.mark(ctx[JassRule.return]?.[0], TokenLegend.jass_return);

        this.visit(ctx[JassRule.expression]!);
        return null;
    }

    [JassRule.if_statement](ctx: JassCstNode) {
        // console.log(JassRule.if_statement, ctx);
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
        this.visit(ctx[JassRule.expression]!);
        this?.bridge?.mark(ctx[JassRule.elseif]?.[0], TokenLegend.jass_elseif);
        this?.bridge?.mark(ctx[JassRule.then]?.[0], TokenLegend.jass_then);
        ctx[JassRule.statement]?.map(item => this.visit(item));
        return null;
    }

    [JassRule.else_statement](ctx: JassCstNode) {
        this?.bridge?.mark(ctx[JassRule.else]?.[0], TokenLegend.jass_else);
        ctx[JassRule.statement]?.map(item => this.visit(item));
        return null;
    }

    [JassRule.expression](ctx: JassCstNode) {
        //console.log(JassRule.expression, ctx);
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
        //console.log(JassRule.primary, ctx);
        this.#string(ctx);
        const b = this?.bridge;
        if (b) {
            b.mark(ctx[JassRule.sub]?.[0], TokenLegend.jass_sub);
            b.mark(ctx[JassRule.integer]?.[0], TokenLegend.jass_integer);
            b.mark(ctx[JassRule.real]?.[0], TokenLegend.jass_real);
            b.mark(ctx[JassRule.idliteral]?.[0], TokenLegend.jass_idliteral);
            b.mark(ctx[JassRule.function]?.[0], TokenLegend.jass_function);
            // TODO add colors
            b.mark(ctx[JassRule.not]?.[0], TokenLegend.jass_function);

            const identifier = ctx[JassRule.identifier]?.[0];
            if (identifier) {
                if (['null', 'true', 'false'].indexOf(identifier.image) < 0) {
                    b.mark(identifier, TokenLegend.jass_variable);
                } else {
                    // TODO add colors
                    b.mark(identifier, TokenLegend.jass_function);
                }
            }
        }
        this.visit(ctx[JassRule.arrayaccess]!);
        this.visit(ctx[JassRule.function_call]!);
        this.visit(ctx[JassRule.expression]!);
        this.visit(ctx[JassRule.primary]!);
        return null;
    }

    [JassRule.addition](ctx: JassCstNode) {
        // console.log(JassRule.addition, ctx);
        ctx[JassRule.add]?.map(item => this?.bridge?.mark(item, TokenLegend.jass_add));
        ctx[JassRule.sub]?.map(item => this?.bridge?.mark(item, TokenLegend.jass_sub));

        ctx[JassRule.multiplication]?.map(item => this.visit(item));
        return null;
    }

    [JassRule.multiplication](ctx: JassCstNode) {
        // console.log(JassRule.multiplication, ctx);
        const b = this?.bridge;

        if (b) {
            ctx[JassRule.mult]?.map(item => b.mark(item, TokenLegend.jass_mult));
            ctx[JassRule.div]?.map(item => b.mark(item, TokenLegend.jass_div));
        }

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
