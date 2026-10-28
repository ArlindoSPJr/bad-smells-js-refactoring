# Análise Manual de Bad Smells — `src/ReportGenerator.js`

Etapa 2 do trabalho: identificação manual dos Bad Smells no código original, antes de usar ferramentas de análise estática.

## Visão geral

A classe `ReportGenerator` tem um único método, `generateReport(reportType, user, items)`, que faz tudo sozinho:

- monta o cabeçalho;
- filtra os itens de acordo com o perfil do usuário;
- marca os itens prioritários;
- formata cada linha em CSV ou HTML;
- soma o total;
- monta o rodapé.

O comportamento é correto, mas o design é difícil de ler, manter e estender.

---

## 1. Método Longo (Long Method)

**Onde:** `generateReport`, linhas 11–68.

**Descrição:** o método tem cerca de 58 linhas e acumula várias responsabilidades diferentes:

- montar o cabeçalho (16–24);
- aplicar a regra de visibilidade por perfil (28, 43–45);
- marcar a prioridade (30–33);
- formatar as linhas (35–52);
- calcular o total;
- montar o rodapé (58–65).

Os próprios comentários `// --- Seção do Cabeçalho ---`, `// --- Seção do Corpo ---` e `// --- Seção do Rodapé ---` mostram que o método deveria estar dividido em métodos menores. Aqui os comentários servem para "disfarçar" o mau cheiro.

**Por que é problemático:**

- **Manutenção:** para mudar qualquer detalhe é preciso entender o método inteiro.
- **Testes:** não dá para testar isoladamente a regra de filtro, o cálculo do total ou a formatação de uma linha. Só dá para testar a string final completa.

**Refatoração sugerida:** *Extract Method*, criando por exemplo `buildHeader`, `buildRow`, `buildFooter`, `getVisibleItems` e `calculateTotal`.

---

## 2. Condicionais Complexas / Alta Complexidade Cognitiva (Complex Conditional, Deep Nesting)

**Onde:** laço do corpo, linhas 27–55.

**Descrição:** há até 4 níveis de aninhamento, nesta ordem:

```
for (item)
  if (role === 'ADMIN')
    if (value > 1000) ...
    if (reportType === 'CSV') ... else if (reportType === 'HTML') ...
  else if (role === 'USER')
    if (value <= 500)
      if (reportType === 'CSV') ... else if (reportType === 'HTML') ...
```

Cada novo perfil ou formato multiplica os caminhos possíveis. A complexidade cognitiva fica bem acima do limite de 15 que o enunciado definiu para o SonarJS.

**Por que é problemático:**

- **Manutenção:** o código é difícil de ler, e é fácil esquecer um ramo ao fazer uma alteração.
- **Testes:** o número de combinações (perfil × formato × faixa de valor) que precisam de teste cresce rápido.

**Refatoração sugerida:**

- *Decompose Conditional*;
- *Replace Nested Conditional with Guard Clauses*;
- extrair a regra de visibilidade para uma função própria, como `canView(user, item)`.

---

## 3. Código Duplicado (Duplicated Code)

**Onde:**

- Linha CSV idêntica para os dois perfis: linhas 36 e 47.
- Linha HTML quase idêntica: linhas 40 e 50. A única diferença é o estilo de prioridade.
- `total += item.value` repetido 4 vezes: linhas 37, 41, 48 e 51.
- O bloco `if (reportType === 'CSV') ... else if (reportType === 'HTML')` aparece duplicado dentro de cada perfil.

**Por que é problemático:**

- **Manutenção:** uma mudança no formato da linha, como adicionar uma coluna, precisa ser feita em dois lugares. Se um deles for esquecido, os formatos ficam inconsistentes.
- **Testes:** cada cópia precisa ser coberta separadamente.

**Refatoração sugerida:** *Extract Method* para a formatação da linha e o cálculo do total. A soma pode ser feita uma única vez sobre os itens já filtrados, por exemplo com `reduce`.

---

## 4. Switch Statements / Condicional por Tipo Repetida

**Onde:** `reportType` é testado em 4 pontos diferentes:

- cabeçalho: 16–24;
- corpo do perfil ADMIN: 35–42;
- corpo do perfil USER: 46–52;
- rodapé: 58–65.

