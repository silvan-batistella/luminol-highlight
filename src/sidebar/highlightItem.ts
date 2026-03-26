import * as vscode from 'vscode';
import { HighlightEntry } from '../highlightManager';

function parseEscapes(text: string): string {
    return text.replace(/\\n/g, '\n').replace(/\\t/g, '    ');
}

export class HighlightItem extends vscode.TreeItem {
    constructor(
        public readonly entry: HighlightEntry,
        public readonly index: number,
        commentsVisible: boolean
    ) {
        const count = entry.ranges.length;
        const truncated = entry.pattern.length > 30
            ? entry.pattern.substring(0, 30) + '...'
            : entry.pattern;

        const hasComment = commentsVisible && !!entry.comment;
        super(
            `${count} — ${truncated}`,
            hasComment
                ? vscode.TreeItemCollapsibleState.Expanded
                : vscode.TreeItemCollapsibleState.None
        );

        // id estável para que o VS Code preserve o estado de collapse entre refreshes  
        this.id = `highlight-${index}-${entry.pattern}`;
        this.tooltip = entry.pattern;
        this.description = `${count} match(es)`;
        this.contextValue = 'highlightEntry';

        const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><rect width="16" height="16" rx="2" fill="${entry.color}"/></svg>`;
        this.iconPath = vscode.Uri.parse(
            `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
        );
    }

    getCommentLines(): CommentLineItem[] {
        if (!this.entry.comment) { return []; }
        const parsed = parseEscapes(this.entry.comment);
        return parsed.split('\n').map(
            (line, i) => new CommentLineItem(line, this.index, i)
        );
    }
}

export class CommentLineItem extends vscode.TreeItem {
    constructor(
        public readonly line: string,
        public readonly parentIndex: number,
        public readonly lineIndex: number
    ) {
        super(line, vscode.TreeItemCollapsibleState.None);

        this.id = `comment-${parentIndex}-${lineIndex}`;
        this.contextValue = 'highlightComment';
        this.iconPath = lineIndex === 0
            ? new vscode.ThemeIcon('comment')
            : undefined;
    }
}