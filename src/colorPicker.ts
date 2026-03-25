import * as vscode from 'vscode';  
  
const PRESET_COLORS = [  
    // Vermelhos / Corais — tons quentes, bom contraste com texto claro  
    '#FF8A80', '#FF6B6B', '#FF5252', '#EF5350', '#F44336', '#E57373', '#FF7043', '#FF5722',  
  
    // Laranjas / Âmbar — alta visibilidade, confortáveis para leitura prolongada  
    '#FFAB91', '#FF9E80', '#FFA726', '#FF9800', '#FB8C00', '#FFB74D', '#FFCC80', '#FFE0B2',  
  
    // Amarelos / Dourados — clássicos de marcador, excelente para destaque  
    '#FFF176', '#FFEE58', '#FFEB3B', '#FDD835', '#FFCA28', '#FFC107', '#FFD54F', '#FFE57F',  
  
    // Verdes Lima — vibrantes, boa distinção dos amarelos  
    '#E6EE9C', '#DCE775', '#D4E157', '#CDDC39', '#C0CA33', '#AED581', '#9CCC65', '#8BC34A',  
  
    // Verdes — tons médios, confortáveis e naturais  
    '#A5D6A7', '#81C784', '#66BB6A', '#4CAF50', '#69F0AE', '#00E676', '#00C853', '#76FF03',  
  
    // Teals / Cyans — tons frios, excelente contraste com tons quentes  
    '#80CBC4', '#4DB6AC', '#26A69A', '#009688', '#64FFDA', '#1DE9B6', '#00BCD4', '#00ACC1',  
  
    // Azuis — universais, funcionam bem em qualquer tema  
    '#90CAF9', '#64B5F6', '#42A5F5', '#2196F3', '#448AFF', '#2979FF', '#82B1FF', '#40C4FF',  
  
    // Roxos / Violetas / Rosas — boa distinção dos azuis e vermelhos  
    '#CE93D8', '#BA68C8', '#AB47BC', '#EA80FC', '#F48FB1', '#F06292', '#EC407A', '#FF80AB',  
];  
  
function getWebviewHtml(currentColor?: string): string {  
    const swatches = PRESET_COLORS.map(c => {  
        const isLight = ['#FFE0B2', '#FFF176', '#FFE57F', '#E6EE9C'].includes(c);  
        const border = isLight ? 'border:1px solid #666;' : '';  
        const selected = c.toUpperCase() === currentColor?.toUpperCase()  
            ? 'outline:2px solid #fff;outline-offset:2px;'  
            : '';  
        return `<div class="swatch" onclick="pick('${c}')" style="background:${c};${border}${selected}" title="${c}"></div>`;  
    }).join('');  
  
    return `<!DOCTYPE html>  
<html>  
<head>  
<style>  
    body {  
        padding: 16px;  
        font-family: var(--vscode-font-family);  
        color: var(--vscode-foreground);  
        background: var(--vscode-editor-background);  
        display: flex;  
        flex-direction: column;  
        align-items: center;  
    }  
    h3 { margin: 0 0 8px 0; font-weight: 500; }  
    .grid {  
        display: grid;  
        grid-template-columns: repeat(8, 32px);  
        gap: 5px;  
        margin-bottom: 16px;  
    }  
    .swatch {  
        width: 32px;  
        height: 32px;  
        border-radius: 5px;  
        cursor: pointer;  
        transition: transform 0.1s;  
    }  
    .swatch:hover {  
        transform: scale(1.2);  
        z-index: 1;  
    }  
    .custom-row {  
        display: flex;  
        align-items: center;  
        gap: 10px;  
    }  
    .custom-row input[type="color"] {  
        width: 40px;  
        height: 32px;  
        border: none;  
        cursor: pointer;  
        background: none;  
    }  
    .preview {  
        width: 32px;  
        height: 32px;  
        border-radius: 5px;  
        border: 1px solid #555;  
    }  
    button {  
        padding: 6px 16px;  
        background: var(--vscode-button-background);  
        color: var(--vscode-button-foreground);  
        border: none;  
        border-radius: 4px;  
        cursor: pointer;  
        font-size: 13px;  
    }  
    button:hover {  
        background: var(--vscode-button-hoverBackground);  
    }  
    .label {  
        font-size: 11px;  
        color: var(--vscode-descriptionForeground);  
        margin-bottom: 6px;  
    }  
    .hint {  
        font-size: 10px;  
        color: var(--vscode-descriptionForeground);  
        margin-top: 12px;  
        opacity: 0.7;  
    }  
</style>  
</head>  
<body>  
    <h3>Escolha uma cor</h3>  
    <div class="label">Clique para selecionar — a cor será aplicada com transparência</div>  
    <div class="grid">${swatches}</div>  
    <div class="label">Ou escolha uma cor customizada</div>  
    <div class="custom-row">  
        <input type="color" id="customColor" value="${currentColor || '#FF9800'}" />  
        <div class="preview" id="preview" style="background:${currentColor || '#FF9800'}"></div>  
        <button onclick="pick(document.getElementById('customColor').value)">Usar esta cor</button>  
    </div>  
    <div class="hint">Dica: cores mais claras funcionam melhor como destaque de texto</div>  
    <script>  
        const vscode = acquireVsCodeApi();  
        function pick(color) {  
            vscode.postMessage({ type: 'colorPicked', color });  
        }  
        document.getElementById('customColor').addEventListener('input', (e) => {  
            document.getElementById('preview').style.background = e.target.value;  
        });  
    </script>  
</body>  
</html>`;  
}  
  
export async function pickColor(currentColor?: string): Promise<string | undefined> {  
    return new Promise((resolve) => {  
        const panel = vscode.window.createWebviewPanel(  
            'luminolColorPicker',  
            'Escolha uma cor',  
            { viewColumn: vscode.ViewColumn.Active, preserveFocus: false },  
            { enableScripts: true, retainContextWhenHidden: false }  
        );  
  
        panel.webview.html = getWebviewHtml(currentColor);  
  
        let resolved = false;  
  
        panel.webview.onDidReceiveMessage((msg) => {  
            if (msg.type === 'colorPicked' && msg.color) {  
                resolved = true;  
                resolve(msg.color);  
                panel.dispose();  
            }  
        });  
  
        panel.onDidDispose(() => {  
            if (!resolved) {  
                resolve(undefined);  
            }  
        });  
    });  
}