import * as vscode from 'vscode';  
  
export function findRegexMatches(document: vscode.TextDocument, pattern: string): vscode.Range[] {  
    const text = document.getText();  
    let regex: RegExp;  
  
    try {  
        regex = new RegExp(pattern, 'gm');  
    } catch (e: any) {  
        vscode.window.showErrorMessage(`Regex inválido: ${e.message}`);  
        return [];  
    }  
  
    const ranges: vscode.Range[] = [];  
    let match: RegExpExecArray | null;  
  
    while ((match = regex.exec(text)) !== null) {  
        const matchText = match[1] !== undefined ? match[1] : match[0];  
        const startIndex = match[1] !== undefined  
            ? match.index + match[0].indexOf(match[1])  
            : match.index;  
  
        const startPos = document.positionAt(startIndex);  
        const endPos = document.positionAt(startIndex + matchText.length);  
        ranges.push(new vscode.Range(startPos, endPos));  
  
        if (match[0].length === 0) {  
            regex.lastIndex++;  
        }  
    }  
  
    return ranges;  
}