**Descrição:** cada formato (CSV, HTML) tem a lógica espalhada pelo método inteiro. Adicionar um novo formato, como JSON ou PDF, obriga a mexer em todos esses pontos. Isso também é um caso de *Shotgun Surgery* dentro do método.

**Refatoração sugerida:** *Replace Conditional with Polymorphism*. A ideia é criar uma estratégia/formatador por tipo, como `CsvFormatter` e `HtmlFormatter`, cada um com `header()`, `row()` e `footer()`.

---

## 5. Números e Strings Mágicos (Magic Numbers / Magic Strings)

**Onde:**

- `1000` (linha 30): limite de prioridade.
- `500` (linha 45): limite de visibilidade para USER.
- `'ADMIN'`, `'USER'`, `'CSV'` e `'HTML'`, espalhados pelo método.

**Por que é problemático:** o significado de negócio dos valores não aparece no código. Mudar uma regra exige procurar todas as ocorrências, e um erro de digitação em uma string passa despercebido.

**Refatoração sugerida:** *Replace Magic Number with Symbolic Constant*. Por exemplo: `PRIORITY_THRESHOLD = 1000`, `USER_MAX_VALUE = 500`, e objetos `Roles` e `ReportTypes`.

---

## 6. Efeito Colateral / Mutação dos Dados de Entrada

**Onde:** linha 32, `item.priority = true`.

**Descrição:** o método altera os objetos recebidos em `items`. Quem chama a função tem seus dados modificados sem saber. Os testes precisam usar `JSON.parse(JSON.stringify(testItems))` justamente para se proteger disso.

**Por que é problemático:** gera bugs difíceis de rastrear. Por exemplo, um mesmo array usado em um segundo relatório já chega "contaminado". Isso também quebra a independência entre testes.

**Refatoração sugerida:** calcular a prioridade sem mutar o item, com uma função pura como `isPriority(item)`.

---

## 7. Campo/Parâmetro Não Utilizado (Speculative Generality / Dead Code)

**Onde:** construtor, linhas 2–4. `this.db` é recebido e armazenado, mas nunca usado.

**Por que é problemático:** a dependência é falsa. Ela confunde o leitor e obriga os testes a criar um `mockDb` sem utilidade.

**Refatoração sugerida:** *Remove Dead Code*. Como os testes passam `mockDb` ao construtor, dá para manter a assinatura e apenas não depender do campo. Também vale avaliar se o campo pode ser removido.

---

## 8. Outros pontos observados

- **Primitive Obsession:** perfil e formato são representados por strings soltas, sem nenhuma validação.
- **Falha silenciosa:** um `reportType` desconhecido gera um relatório vazio, e um `role` desconhecido ignora todos os itens. Nenhum erro é sinalizado.
- **Mistura de responsabilidades:** a regra de negócio (quem vê o quê, o que é prioritário) está misturada com a apresentação (CSV/HTML). Isso também fere o princípio da responsabilidade única.
- **Bug de formatação (já corrigido):** antes era gerado `<tr >`, com espaço sobrando, quando o item não era prioritário. Isso fazia o teste de HTML do Admin falhar.

---

## Resumo — 3 smells escolhidos para o relatório

| # | Smell | Local | Técnica de refatoração |
|---|-------|-------|------------------------|
| 1 | Método Longo | `generateReport` (11–68) | Extract Method |
| 2 | Condicionais complexas / alta complexidade cognitiva | laço 27–55 | Decompose Conditional, Replace Conditional with Polymorphism |
| 3 | Código Duplicado | linhas 36/47, 40/50, `total +=` ×4 | Extract Method |

---

# Etapa 4 — Detecção Automática e Comparação

## Resultado do `npx eslint src/` (configuração do enunciado)

```
src/ReportGenerator.js
  11:3   error  Refactor this function to reduce its Cognitive Complexity from 27 to the 15 allowed  sonarjs/cognitive-complexity
  43:14  error  Merge this if statement with the nested one                                          sonarjs/no-collapsible-if

✖ 2 problems (2 errors, 0 warnings)
```

## Execução complementar (regras nativas do ESLint, só via CLI)

O arquivo `.eslintrc.json` não foi alterado. As regras abaixo foram ligadas apenas na linha de comando:

