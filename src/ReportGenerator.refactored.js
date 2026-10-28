const PRIORITY_THRESHOLD = 1000;
const USER_MAX_VISIBLE_VALUE = 500;

const Roles = Object.freeze({
  ADMIN: 'ADMIN',
  USER: 'USER',
});

/**
 * Regras de visibilidade por perfil.
 * - Admins veem tudo.
 * - Users comuns só veem itens com valor <= 500.
 * Perfis desconhecidos não veem nenhum item.
 */
const visibilityRules = {
  [Roles.ADMIN]: () => true,
  [Roles.USER]: (item) => item.value <= USER_MAX_VISIBLE_VALUE,
};

function canView(user, item) {
  const rule = visibilityRules[user.role];
  return rule ? rule(item) : false;
}

function isPriority(user, item) {
  return user.role === Roles.ADMIN && item.value > PRIORITY_THRESHOLD;
}

function calculateTotal(items) {
  return items.reduce((sum, item) => sum + item.value, 0);
}

class CsvFormatter {
  header() {
    return 'ID,NOME,VALOR,USUARIO\n';
  }

  row(item, user) {
    return `${item.id},${item.name},${item.value},${user.name}\n`;
  }

  footer(total) {
    return `\nTotal,,\n${total},,\n`;
  }
}

class HtmlFormatter {
  header(user) {
    return (
      '<html><body>\n' +
      '<h1>Relatório</h1>\n' +
      `<h2>Usuário: ${user.name}</h2>\n` +
      '<table>\n' +
      '<tr><th>ID</th><th>Nome</th><th>Valor</th></tr>\n'
    );
  }

  row(item, user) {
    const style = isPriority(user, item) ? ' style="font-weight:bold;"' : '';
    return `<tr${style}><td>${item.id}</td><td>${item.name}</td><td>${item.value}</td></tr>\n`;
  }

  footer(total) {
    return `</table>\n<h3>Total: ${total}</h3>\n</body></html>\n`;
  }
}

const formatters = {
  CSV: new CsvFormatter(),
  HTML: new HtmlFormatter(),
};

export class ReportGenerator {
  /**
   * Gera um relatório de itens baseado no tipo e no usuário.
   * Tipos de relatório desconhecidos geram um relatório vazio.
   */
  generateReport(reportType, user, items) {
    const formatter = formatters[reportType];
    if (!formatter) {
      return '';
    }

    const visibleItems = items.filter((item) => canView(user, item));
    const body = visibleItems.map((item) => formatter.row(item, user)).join('');
    const total = calculateTotal(visibleItems);

    return (formatter.header(user) + body + formatter.footer(total)).trim();
  }
}
