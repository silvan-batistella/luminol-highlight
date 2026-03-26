import * as vscode from 'vscode';
import { findRegexMatches } from './regexMatcher';

export interface HighlightEntry {
    pattern: string;
    color: string;
    comment?: string;
    ranges: vscode.Range[];
    decorationType: vscode.TextEditorDecorationType;
}

export class HighlightManager implements vscode.Disposable {
    private highlights: HighlightEntry[] = [];
    private _onDidChange = new vscode.EventEmitter<void>();
    public readonly onDidChange = this._onDidChange.event;
    private _isSuppressed = false;

    saveState(context: vscode.ExtensionContext): void {
        const data = this.highlights.map(entry => ({
            pattern: entry.pattern,
            color: entry.color,
            comment: entry.comment,
        }));
        context.workspaceState.update('highlightPatterns', data);
    }

    static loadState(
        context: vscode.ExtensionContext
    ): { pattern: string; color: string; comment?: string }[] {
        return context.workspaceState.get<{ pattern: string; color: string; comment?: string }[]>(
            'highlightPatterns', []
        );
    }

    get isSuppressed(): boolean {
        return this._isSuppressed;
    }

    suppressAll(editor: vscode.TextEditor): void {
        this._isSuppressed = true;
        for (const entry of this.highlights) {
            editor.setDecorations(entry.decorationType, []);
        }
    }

    unsuppressAll(editor: vscode.TextEditor): void {
        this._isSuppressed = false;
        this.refreshAll(editor);
    }

    getHighlights(): HighlightEntry[] {
        return this.highlights;
    }

    addHighlight(editor: vscode.TextEditor, pattern: string, color: string, comment?: string): void {
        const ranges = findRegexMatches(editor.document, pattern);

        const decorationType = vscode.window.createTextEditorDecorationType({
            backgroundColor: color,
        });

        editor.setDecorations(decorationType, ranges);

        this.highlights.push({ pattern, color, comment, ranges, decorationType });
        this._onDidChange.fire();
    }

    removeHighlight(index: number): void {
        const entry = this.highlights[index];
        if (entry) {
            entry.decorationType.dispose();
            this.highlights.splice(index, 1);
            this._onDidChange.fire();
        }
    }

    editComment(index: number, comment: string | undefined): void {
        const entry = this.highlights[index];
        if (!entry) { return; }
        entry.comment = comment;
        this._onDidChange.fire();
    }

    clearDecorations(editor: vscode.TextEditor): void {
        for (const entry of this.highlights) {
            editor.setDecorations(entry.decorationType, []);
        }
    }

    refreshAll(editor: vscode.TextEditor): void {
        for (const entry of this.highlights) {
            entry.ranges = findRegexMatches(editor.document, entry.pattern);
            if (!this._isSuppressed) {
                editor.setDecorations(entry.decorationType, entry.ranges);
            }
        }
        this._onDidChange.fire();
    }

    editColor(index: number, newColor: string, editor: vscode.TextEditor): void {
        const entry = this.highlights[index];
        if (!entry) { return; }

        entry.decorationType.dispose();
        entry.color = newColor;
        entry.decorationType = vscode.window.createTextEditorDecorationType({
            backgroundColor: newColor,
        });
        editor.setDecorations(entry.decorationType, entry.ranges);
        this._onDidChange.fire();
    }

    getRanges(index: number): vscode.Range[] {
        return this.highlights[index]?.ranges ?? [];
    }

    dispose(): void {
        for (const entry of this.highlights) {
            entry.decorationType.dispose();
        }
        this.highlights = [];
    }
}