```
npx eslint src/ --rule "no-magic-numbers: [warn, {ignore: [0]}]" --rule "complexity: [warn, 10]" --rule "max-lines-per-function: [warn, 30]" --rule "max-statements: [warn, 15]"
```

```
  11:3   warning  Method 'generateReport' has too many lines (58). Maximum allowed is 30               max-lines-per-function
  11:3   error    Refactor this function to reduce its Cognitive Complexity from 27 to the 15 allowed  sonarjs/cognitive-complexity
  11:17  warning  Method 'generateReport' has too many statements (32). Maximum allowed is 15          max-statements
  11:17  warning  Method 'generateReport' has a complexity of 15. Maximum allowed is 10                complexity
  30:26  warning  No magic number: 1000                                                                no-magic-numbers
  43:14  error    Merge this if statement with the nested one                                          sonarjs/no-collapsible-if
  45:27  warning  No magic number: 500                                                                 no-magic-numbers

✖ 7 problems (2 errors, 5 warnings)
```

## Comparação: análise manual × ferramenta

| # | Smell (análise manual) | SonarJS (config. do enunciado) | ESLint extra (CLI) | Observação |
|---|---|---|---|---|
| 1 | Método Longo | ⚠️ Indireto (`cognitive-complexity` na linha 11) | ✅ `max-lines-per-function` (58), `max-statements` (32) | O SonarJS não mede o tamanho, mas a complexidade alta aponta o mesmo método |
| 2 | Condicionais complexas / aninhamento | ✅ `cognitive-complexity` **27/15**, `no-collapsible-if` (linha 43) | ✅ `complexity` 15/10 | Detectado e **quantificado**. A ferramenta dá um número objetivo que a análise manual não dá |
| 3 | Código Duplicado | ❌ Não detectado | ❌ Não detectado | `no-duplicated-branches` e `no-identical-functions` só pegam blocos **idênticos**. As linhas CSV/HTML são *template literals* quase iguais, e só há uma função |
| 4 | Condicional por tipo repetida (Switch Statements) | ❌ Não detectado | ❌ Não detectado | É um problema de **design**. A ferramenta não percebe que `reportType` é testado em 4 pontos |
| 5 | Números/Strings mágicos | ❌ Não detectado | ✅ `no-magic-numbers` (1000, 500) | As strings mágicas (`'ADMIN'`, `'CSV'`...) não foram detectadas: são curtas demais para o `no-duplicate-string` (mínimo de 10 caracteres) |
| 6 | Mutação da entrada (`item.priority = true`) | ❌ Não detectado | ❌ Não detectado | Exige entender a **semântica**: o objeto pertence a quem chama a função |
| 7 | Campo não usado (`this.db`) | ❌ Não detectado | ❌ Não detectado | `no-unused-vars` não verifica propriedades de classe |
| — | `if` colapsável (linha 43) | ✅ `no-collapsible-if` | ✅ | **Encontrado só pela ferramenta.** Não estava na análise manual |

## Conclusões da comparação

- **A ferramenta encontrou o que a análise manual não encontrou:**
  - a medida objetiva da complexidade cognitiva (27, quase o dobro do limite de 15);
  - o `if` colapsável na linha 43, que passou despercebido na leitura.

  A métrica também transforma a impressão de que "o método está complexo" em um critério verificável, que vai servir para provar a melhoria na Etapa 6.
- **A análise manual encontrou o que a ferramenta não encontrou:**
  - duplicação "quase idêntica";
  - condicional por tipo repetida (pede polimorfismo);
  - mutação dos dados de entrada;
  - dependência não usada.

  São problemas de **design e semântica**, que dependem de entender a intenção do código e não só a sua forma.
- **Resumo:** das 7 categorias manuais, o SonarJS na configuração do enunciado cobriu diretamente **1** (condicionais complexas) e indiretamente **1** (método longo). Com as regras nativas extras, a cobertura sobe para **3** (método longo, condicionais complexas e números mágicos). Em compensação, a ferramenta revelou **1** problema novo (`no-collapsible-if`).
- **As duas abordagens se complementam:** a ferramenta é rápida, objetiva e repetível, ideal para medir antes e depois. A análise humana continua necessária para os smells de design.
