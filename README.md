# Luminol Highlight

**Luminol Highlight** é uma extensão para Visual Studio Code voltada para **auditoria e análise de logs**. Permite destacar trechos de código via expressões regulares com cores customizáveis, navegar entre ocorrências e documentar cada destaque com justificativas — ideal para revisões técnicas e ensino.

---

## Funcionalidades

### Highlight por Regex

Destaque qualquer trecho de texto usando expressões regulares. Suporta grupos de captura — se o regex contiver um grupo `(...)`, apenas o conteúdo capturado será destacado.

- Ao ter texto selecionado (linha única), o campo de regex é pré-preenchido automaticamente
- Cada highlight recebe cor, negrito e, opcionalmente, uma justificativa

### Seletor Visual de Cores

Ao adicionar ou editar um highlight, um painel WebView exibe uma grade de **64 cores** organizadas por matiz (vermelhos, laranjas, amarelos, verdes, teals, azuis, roxos e rosas), além de um seletor nativo do sistema operacional para cores customizadas.

Cores escuras são detectadas automaticamente — quando o fundo do highlight é escuro, a cor do texto muda para `#BABACA` (cinza claro) para manter a legibilidade.

### Modo Luminol (Forense)

Inspirado no reagente forense, o modo Luminol **escurece todas as linhas que não possuem destaque**, fazendo os highlights "brilharem" no documento. Útil para focar apenas nas linhas relevantes durante análise de logs extensos.

### Comentários e Justificativas

Cada highlight pode conter uma justificativa explicando **por que** aquele padrão foi destacado. Comentários suportam:

- `\n` — quebra de linha (exibido como múltiplas linhas na sidebar)
- `\t` — tabulação (convertido em 4 espaços)

Na sidebar, highlights com comentário são **colapsáveis** — o chevron padrão do VS Code permite expandir/recolher individualmente. A primeira linha do comentário exibe o ícone `$(comment)`.

Os comentários podem ser ocultados/exibidos globalmente pelo botão na barra de título da sidebar.

### Importar e Exportar

Exporte todos os highlights ativos para um arquivo `.json` e importe-os posteriormente. O formato é simples:

```json
[
  {
    "pattern": "ERROR.*",
    "color": "#FF5252",
    "comment": "Indica falha crítica\n\tVerificar causa raiz"
  },
  {
    "pattern": "SUCCESS",
    "color": "#66BB6A"
  }
]
```

Ao importar, se já existirem highlights, a extensão pergunta se deseja **substituir todos** ou **adicionar aos existentes**. O campo obrigatório é apenas `pattern` — `color` assume `#FFFF00` se omitido.

As opções de importar e exportar estão agrupadas no submenu **Nuvem** (`$(cloud)`) na barra de título da sidebar.

### Suprimir e Restaurar

Oculte temporariamente todos os highlights sem removê-los. Se o modo Luminol estiver ativo, ele é desativado automaticamente ao suprimir.

As opções de suprimir/restaurar e Luminol estão agrupadas no submenu **Olho** (`$(eye)`) na barra de título da sidebar.

### Navegação entre Ocorrências

Dois modos de navegação:

| Modo | Ação | Escopo |
|------|------|--------|
| **Global** | Setas ↑↓ na barra de título da sidebar | Todas as ocorrências de **todos** os padrões, ordenadas por posição no documento |
| **Por padrão** | Botão `→` em cada item da sidebar | Apenas as ocorrências do padrão selecionado |

Ambos fazem **wrap-around**: ao chegar na última ocorrência, volta para a primeira (e vice-versa).

### Persistência

Os highlights (padrão, cor e comentário) são salvos automaticamente no `workspaceState` do VS Code. Ao reabrir o workspace, os destaques são restaurados.

---

## Sidebar

A sidebar **Highlight Patterns** é acessível pelo ícone na Activity Bar. A barra de título contém os seguintes controles (da esquerda para a direita):

| Posição | Ícone | Ação |
|---------|-------|------|
| 1 | `+` | Adicionar highlight |
| 2 | `↑` | Highlight anterior (global) |
| 3 | `↓` | Próximo highlight (global) |
| 4 | `☁` | Submenu: Exportar / Importar |
| 5 | `👁` | Submenu: Suprimir / Luminol |
| 6 | `💬` | Exibir / Ocultar comentários |

Cada item da sidebar exibe:

```
🟥 5 — ERROR.*                    [🎨] [💬] [→] [🗑]
   💬 Indica falha crítica
      Verificar causa raiz
```

- **Quadrado colorido** — cor do highlight
- **Contagem** — número de ocorrências no documento ativo
- **Padrão** — regex (truncado em 30 caracteres)
- **Botões inline** — editar cor, editar comentário, ir para próximo match, remover

---

## Atalhos de Teclado

| Atalho | Comando |
|--------|---------|
| `Ctrl+Shift+H` | Adicionar highlight |
| `F10` | Próximo highlight (global) |
| `F9` | Highlight anterior (global) |

Os atalhos F10 e F9 são ativados apenas quando o editor está em foco, sem seleção ativa e sem o Find Widget aberto.

---

## Formato do Arquivo de Exportação

```json
[
  {
    "pattern": "string (regex)",
    "color": "string (hex)",
    "comment": "string (opcional)"
  }
]
```

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `pattern` | `string` | Sim | Expressão regular |
| `color` | `string` | Não | Código HEX (default: `#FFFF00`) |
| `comment` | `string` | Não | Justificativa (suporta `\n` e `\t`) |

---

## Requisitos

- Visual Studio Code **1.110.0** ou superior

---

## Instalação

### Via Marketplace

*(em breve)*

### Via arquivo .vsix

```bash
code --install-extension luminol-highlight-0.0.1.vsix
```

### Para desenvolvimento

```bash
git clone https://github.com/silvan-batistella/luminol-highlight.git
cd luminol-highlight
npm install
npm run compile
```

Pressione `F5` no VS Code para abrir o Extension Development Host.

