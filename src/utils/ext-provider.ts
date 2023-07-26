import {
    languages,
    DocumentSemanticTokensProvider,
    DocumentSymbolProvider,
    FoldingRangeProvider,
    DiagnosticCollection,
    TextDocument,
    SemanticTokens,
    DocumentSymbol,
    SymbolInformation,
    FoldingRange,
    commands,
    DiagnosticSeverity,
    CancellationToken,
    Range, Position,
} from 'vscode';
import {CstParser, ICstVisitor, Lexer} from 'chevrotain';
import VscodeBridge from "./vscode-bridge";
import ITokenToRange from "./i-token-to-range";
import {IParserConfig, IToken, TokenType} from "@chevrotain/types";

interface IParserConstructor {
    new(config?: IParserConfig): CstParser;
}

interface IVisitorConstructor {
    new(): IVisitor;
}

interface IVisitor extends ICstVisitor<any, any> {
    bridge?: VscodeBridge,
}

export default class ExtProvider implements DocumentSemanticTokensProvider, DocumentSymbolProvider, FoldingRangeProvider {

    constructor(name: string, lexerDefinition: TokenType[], parser: IParserConstructor, visitor: IVisitorConstructor) {
        this.name = name;
        this.#parser = parser;
        this.#lexerDefinition = lexerDefinition;
        this.#visitor = visitor;
    }

    name: string;
    #collections: Record<string, DiagnosticCollection> = {};

    readonly #lexerDefinition: TokenType[];
    #lexers: Record<string, Lexer> = {};

    readonly #parser: IParserConstructor;
    #parsers: Record<string, CstParser> = {};

    readonly #visitor: IVisitorConstructor;

    #versions: Record<string, number> = {};
    #symbols: Record<string, DocumentSymbol[] | SymbolInformation[]> = {};
    #foldings: Record<string, FoldingRange[]> = {};

    //async provideDocumentSemanticTokens(document: vscode.TextDocument, token: vscode.CancellationToken): Promise<vscode.SemanticTokens>
    async provideDocumentSemanticTokens(document: TextDocument, token: CancellationToken): Promise<SemanticTokens> {
        return new Promise<SemanticTokens>(resolve => {
            token.onCancellationRequested(resolve);

            //=== settings
            const text = document.getText();
            const path = document.uri.path;
            const bridge = new VscodeBridge(
                this.#symbols[path] = [],
                this.#foldings[path] = [],
            );

            //===  lexing
            const lexer = this.#lexers[path] ??= new Lexer(this.#lexerDefinition, {
                errorMessageProvider: {
                    buildUnexpectedCharactersMessage: (): string => {
                        return 'Unexpected Character';
                    },
                    buildUnableToPopLexerModeMessage: (token: IToken): string => {
                        // eslint-disable-next-line no-console
                        console.error('buildUnableToPopLexerModeMessage', token);
                        return 'buildUnableToPopLexerModeMessage';
                    },
                },

            });
            const lexing = lexer.tokenize(text);
            for (const error of lexing.errors) {
                if (error.line && error.column && error.length) {
                    bridge.diagnostics.push({
                        message: error.message,
                        range: new Range(
                            new Position(error.line - 1, error.column - 1),
                            new Position(error.line - 1, error.column - 1 + error.length)
                        ),
                        severity: DiagnosticSeverity.Error,
                    });
                }
            }

            //=== parsing
            const parser = this.#parsers[path] ??= new this.#parser({
                recoveryEnabled: true,
                errorMessageProvider: {
                    buildMismatchTokenMessage: (): string => 'MismatchToken',
                    buildNotAllInputParsedMessage: (): string => 'NotAllInputParsed',
                    buildNoViableAltMessage: (): string => 'NoViableAlt',
                    buildEarlyExitMessage: (): string => 'EarlyExit',
                }
            });
            parser.input = lexing.tokens;
            // @ts-ignore
            const parsing = parser[this.name]();
            for (const error of parser.errors) {
                bridge.diagnostics.push({
                    message: error.message,
                    range: ITokenToRange(error.token),
                    severity: DiagnosticSeverity.Error,
                });
            }

            //=== visitor
            const visitor = new this.#visitor();
            visitor.bridge = bridge;
            visitor.visit(parsing);

            const collection = this.#collections[path] ??= languages.createDiagnosticCollection(this.name);
            if (bridge.diagnostics.length > 0) collection.set(document.uri, bridge.diagnostics);
            else collection.clear();

            //=== resolve
            this.#versions[document.uri.path] = document.version;
            resolve(bridge.builder.build());
        });
    }

    async provideDocumentSymbols(document: TextDocument): Promise<SymbolInformation[] | DocumentSymbol[]> {
        if (document.version !== this.#versions[document.uri.path])
            await commands.executeCommand('_provideDocumentSemanticTokens', document.uri);

        return this.#symbols?.[document.uri.path];
    }

    async provideFoldingRanges(document: TextDocument): Promise<FoldingRange[]> {
        if (document.version !== this.#versions[document.uri.path])
            await commands.executeCommand('_provideDocumentSemanticTokens', document.uri);

        return this.#foldings?.[document.uri.path];
    }

}