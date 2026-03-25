import * as vscode from 'vscode';  
import { HighlightManager } from '../highlightManager';  
import { HighlightItem } from './highlightItem';  
  
export class HighlightTreeProvider implements vscode.TreeDataProvider<HighlightItem> {  
    private _onDidChangeTreeData = new vscode.EventEmitter<HighlightItem | undefined | void>();  
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;  
  
    constructor(private manager: HighlightManager) {  
        manager.onDidChange(() => this.refresh());  
    }  
  
    refresh(): void {  
        this._onDidChangeTreeData.fire();  
    }  
  
    getTreeItem(element: HighlightItem): vscode.TreeItem {  
        return element;  
    }  
  
    getChildren(): HighlightItem[] {  
        return this.manager.getHighlights().map(  
            (entry, index) => new HighlightItem(entry, index)  
        );  
    }  
}