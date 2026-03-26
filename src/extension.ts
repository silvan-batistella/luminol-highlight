import * as vscode from 'vscode';
import { activateLuminol, deactivateLuminol } from './luminol';
import { HighlightManager } from './highlightManager';
import { HighlightTreeProvider } from './sidebar/highlightTreeProvider';
import { HighlightItem } from './sidebar/highlightItem';
import { pickColor } from './colorPicker';

let manager: HighlightManager;
let debounceTimer: NodeJS.Timeout | undefined;
let isLuminolActive = false;

export function activate(context: vscode.ExtensionContext) {
    manager = new HighlightManager();

    // Sidebar  
    const treeProvider = new HighlightTreeProvider(manager);
    vscode.window.registerTreeDataProvider('highlightList', treeProvider);

    // Estado inicial dos comentários  
    vscode.commands.executeCommand('setContext', 'highlight.commentsVisible', true);

    // Restaurar highlights salvos no workspace  
    const saved = HighlightManager.loadState(context);
    const activeEditor = vscode.window.activeTextEditor;
    if (activeEditor && saved.length > 0) {
        for (const { pattern, color, comment } of saved) {
            manager.addHighlight(activeEditor, pattern, color, comment);
        }
    }

    // Ao trocar de arquivo: sempre reaplicar highlights  
    const onEditorChange = vscode.window.onDidChangeActiveTextEditor((editor) => {
        if (!editor) { return; }
        manager.refreshAll(editor);
        if (isLuminolActive) {
            activateLuminol(manager, editor);
        }
    });

    // Comando: adicionar highlight  
    const addCmd = vscode.commands.registerCommand('highlight.addPattern', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showWarningMessage('Nenhum editor ativo.');
            return;
        }

        const selection = editor.selection;
        const selectedText = !selection.isEmpty && selection.isSingleLine
            ? editor.document.getText(selection)
            : '';

        const pattern = await vscode.window.showInputBox({
            prompt: 'Digite o padrão regex',
            placeHolder: 'Ex: <tag>(.*?)</tag>',
            value: selectedText,
        });
        if (!pattern) { return; }

        const color = await pickColor();
        if (!color) { return; }

        const comment = await vscode.window.showInputBox({
            prompt: 'Justificativa do highlight (opcional — Enter para pular, use \\n para quebra de linha)',
            placeHolder: 'Ex: Erro crítico\\nVerificar logs',
        });

        manager.addHighlight(editor, pattern, color, comment || undefined);
        manager.saveState(context);

        if (isLuminolActive) {
            activateLuminol(manager, editor);
        }
    });

    // Comando: remover highlight  
    const removeCmd = vscode.commands.registerCommand('highlight.removePattern', (item: HighlightItem) => {
        if (item) {
            manager.removeHighlight(item.index);
            const editor = vscode.window.activeTextEditor;
            if (editor) {
                manager.refreshAll(editor);
                if (isLuminolActive) {
                    activateLuminol(manager, editor);
                }
            }
            manager.saveState(context);
        }
    });

    // Reatividade  
    const onChange = vscode.workspace.onDidChangeTextDocument((e) => {
        const editor = vscode.window.activeTextEditor;
        if (!editor || editor.document !== e.document) { return; }
        if (manager.isSuppressed) { return; }

        if (debounceTimer) { clearTimeout(debounceTimer); }
        debounceTimer = setTimeout(() => {
            manager.refreshAll(editor);
            if (isLuminolActive) {
                activateLuminol(manager, editor);
            }
        }, 300);
    });

    // Comando: editar cor  
    const editColorCmd = vscode.commands.registerCommand('highlight.editColor', async (item: HighlightItem) => {
        if (!item) { return; }

        const editor = vscode.window.activeTextEditor;

        const newColor = await pickColor(item.entry.color);
        if (!newColor) { return; }

        if (editor) {
            manager.editColor(item.index, newColor, editor);
            if (isLuminolActive) {
                activateLuminol(manager, editor);
            }
        }
        manager.saveState(context);
    });

    // Comando: editar comentário  
    const editCommentCmd = vscode.commands.registerCommand('highlight.editComment', async (item: HighlightItem) => {
        if (!item) { return; }

        const current = item.entry.comment ?? '';
        const newComment = await vscode.window.showInputBox({
            prompt: 'Editar justificativa (use \\n para quebra de linha, vazio para remover)',
            value: current,
        });

        if (newComment === undefined) { return; } // cancelou  

        manager.editComment(item.index, newComment || undefined);
        manager.saveState(context);
    });

    // Comando: ir para próximo match  
    const goToNextCmd = vscode.commands.registerCommand('highlight.goToNext', (item: HighlightItem) => {
        if (!item) { return; }

        const editor = vscode.window.activeTextEditor;
        if (!editor) { return; }

        const ranges = manager.getRanges(item.index);
        if (ranges.length === 0) { return; }

        const cursor = editor.selection.active;
        const next = ranges.find(r => r.start.isAfter(cursor)) ?? ranges[0];

        editor.selection = new vscode.Selection(next.start, next.start);
        editor.revealRange(next, vscode.TextEditorRevealType.InCenter);
    });

    // Comando: suprimir highlights  
    const suppressCmd = vscode.commands.registerCommand('highlight.suppressAll', () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) { return; }
        manager.suppressAll(editor);
        if (isLuminolActive) {
            deactivateLuminol(manager, editor);
        }
        vscode.commands.executeCommand('setContext', 'highlight.isSuppressed', true);
    });

    const unsuppressCmd = vscode.commands.registerCommand('highlight.unsuppressAll', () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) { return; }
        manager.unsuppressAll(editor);
        if (isLuminolActive) {
            activateLuminol(manager, editor);
        }
        vscode.commands.executeCommand('setContext', 'highlight.isSuppressed', false);
    });

    // Comando: luminol  
    const luminolCmd = vscode.commands.registerCommand('highlight.luminol', () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) { return; }
        isLuminolActive = true;
        activateLuminol(manager, editor);
        vscode.commands.executeCommand('setContext', 'highlight.isLuminol', true);
    });

    const luminolOffCmd = vscode.commands.registerCommand('highlight.luminolOff', () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) { return; }
        isLuminolActive = false;
        deactivateLuminol(manager, editor);
        vscode.commands.executeCommand('setContext', 'highlight.isLuminol', false);
    });

    // Comando: mostrar comentários  
    const showCommentsCmd = vscode.commands.registerCommand('highlight.showComments', () => {
        treeProvider.commentsVisible = true;
        vscode.commands.executeCommand('setContext', 'highlight.commentsVisible', true);
    });

    // Comando: ocultar comentários  
    const hideCommentsCmd = vscode.commands.registerCommand('highlight.hideComments', () => {
        treeProvider.commentsVisible = false;
        vscode.commands.executeCommand('setContext', 'highlight.commentsVisible', false);
    });

    context.subscriptions.push(
        addCmd, removeCmd, editColorCmd, editCommentCmd, goToNextCmd,
        suppressCmd, unsuppressCmd, luminolCmd, luminolOffCmd,
        showCommentsCmd, hideCommentsCmd,
        onChange, onEditorChange, manager
    );
}

export function deactivate() { }