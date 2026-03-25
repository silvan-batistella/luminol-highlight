import * as vscode from 'vscode';  
import { HighlightManager } from './highlightManager';  
  
let dimDecoration: vscode.TextEditorDecorationType | undefined;  
  
export function activateLuminol(manager: HighlightManager, editor: vscode.TextEditor): void {  
    deactivateLuminol(manager, editor);  
  
    const highlights = manager.getHighlights();  
    const highlightedLines = new Set<number>();  
  
    // Coletar todas as linhas que possuem highlight  
    for (const entry of highlights) {  
        for (const range of entry.ranges) {  
            for (let line = range.start.line; line <= range.end.line; line++) {  
                highlightedLines.add(line);  
            }  
        }  
    }  
  
    // Dim apenas nas linhas SEM highlight  
    const dimRanges: vscode.Range[] = [];  
    const lineCount = editor.document.lineCount;  
    for (let i = 0; i < lineCount; i++) {  
        if (!highlightedLines.has(i)) {  
            const line = editor.document.lineAt(i);  
            dimRanges.push(line.range);  
        }  
    }  
  
    dimDecoration = vscode.window.createTextEditorDecorationType({  
        opacity: '0.6',  
    });  
    editor.setDecorations(dimDecoration, dimRanges);  
}  
  
export function deactivateLuminol(manager: HighlightManager, editor: vscode.TextEditor): void {  
    if (dimDecoration) {  
        dimDecoration.dispose();  
        dimDecoration = undefined;  
    }  
  
    // Restaurar decorações originais (caso algo tenha sido sobrescrito)  
    for (const entry of manager.getHighlights()) {  
        editor.setDecorations(entry.decorationType, entry.ranges);  
    }  
}