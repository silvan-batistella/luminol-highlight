import * as vscode from 'vscode';  
import { HighlightEntry } from '../highlightManager';  
  
export class HighlightItem extends vscode.TreeItem {  
    constructor(  
        public readonly entry: HighlightEntry,  
        public readonly index: number  
    ) {  
        const count = entry.ranges.length;  
        const truncated = entry.pattern.length > 30  
            ? entry.pattern.substring(0, 30) + '...'  
            : entry.pattern;  
  
        super(`${count} — ${truncated}`, vscode.TreeItemCollapsibleState.None);  
  
        this.tooltip = entry.pattern;  
        this.description = `${count} match(es)`;  
  
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><rect width="16" height="16" rx="2" fill="${entry.color}"/></svg>`;  
        this.iconPath = vscode.Uri.parse(  
            `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`  
        );  
    }  
}