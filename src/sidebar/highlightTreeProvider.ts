import * as vscode from 'vscode';
import { HighlightManager } from '../highlightManager';
import { HighlightItem, CommentLineItem } from './highlightItem';

type TreeNode = HighlightItem | CommentLineItem;

export class HighlightTreeProvider implements vscode.TreeDataProvider<TreeNode> {
    private _onDidChangeTreeData = new vscode.EventEmitter<TreeNode | undefined | void>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    private _commentsVisible = true;

    constructor(private manager: HighlightManager) {
        manager.onDidChange(() => this.refresh());
    }

    get commentsVisible(): boolean {
        return this._commentsVisible;
    }

    set commentsVisible(value: boolean) {
        this._commentsVisible = value;
        this.refresh();
    }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: TreeNode): vscode.TreeItem {
        return element;
    }

    getChildren(element?: TreeNode): TreeNode[] {
        // Raiz: retorna os highlights  
        if (!element) {
            return this.manager.getHighlights().map(
                (entry, index) => new HighlightItem(entry, index, this._commentsVisible)
            );
        }

        // Filho de um HighlightItem: retorna as linhas de comentário  
        if (element instanceof HighlightItem && this._commentsVisible) {
            return element.getCommentLines();
        }

        return [];
    }
}