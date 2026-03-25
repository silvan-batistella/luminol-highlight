import * as vscode from 'vscode';  
import { activateLuminol, deactivateLuminol } from './luminol';  
import { HighlightManager } from './highlightManager';  
import { HighlightTreeProvider } from './sidebar/highlightTreeProvider';  
import { HighlightItem } from './sidebar/highlightItem';  
  
let manager: HighlightManager;  
let debounceTimer: NodeJS.Timeout | undefined;  
  
export function activate(context: vscode.ExtensionContext) {  
    manager = new HighlightManager();  
  
    // Sidebar  
    const treeProvider = new HighlightTreeProvider(manager);  
    vscode.window.registerTreeDataProvider('highlightList', treeProvider);  
  
    // --- Variáveis de estado (todas no topo para clareza) ---  
    let highlightScope: 'workspace' | 'openFiles' | 'activeOnly' = 'workspace';  
    let isLuminolActive = false;  
    let pendingRestore = false;  
  
    vscode.commands.executeCommand('setContext', 'highlight.scope', highlightScope);  
  
    // --- Restaurar highlights salvos no workspace ---  
    const saved = HighlightManager.loadState(context);  
    const activeEditor = vscode.window.activeTextEditor;  
    if (activeEditor && saved.length > 0) {  
        for (const { pattern, color } of saved) {  
            manager.addHighlight(activeEditor, pattern, color);  
        }  
    } else if (saved.length > 0) {  
        pendingRestore = true;  
    }  
  
    // --- Ao trocar de arquivo: comportamento depende do escopo ---  
    const onEditorChange = vscode.window.onDidChangeActiveTextEditor((editor) => {  
        if (!editor) { return; }  
  
        // Restauração adiada  
        if (pendingRestore) {  
            const savedPatterns = HighlightManager.loadState(context);  
            for (const { pattern, color } of savedPatterns) {  
                manager.addHighlight(editor, pattern, color);  
            }  
            pendingRestore = false;  
        }  
  
        if (highlightScope === 'workspace') {  
            manager.refreshAll(editor);  
        } else if (highlightScope === 'openFiles') {  
            for (const visibleEditor of vscode.window.visibleTextEditors) {  
                manager.refreshAll(visibleEditor);  
            }  
        } else if (highlightScope === 'activeOnly') {  
            for (const visibleEditor of vscode.window.visibleTextEditors) {  
                if (visibleEditor !== editor) {  
                    manager.clearDecorations(visibleEditor);  
                }  
            }  
            manager.refreshAll(editor);  
        }  
  
        // Reaplicar Luminol no novo editor  
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
  
        const pattern = await vscode.window.showInputBox({  
            prompt: 'Digite o padrão regex',  
            placeHolder: 'Ex: <tag>(.*?)</tag>',  
        });  
        if (!pattern) { return; }  
  
        const colorOptions = [  
            { label: '#FFFF00', description: 'Amarelo' },  
            { label: '#FF6B6B', description: 'Vermelho claro' },  
            { label: '#4ECDC4', description: 'Verde água' },  
            { label: '#45B7D1', description: 'Azul claro' },  
            { label: '#96CEB4', description: 'Verde pastel' },  
            { label: '#DDA0DD', description: 'Lilás' },  
            { label: 'Cor customizada...', description: '' },  
        ];  
  
        const picked = await vscode.window.showQuickPick(colorOptions, {  
            placeHolder: 'Escolha uma cor',  
        });  
        if (!picked) { return; }  
  
        let color = picked.label;  
        if (color === 'Cor customizada...') {  
            const custom = await vscode.window.showInputBox({  
                prompt: 'Digite o código HEX',  
                placeHolder: '#FF00FF',  
            });  
            if (!custom) { return; }  
            color = custom;  
        }  
  
        manager.addHighlight(editor, pattern, color);  
        manager.saveState(context);  
  
        // Se escopo é openFiles, aplicar nos editores visíveis também  
        if (highlightScope === 'openFiles') {  
            for (const visibleEditor of vscode.window.visibleTextEditors) {  
                if (visibleEditor !== editor) {  
                    manager.refreshAll(visibleEditor);  
                }  
            }  
        }  
  
        // Atualizar Luminol após adicionar highlight  
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
  
        const newColor = await vscode.window.showInputBox({  
            prompt: 'Nova cor HEX',  
            placeHolder: '#FF00FF',  
            value: item.entry.color,  
        });  
        if (!newColor) { return; }  
  
        const editor = vscode.window.activeTextEditor;  
        if (editor) {  
            manager.editColor(item.index, newColor, editor);  
        }  
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
  
    // Comando: escopo → workspace  
    const scopeWorkspaceCmd = vscode.commands.registerCommand('highlight.scopeWorkspace', () => {  
        highlightScope = 'workspace';  
        vscode.commands.executeCommand('setContext', 'highlight.scope', 'workspace');  
        const editor = vscode.window.activeTextEditor;  
        if (editor) { manager.refreshAll(editor); }  
    });  
  
    // Comando: escopo → open files  
    const scopeOpenFilesCmd = vscode.commands.registerCommand('highlight.scopeOpenFiles', () => {  
        highlightScope = 'openFiles';  
        vscode.commands.executeCommand('setContext', 'highlight.scope', 'openFiles');  
        for (const editor of vscode.window.visibleTextEditors) {  
            manager.refreshAll(editor);  
        }  
    });  
  
    // Comando: escopo → active only  
    const scopeActiveOnlyCmd = vscode.commands.registerCommand('highlight.scopeActiveOnly', () => {  
        highlightScope = 'activeOnly';  
        vscode.commands.executeCommand('setContext', 'highlight.scope', 'activeOnly');  
        const editor = vscode.window.activeTextEditor;  
        if (editor) {  
            for (const visibleEditor of vscode.window.visibleTextEditors) {  
                if (visibleEditor !== editor) {  
                    manager.clearDecorations(visibleEditor);  
                }  
            }  
            manager.refreshAll(editor);  
        }  
    });  
  
    context.subscriptions.push(  
        addCmd, removeCmd, editColorCmd, goToNextCmd,  
        suppressCmd, unsuppressCmd, luminolCmd, luminolOffCmd,  
        scopeWorkspaceCmd, scopeOpenFilesCmd, scopeActiveOnlyCmd,  
        onChange, onEditorChange, manager  
    );  
}  
  
export function deactivate() {}