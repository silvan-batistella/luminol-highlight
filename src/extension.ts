import * as vscode from 'vscode';
import { activateLuminol, deactivateLuminol } from './luminol';
import { HighlightManager } from './highlightManager';
import { HighlightTreeProvider } from './sidebar/highlightTreeProvider';
import { HighlightItem } from './sidebar/highlightItem';
import { pickColor } from './colorPicker';

let manager: HighlightManager;
let debounceTimer: NodeJS.Timeout | undefined;
let isLuminolActive = false;

function getEditor(): vscode.TextEditor | undefined {  
    return vscode.window.activeTextEditor ?? vscode.window.visibleTextEditors[0];  
}

export function activate(context: vscode.ExtensionContext) {
    manager = new HighlightManager();

    // Sidebar  
    const treeProvider = new HighlightTreeProvider(manager);
    vscode.window.registerTreeDataProvider('highlightList', treeProvider);

    // Estado inicial dos comentários  
    vscode.commands.executeCommand('setContext', 'highlight.commentsVisible', true);

    // Restaurar highlights salvos no workspace  
    const saved = HighlightManager.loadState(context);
    const activeEditor = getEditor();
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
        const editor = getEditor();
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
            const editor = getEditor();
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
        const editor = getEditor();
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

        // Capturar editor ANTES de abrir o WebView  
        const editor = getEditor();

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

    // Comando: ir para próximo match (por padrão individual — botão da sidebar)  
    const goToNextCmd = vscode.commands.registerCommand('highlight.goToNext', (item: HighlightItem) => {
        if (!item) { return; }

        const editor = getEditor();
        if (!editor) { return; }

        const ranges = manager.getRanges(item.index);
        if (ranges.length === 0) { return; }

        const cursor = editor.selection.active;
        const next = ranges.find(r => r.start.isAfter(cursor)) ?? ranges[0];

        editor.selection = new vscode.Selection(next.start, next.start);
        editor.revealRange(next, vscode.TextEditorRevealType.InCenter);
    });

    // Comando: próximo highlight global (F3) — navega por TODOS os padrões linearmente  
    const goToNextGlobalCmd = vscode.commands.registerCommand('highlight.goToNextGlobal', () => {
        const editor = getEditor();
        if (!editor) { return; }

        const allRanges = manager.getAllRanges();
        if (allRanges.length === 0) { return; }

        const cursor = editor.selection.active;
        const next = allRanges.find(r => r.start.isAfter(cursor)) ?? allRanges[0];

        editor.selection = new vscode.Selection(next.start, next.start);
        editor.revealRange(next, vscode.TextEditorRevealType.InCenter);
    });

    // Comando: highlight anterior global (Shift+F3)  
    const goToPrevGlobalCmd = vscode.commands.registerCommand('highlight.goToPrevGlobal', () => {
        const editor = getEditor();
        if (!editor) { return; }

        const allRanges = manager.getAllRanges();
        if (allRanges.length === 0) { return; }

        const cursor = editor.selection.active;
        const prev = [...allRanges].reverse().find(r => r.start.isBefore(cursor))
            ?? allRanges[allRanges.length - 1];

        editor.selection = new vscode.Selection(prev.start, prev.start);
        editor.revealRange(prev, vscode.TextEditorRevealType.InCenter);
    });

    // Comando: suprimir highlights  
    const suppressCmd = vscode.commands.registerCommand('highlight.suppressAll', () => {
        const editor = getEditor();
        if (!editor) { return; }

        // 1. Desativar Luminol PRIMEIRO (restaura decorações temporariamente — ok)  
        if (isLuminolActive) {
            deactivateLuminol(manager, editor);
            isLuminolActive = false;
            vscode.commands.executeCommand('setContext', 'highlight.isLuminol', false);
        }

        // 2. Agora suprimir highlights (não será desfeito pelo deactivateLuminol)  
        manager.suppressAll(editor);
        vscode.commands.executeCommand('setContext', 'highlight.isSuppressed', true);
    });

    const unsuppressCmd = vscode.commands.registerCommand('highlight.unsuppressAll', () => {
        const editor = getEditor();
        if (!editor) { return; }
        manager.unsuppressAll(editor);
        vscode.commands.executeCommand('setContext', 'highlight.isSuppressed', false);
    });

    // Comando: luminol  
    const luminolCmd = vscode.commands.registerCommand('highlight.luminol', () => {
        const editor = getEditor();
        if (!editor) { return; }
        isLuminolActive = true;
        activateLuminol(manager, editor);
        vscode.commands.executeCommand('setContext', 'highlight.isLuminol', true);
    });

    const luminolOffCmd = vscode.commands.registerCommand('highlight.luminolOff', () => {
        const editor = getEditor();
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

    // Comando: exportar highlights  
    const exportCmd = vscode.commands.registerCommand('highlight.exportHighlights', async () => {
        const data = manager.getExportData();
        if (data.length === 0) {
            vscode.window.showWarningMessage('Nenhum highlight para exportar.');
            return;
        }

        const uri = await vscode.window.showSaveDialog({
            defaultUri: vscode.Uri.file('highlights.json'),
            filters: { 'JSON': ['json'] },
            title: 'Exportar Highlights',
        });
        if (!uri) { return; }

        const json = JSON.stringify(data, null, 2);
        await vscode.workspace.fs.writeFile(uri, Buffer.from(json, 'utf-8'));
        vscode.window.showInformationMessage(`Highlights exportados para ${uri.fsPath}`);
    });

    // Comando: importar highlights  
    const importCmd = vscode.commands.registerCommand('highlight.importHighlights', async () => {
        const editor = getEditor();
        if (!editor) {
            vscode.window.showWarningMessage('Nenhum editor ativo.');
            return;
        }

        const uris = await vscode.window.showOpenDialog({
            canSelectMany: false,
            filters: { 'JSON': ['json'] },
            title: 'Importar Highlights',
        });
        if (!uris || uris.length === 0) { return; }

        try {
            const raw = await vscode.workspace.fs.readFile(uris[0]);
            const data = JSON.parse(Buffer.from(raw).toString('utf-8'));

            if (!Array.isArray(data)) {
                vscode.window.showErrorMessage('Formato inválido: esperado um array JSON.');
                return;
            }

            // Se já tem highlights, perguntar se quer substituir ou adicionar  
            if (manager.getHighlights().length > 0) {
                const choice = await vscode.window.showQuickPick(
                    ['Substituir todos', 'Adicionar aos existentes'],
                    { placeHolder: 'Já existem highlights. O que deseja fazer?' }
                );
                if (!choice) { return; }
                if (choice === 'Substituir todos') {
                    // Remover todos os existentes  
                    while (manager.getHighlights().length > 0) {
                        manager.removeHighlight(0);
                    }
                    manager.refreshAll(editor);
                }
            }

            for (const entry of data) {
                if (!entry.pattern) { continue; }
                const color = entry.color || '#FFFF00';
                const comment = entry.comment || undefined;
                manager.addHighlight(editor, entry.pattern, color, comment);
            }

            manager.saveState(context);

            if (isLuminolActive) {
                activateLuminol(manager, editor);
            }

            vscode.window.showInformationMessage(`${data.length} highlight(s) importado(s).`);
        } catch (err) {
            vscode.window.showErrorMessage(`Erro ao importar: ${err}`);
        }
    });

    context.subscriptions.push(
        addCmd, removeCmd, editColorCmd, editCommentCmd, goToNextCmd,
        goToNextGlobalCmd, goToPrevGlobalCmd,
        suppressCmd, unsuppressCmd, luminolCmd, luminolOffCmd,
        showCommentsCmd, hideCommentsCmd,
        exportCmd, importCmd,
        onChange, onEditorChange, manager
    );
}

export function deactivate() { }