// ==================== VARIÁVEIS GLOBAIS ====================
const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

let secaoAtual = 'dashboard';
let editandoClienteId = null;
let editandoOrcamentoId = null;
let celulaEditando = null;
let modoEdicaoTodos = false;
let notificationsTimeout = {};
let notificacoesList = []; // histórico de notificações
let notificacoesExibidas = {}; // rastreamento de notificações para cooldown

let clientes = JSON.parse(localStorage.getItem('clientes') || '[]');
let fornecedores = JSON.parse(localStorage.getItem('fornecedores') || '[]');
let orcamentos = JSON.parse(localStorage.getItem('orcamentos') || '[]');
let estoque = JSON.parse(localStorage.getItem('estoque') || '[]');
let receber = JSON.parse(localStorage.getItem('receber') || '[]');
let pagar = JSON.parse(localStorage.getItem('pagar') || '[]');
let patrimonio = JSON.parse(localStorage.getItem('patrimonio') || '[]');
let contratos = JSON.parse(localStorage.getItem('contratos') || '[]');
// Agenda / Eventos
let agenda = JSON.parse(localStorage.getItem('agenda') || '[]');
// Configurações
let configuracoes = JSON.parse(localStorage.getItem('configuracoes') || '{}');

// ==================== SISTEMA DE NOTIFICAÇÕES ====================
function mostrarNotificacao(mensagem, tipo = 'info', duracao = 3000) {
  const container = document.getElementById('notificationsContainer');
  if (!container) return;

  // Criar chave única para a notificação
  const chaveNotif = tipo + '::' + mensagem;
  const agora = Date.now();
  const COOLDOWN_30MIN = 30 * 60 * 1000; // 30 minutos em milissegundos

  // Verificar se a notificação foi exibida recentemente
  if (notificacoesExibidas[chaveNotif]) {
    const ultimaExibicao = notificacoesExibidas[chaveNotif];
    if (agora - ultimaExibicao < COOLDOWN_30MIN) {
      // Notificação foi exibida há menos de 30 minutos, ignorar
      console.log('Notificação ignorada (cooldown ativo):', chaveNotif);
      return;
    }
  }

  // Registrar que esta notificação foi exibida agora
  notificacoesExibidas[chaveNotif] = agora;

  const id = 'notif_' + Date.now();
  const iconMap = {
    'sucesso': 'bi-check-circle-fill',
    'erro': 'bi-exclamation-circle-fill',
    'aviso': 'bi-exclamation-triangle-fill',
    'info': 'bi-info-circle-fill'
  };
  const bgMap = {
    'sucesso': 'bg-success',
    'erro': 'bg-danger',
    'aviso': 'bg-warning',
    'info': 'bg-info'
  };

  const notifEl = document.createElement('div');
  notifEl.id = id;
  notifEl.className = `notification notification-${tipo} ${bgMap[tipo] || bgMap['info']}`;
  notifEl.innerHTML = `
    <div class="notification-content">
      <i class="bi ${iconMap[tipo] || iconMap['info']}"></i>
      <span>${mensagem}</span>
    </div>
    <button class="notification-close" onclick="fecharNotificacao('${id}')">
      <i class="bi bi-x"></i>
    </button>
  `;

  container.appendChild(notifEl);

  // Adicionar ao histórico
  adicionarAoHistorico(mensagem, tipo);

  // Auto-remover após duracao
  if (notificationsTimeout[id]) clearTimeout(notificationsTimeout[id]);
  notificationsTimeout[id] = setTimeout(() => {
    fecharNotificacao(id);
  }, duracao);
}

function fecharNotificacao(id) {
  const notif = document.getElementById(id);
  if (notif) {
    notif.classList.add('hide');
    setTimeout(() => {
      notif.remove();
      delete notificationsTimeout[id];
    }, 300);
  }
}

function adicionarAoHistorico(mensagem, tipo) {
  const agora = new Date().toLocaleTimeString('pt-BR', { 
    hour: '2-digit', 
    minute: '2-digit',
    second: '2-digit'
  });
  
  notificacoesList.unshift({
    mensagem,
    tipo,
    hora: agora,
    id: 'hist_' + Date.now()
  });

  // Limitar a 20 notificações no histórico
  if (notificacoesList.length > 20) notificacoesList.pop();

  atualizarDropdownNotificacoes();
}

function atualizarDropdownNotificacoes() {
  const listaEl = document.getElementById('notificacoesLista');
  const badgeEl = document.getElementById('notificacoesBadge');
  const btnLimpar = document.getElementById('btnLimparNotif');

  if (notificacoesList.length === 0) {
    listaEl.innerHTML = '<span class="dropdown-item text-muted">Nenhuma notificação</span>';
    badgeEl.style.display = 'none';
    if (btnLimpar) btnLimpar.style.display = 'none';
    return;
  }

  const iconMap = {
    'sucesso': 'bi-check-circle-fill text-success',
    'erro': 'bi-exclamation-circle-fill text-danger',
    'aviso': 'bi-exclamation-triangle-fill text-warning',
    'info': 'bi-info-circle-fill text-info'
  };

  listaEl.innerHTML = notificacoesList.map(notif => `
    <button class="dropdown-item" onclick="fecharNotificacaoHistorico('${notif.id}')">
      <i class="bi ${iconMap[notif.tipo] || iconMap['info']} me-2"></i>
      <div>
        <div class="small">${notif.mensagem}</div>
        <small class="text-muted">${notif.hora}</small>
      </div>
      <i class="bi bi-x ms-auto text-muted small"></i>
    </button>
  `).join('');

  badgeEl.textContent = notificacoesList.length;
  badgeEl.style.display = notificacoesList.length > 0 ? 'inline-block' : 'none';
  if (btnLimpar) btnLimpar.style.display = notificacoesList.length > 0 ? 'block' : 'none';
}

function fecharNotificacaoHistorico(id) {
  notificacoesList = notificacoesList.filter(n => n.id !== id);
  atualizarDropdownNotificacoes();
}

function limparNotificacoes() {
  notificacoesList = [];
  atualizarDropdownNotificacoes();
}

function carregarConfiguracoes() {
  configuracoes = JSON.parse(localStorage.getItem('configuracoes') || '{}');
  // defaults
  const defaults = {
    nomeSistema: 'MarcenariaPro',
    tema: 'auto',
    moeda: 'BRL',
    periodicidadeDefault: 0,
    confirmDelete: false,
    autoCreateFinancial: false
  };
  configuracoes = Object.assign(defaults, configuracoes || {});

  // aplicar ao DOM
  document.getElementById('cfgNomeSistema') && (document.getElementById('cfgNomeSistema').value = configuracoes.nomeSistema);
  document.getElementById('cfgTema') && (document.getElementById('cfgTema').value = configuracoes.tema);
  document.getElementById('cfgMoeda') && (document.getElementById('cfgMoeda').value = configuracoes.moeda);
  document.getElementById('cfgPeriodicidadeDefault') && (document.getElementById('cfgPeriodicidadeDefault').value = configuracoes.periodicidadeDefault);
  document.getElementById('cfgConfirmDelete') && (document.getElementById('cfgConfirmDelete').checked = !!configuracoes.confirmDelete);
  document.getElementById('cfgAutoCreateFinancial') && (document.getElementById('cfgAutoCreateFinancial').checked = !!configuracoes.autoCreateFinancial);

  // aplicar nome do sistema na navbar
  const elNome = document.getElementById('nomeSistema');
  if (elNome) elNome.textContent = configuracoes.nomeSistema;
  
  // aplicar tema
  aplicarTema(configuracoes.tema);
}

function aplicarTema(temaSelecionado) {
  const html = document.documentElement;
  const isDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
  let temaFinal = temaSelecionado;
  
  if (temaSelecionado === 'auto') {
    temaFinal = isDarkMode ? 'dark' : 'light';
  }
  
  if (temaFinal === 'dark') {
    document.body.classList.add('dark-theme');
    html.setAttribute('data-bs-theme', 'dark');
  } else {
    document.body.classList.remove('dark-theme');
    html.removeAttribute('data-bs-theme');
  }
}

function salvarConfiguracoes() {
  configuracoes.nomeSistema = document.getElementById('cfgNomeSistema')?.value.trim() || 'MarcenariaPro';
  configuracoes.tema = document.getElementById('cfgTema')?.value || 'auto';
  configuracoes.moeda = document.getElementById('cfgMoeda')?.value || 'BRL';
  configuracoes.periodicidadeDefault = parseInt(document.getElementById('cfgPeriodicidadeDefault')?.value) || 0;
  configuracoes.confirmDelete = !!document.getElementById('cfgConfirmDelete')?.checked;
  configuracoes.autoCreateFinancial = !!document.getElementById('cfgAutoCreateFinancial')?.checked;
  localStorage.setItem('configuracoes', JSON.stringify(configuracoes));
  carregarConfiguracoes();
  aplicarTema(configuracoes.tema);
  mostrarNotificacao('Configurações salvas com sucesso.', 'sucesso');
}

function exportarBackup() {
  const dados = {
    clientes, fornecedores, orcamentos, estoque, receber, pagar, patrimonio, contratos, agenda, configuracoes, dataExport: new Date().toISOString()
  };
  const blob = new Blob([JSON.stringify(dados, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `backup-marcenaria-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}

function importarBackup(file) {
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const dados = JSON.parse(e.target.result);
      if (dados.clientes) clientes = dados.clientes;
      if (dados.fornecedores) fornecedores = dados.fornecedores;
      if (dados.orcamentos) orcamentos = dados.orcamentos;
      if (dados.estoque) estoque = dados.estoque;
      if (dados.receber) receber = dados.receber;
      if (dados.pagar) pagar = dados.pagar;
      if (dados.patrimonio) patrimonio = dados.patrimonio;
      if (dados.contratos) contratos = dados.contratos;
      if (dados.agenda) agenda = dados.agenda;
      if (dados.configuracoes) configuracoes = dados.configuracoes;
      salvarDados(); salvarAgenda(); localStorage.setItem('configuracoes', JSON.stringify(configuracoes));
      carregarConfiguracoes();
      reloadSecao(secaoAtual || 'dashboard');
      Swal.fire('Importado', 'Backup importado com sucesso.', 'success');
    } catch (err) {
      Swal.fire('Erro', 'Arquivo inválido.', 'error');
    }
  };
  reader.readAsText(file);
}

function limparLixeira() {
  lixeira = [];
  salvarLixeira();
  atualizarBotaoRefazer();
  Swal.fire('Pronto', 'Lixeira limpa.', 'success');
}

function limparTodosDados() {
  Swal.fire({
    title: 'Limpar todos os dados?',
    text: 'Esta ação apagará todos os registros e não pode ser desfeita.',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'Sim, limpar',
    cancelButtonText: 'Cancelar'
  }).then(result => {
    if (result.isConfirmed) {
      localStorage.clear();
      location.reload();
    }
  });
}
let calendar = null;

function salvarAgenda() {
  localStorage.setItem('agenda', JSON.stringify(agenda));
}

function gerarIdAgenda() {
  return 'ev_' + gerarId();
}

function adicionarEventoAgenda() {
  // prepara modal: preencher vínculos
  preencherSelectVinculosAgenda();
  document.getElementById('formNovoEventoAgenda').reset();
  document.getElementById('eventoData').value = new Date().toISOString().split('T')[0];
  new bootstrap.Modal(document.getElementById('modalNovoEventoAgenda')).show();
}

function preencherSelectVinculosAgenda() {
  const sel = document.getElementById('eventoVinculo');
  if (!sel) return;
  sel.innerHTML = '<option value="">Nenhum</option>';
  // opções financeiras (receber)
  if (receber && receber.length) {
    const optGroup = document.createElement('optgroup');
    optGroup.label = 'Contas a Receber';
    receber.forEach(r => {
      const o = document.createElement('option');
      o.value = `rec:${r.id}`;
      o.textContent = `Receber: ${r.descricao || r.cliente || r.id} — ${formatarMoeda(r.valor)}`;
      optGroup.appendChild(o);
    });
    sel.appendChild(optGroup);
  }
  if (pagar && pagar.length) {
    const optGroup = document.createElement('optgroup');
    optGroup.label = 'Contas a Pagar';
    pagar.forEach(p => {
      const o = document.createElement('option');
      o.value = `pag:${p.id}`;
      o.textContent = `Pagar: ${p.descricao || p.fornecedorNome || p.id} — ${formatarMoeda(p.valor)}`;
      optGroup.appendChild(o);
    });
    sel.appendChild(optGroup);
  }
  // patrimônio
  if (patrimonio && patrimonio.length) {
    const optGroup = document.createElement('optgroup');
    optGroup.label = 'Patrimônio';
    patrimonio.forEach(pt => {
      const o = document.createElement('option');
      o.value = `pat:${pt.id}`;
      o.textContent = `Patrimônio: ${pt.nome || pt.codigo || pt.id}`;
      optGroup.appendChild(o);
    });
    sel.appendChild(optGroup);
  }
}

document.getElementById('btnSalvarEventoAgenda')?.addEventListener('click', () => {
  const data = document.getElementById('eventoData')?.value;
  const tipo = document.getElementById('eventoTipo')?.value;
  const descricao = document.getElementById('eventoDescricao')?.value.trim();
  const valorRaw = document.getElementById('eventoValor')?.value || '';
  const valor = valorRaw.replace(/[^0-9,\.]/g, '').replace(',', '.') || '';
  const vinculo = document.getElementById('eventoVinculo')?.value || '';
  const periodicidade = parseInt(document.getElementById('eventoPeriodicidade')?.value) || 0;
  const eventoId = document.getElementById('eventoId')?.value || '';

  if (eventoId) {
    // editar evento existente
    const ev = agenda.find(a => a.id === eventoId);
    if (ev) {
      ev.data = data || ev.data;
      ev.tipo = tipo;
      ev.descricao = descricao;
      ev.valor = valor ? parseFloat(valor) : null;
      ev.vinculo = vinculo;
      ev.periodicidade = periodicidade || 0;
      salvarAgenda();
      // atualizar no calendário
      try {
        const calEv = calendar.getEventById(ev.id);
        if (calEv) {
          calEv.setProp('title', ev.descricao || ev.tipo);
          calEv.setStart(ev.data);
        }
      } catch (e) {}
      carregarAgenda();
      try { bootstrap.Modal.getInstance(document.getElementById('modalNovoEventoAgenda'))?.hide(); } catch(e){}
      Swal.fire('Atualizado!', 'Evento atualizado com sucesso.', 'success');
      return;
    }
  }

  const evento = {
    id: gerarIdAgenda(),
    data: data || new Date().toISOString().split('T')[0],
    tipo,
    descricao,
    valor: valor ? parseFloat(valor) : null,
    vinculo,
    periodicidade: periodicidade || 0,
    criadoEm: new Date().toISOString(),
    concluido: false,
    lastDone: null
  };

  agenda.push(evento);
  salvarAgenda();
  carregarAgenda();
  // se configurado, criar automaticamente entrada financeira
  if (configuracoes && configuracoes.autoCreateFinancial) {
    if (evento.tipo === 'receber') {
      const rec = { id: gerarId(), descricao: evento.descricao || 'Entrada agenda', valor: evento.valor || 0, data: evento.data };
      receber.push(rec);
      salvarDados();
      // vincula
      const ev = agenda.find(a => a.id === evento.id);
      if (ev) ev.vinculo = `rec:${rec.id}`;
      salvarAgenda();
    }
    if (evento.tipo === 'pagar') {
      const pag = { id: gerarId(), descricao: evento.descricao || 'Saída agenda', valor: evento.valor || 0, data: evento.data };
      pagar.push(pag);
      salvarDados();
      const ev = agenda.find(a => a.id === evento.id);
      if (ev) ev.vinculo = `pag:${pag.id}`;
      salvarAgenda();
    }
  }
  try { bootstrap.Modal.getInstance(document.getElementById('modalNovoEventoAgenda'))?.hide(); } catch(e){}
  Swal.fire('Salvo!', 'Evento adicionado à agenda.', 'success');
});

function initCalendar() {
  if (calendar) return;
  const el = document.getElementById('calendarAgenda');
  if (!el || typeof FullCalendar === 'undefined') return;
  calendar = new FullCalendar.Calendar(el, {
    initialView: 'dayGridMonth',
    headerToolbar: { left: 'prev,next today', center: 'title', right: 'dayGridMonth,listMonth' },
    height: 600,
    dateClick: function(info) {
      preencherSelectVinculosAgenda();
      document.getElementById('eventoId').value = '';
      document.getElementById('eventoData').value = info.dateStr;
      document.getElementById('eventoTipo').value = 'servico';
      document.getElementById('eventoDescricao').value = '';
      document.getElementById('eventoValor').value = '';
      document.getElementById('eventoPeriodicidade').value = '';
      new bootstrap.Modal(document.getElementById('modalNovoEventoAgenda')).show();
    },
    eventClick: function(info) {
      const evId = info.event.id;
      const ev = agenda.find(a => a.id === evId);
      if (!ev) return;
      preencherSelectVinculosAgenda();
      document.getElementById('eventoId').value = ev.id;
      document.getElementById('eventoData').value = ev.data;
      document.getElementById('eventoTipo').value = ev.tipo || 'servico';
      document.getElementById('eventoDescricao').value = ev.descricao || '';
      document.getElementById('eventoValor').value = ev.valor ? ev.valor : '';
      document.getElementById('eventoVinculo').value = ev.vinculo || '';
      document.getElementById('eventoPeriodicidade').value = ev.periodicidade || '';
      new bootstrap.Modal(document.getElementById('modalNovoEventoAgenda')).show();
    }
  });
  calendar.render();
}

function carregarAgenda() {
  initCalendar();
  if (!calendar) return;
  // clear existing events
  calendar.getEvents().forEach(e => e.remove());
  const filtro = document.getElementById('filtroAgendaData')?.value;
  let items = agenda.slice().sort((a,b) => new Date(a.data) - new Date(b.data));
  if (filtro) items = items.filter(i => i.data === filtro);

  items.forEach(ev => {
    let color = '#3788d8';
    if (ev.tipo === 'manutencao') color = '#f39c12';
    if (ev.tipo === 'receber') color = '#28a745';
    if (ev.tipo === 'pagar') color = '#dc3545';
    calendar.addEvent({
      id: ev.id,
      title: ev.descricao || ev.tipo,
      start: ev.data,
      allDay: true,
      backgroundColor: color
    });
  });
}

function removerEventoAgenda(id) {
  agenda = agenda.filter(a => a.id !== id);
  salvarAgenda();
  carregarAgenda();
  Swal.fire('Removido', 'Evento removido da agenda.', 'success');
}

function marcarFeitoEvento(id) {
  const ev = agenda.find(a => a.id === id);
  if (!ev) return;
  ev.concluido = true;
  ev.lastDone = new Date().toISOString();
  // se periódico, calcula próxima data
  if (ev.periodicidade && ev.periodicidade > 0) {
    const next = new Date(ev.data);
    next.setDate(next.getDate() + ev.periodicidade);
    ev.data = next.toISOString().split('T')[0];
    ev.concluido = false; // reativar para próxima ocorrência
  }
  salvarAgenda();
  carregarAgenda();
  Swal.fire('Concluído', 'Evento marcado como concluído.', 'success');
}
// Lixeira para armazenar últimas exclusões (permite 'refazer')
let lixeira = JSON.parse(localStorage.getItem('lixeira') || '[]');

function salvarLixeira() {
  localStorage.setItem('lixeira', JSON.stringify(lixeira));
}

function empurrarLixeira(tipo, item) {
  if (!item) return;
  lixeira.push({ tipo, item });
  // limitar tamanho opcionalmente (ex: 50)
  if (lixeira.length > 50) lixeira.shift();
  salvarLixeira();
  atualizarBotaoRefazer();
}

function refazerUltimaExclusao() {
  if (!lixeira || lixeira.length === 0) {
    Swal.fire('Nada para refazer', 'Não há exclusões recentes para restaurar.', 'info');
    return;
  }

  const registro = lixeira.pop();
  const { tipo, item } = registro;

  switch (tipo) {
    case 'cliente':
      clientes.push(item);
      salvarDados();
      carregarClientes();
      try { if (typeof reloadSecao === 'function') reloadSecao('clientes'); } catch(e){}
      break;
    case 'fornecedor':
      fornecedores.push(item);
      salvarDados();
      carregarFornecedores();
      try { if (typeof reloadSecao === 'function') reloadSecao('fornecedores'); } catch(e){}
      break;
    case 'orcamento':
      orcamentos.push(item);
      salvarDados();
      carregarOrcamentos();
      try { if (typeof reloadSecao === 'function') reloadSecao('orcamentos'); } catch(e){}
      break;
    case 'estoque':
      estoque.push(item);
      salvarDados();
      carregarEstoque();
      try { if (typeof reloadSecao === 'function') reloadSecao('estoque'); } catch(e){}
      break;
    case 'patrimonio':
      patrimonio.push(item);
      salvarDados();
      carregarPatrimonio();
      try { if (typeof reloadSecao === 'function') reloadSecao('patrimonio'); } catch(e){}
      break;
    case 'contrato':
      contratos.push(item);
      salvarDados();
      carregarContratos();
      try { if (typeof reloadSecao === 'function') reloadSecao('contratos'); } catch(e){}
      break;
    case 'receber':
      receber.push(item);
      salvarDados();
      carregarFinanceiro();
      break;
    case 'pagar':
      pagar.push(item);
      salvarDados();
      carregarFinanceiro();
      break;
    default:
      // tipo desconhecido: simplesmente re-salva os dados
      salvarDados();
      break;
  }

  salvarLixeira();
  atualizarBotaoRefazer();
  atualizarTabelaAtual();
  mostrarNotificacao('Item restaurado com sucesso.', 'sucesso');
}

function atualizarBotaoRefazer() {
  const btn = document.getElementById('btnRefazer');
  if (!btn) return;
  btn.disabled = !(lixeira && lixeira.length > 0);
}

function atualizarTabelaAtual() {
  switch (secaoAtual) {
    case 'clientes':
      if (typeof carregarClientes === 'function') carregarClientes();
      try { if (typeof reloadSecao === 'function') reloadSecao('clientes'); } catch(e){}
      break;
    case 'fornecedores':
      if (typeof carregarFornecedores === 'function') carregarFornecedores();
      try { if (typeof reloadSecao === 'function') reloadSecao('fornecedores'); } catch(e){}
      break;
    case 'orcamentos':
      if (typeof carregarOrcamentos === 'function') carregarOrcamentos();
      try { if (typeof reloadSecao === 'function') reloadSecao('orcamentos'); } catch(e){}
      break;
    case 'estoque':
      if (typeof carregarEstoque === 'function') carregarEstoque();
      try { if (typeof reloadSecao === 'function') reloadSecao('estoque'); } catch(e){}
      break;
    case 'financeiro':
      if (typeof carregarFinanceiro === 'function') carregarFinanceiro();
      try { if (typeof reloadSecao === 'function') reloadSecao('financeiro'); } catch(e){}
      break;
    case 'patrimonio':
      if (typeof carregarPatrimonio === 'function') carregarPatrimonio();
      try { if (typeof reloadSecao === 'function') reloadSecao('patrimonio'); } catch(e){}
      break;
    case 'contratos':
      if (typeof carregarContratos === 'function') carregarContratos();
      try { if (typeof reloadSecao === 'function') reloadSecao('contratos'); } catch(e){}
      break;
    default:
      // fallback: tentar recarregar seção por nome
      try { if (typeof reloadSecao === 'function') reloadSecao(secaoAtual); } catch (e) {}
      break;
  }
}

// ==================== SISTEMA DE EDIÇÃO DE CÉLULAS ====================

function ativarEdicaoTodos(secao) {
  modoEdicaoTodos = !modoEdicaoTodos;
  const botao = $(`[data-edit-toggle="${secao}"]`);

  if (modoEdicaoTodos) {
    if (botao) {
      botao.classList.remove('btn-outline-secondary', 'btn-outline-primary');
      botao.classList.add('btn-success');
      botao.innerHTML = '<i class="bi bi-check-square me-2"></i>Salvar Tudo';
    }

    $$(`#${secao} .editable-cell`).forEach(cell => {
      cell.classList.add('editing-todos');
    });

    Swal.fire({
      title: 'Modo Edição Ativado',
      text: 'Todas as células estão editáveis. Clique para editar.',
      icon: 'info',
      timer: 2000
    });
  } else {
    if (botao) {
      botao.classList.remove('btn-success');
      botao.classList.add('btn-outline-primary');
      botao.innerHTML = '<i class="bi bi-pencil-square me-2"></i>Editar Tudo';
    }

    $$(`#${secao} .editing-todos`).forEach(cell => {
      cell.classList.remove('editing-todos');
    });

    // Salva alterações quando sai do modo de edição
    salvarAlteracoesEmMassa(secao);
  }
}

function tornarCelulaEditavel(cell, itemId, campo, tipo = 'text') {
  cell.classList.add('editable-cell');

  cell.addEventListener('dblclick', function(e) {
    e.stopPropagation();
    iniciarEdicaoCelula(this, itemId, campo, tipo);
  });

  cell.addEventListener('click', function(e) {
    if (modoEdicaoTodos && this.classList.contains('editing-todos')) {
      e.stopPropagation();
      iniciarEdicaoCelula(this, itemId, campo, tipo);
    }
  });
}

function iniciarEdicaoCelula(cell, itemId, campo, tipo) {
  if (celulaEditando) return;

  celulaEditando = { cell, itemId, campo, tipo, valorOriginal: cell.textContent };

  const valorAtual = cell.textContent.trim();

  cell.textContent = '';
  cell.classList.add('editing');

  let input;

  if (tipo === 'select-status') {
    input = document.createElement('select');
    input.className = 'cell-select';
    input.innerHTML = `
      <option value="pendente" ${valorAtual === 'pendente' ? 'selected' : ''}>Pendente</option>
      <option value="aprovado" ${valorAtual === 'aprovado' ? 'selected' : ''}>Aprovado</option>
      <option value="recusado" ${valorAtual === 'recusado' ? 'selected' : ''}>Recusado</option>
    `;
  } else if (tipo === 'select-estado') {
    input = document.createElement('select');
    input.className = 'cell-select';
    input.innerHTML = `
      <option value="bom" ${valorAtual === 'bom' ? 'selected' : ''}>Bom</option>
      <option value="regular" ${valorAtual === 'regular' ? 'selected' : ''}>Regular</option>
      <option value="ruim" ${valorAtual === 'ruim' ? 'selected' : ''}>Ruim</option>
    `;
  } else if (tipo === 'textarea') {
    input = document.createElement('textarea');
    input.className = 'cell-textarea';
    input.value = valorAtual;
    input.rows = 3;
  } else if (tipo === 'number' || tipo === 'currency') {
    input = document.createElement('input');
    input.type = 'number';
    input.className = 'cell-input';
    input.step = tipo === 'currency' ? '0.01' : '1';
    input.value = valorAtual.replace('R$ ', '').replace('.', '').replace(',', '.');
  } else if (tipo === 'email') {
    input = document.createElement('input');
    input.type = 'email';
    input.className = 'cell-input';
    input.value = valorAtual;
  } else if (tipo === 'tel') {
    input = document.createElement('input');
    input.type = 'tel';
    input.className = 'cell-input';
    input.value = valorAtual;
  } else {
    input = document.createElement('input');
    input.type = 'text';
    input.className = 'cell-input';
    input.value = valorAtual;
  }

  cell.appendChild(input);
  input.focus();

  if (input.type === 'text' || input.type === 'email' || input.type === 'tel') {
    input.select();
  }

  input.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
      finalizarEdicaoCelula(true);
    } else if (e.key === 'Escape') {
      finalizarEdicaoCelula(false);
    }
  });

  input.addEventListener('blur', function() {
    setTimeout(() => {
      if (celulaEditando && document.activeElement !== input) {
        finalizarEdicaoCelula(true);
      }
    }, 100);
  });
}

function finalizarEdicaoCelula(salvar) {
  if (!celulaEditando) return;

  const { cell, itemId, campo, tipo, valorOriginal } = celulaEditando;
  const input = cell.querySelector('input, select, textarea');

  let novoValor = salvar && input ? input.value.trim() : valorOriginal;

  cell.textContent = '';
  cell.classList.remove('editing');

  if (salvar && input) {
    let valorParaSalvar = novoValor;
    if (tipo === 'currency') {
      // input.value for currency is numeric (dot as decimal); salvamos como number
      const num = parseFloat(novoValor.replace(',', '.')) || 0;
      valorParaSalvar = num;
      cell.textContent = formatarMoeda(num);
    } else if (tipo === 'number') {
      const num = parseInt(novoValor) || 0;
      valorParaSalvar = num;
      cell.textContent = num;
    } else {
      cell.textContent = novoValor;
    }

    atualizarDado(itemId, campo, valorParaSalvar);
  } else {
    cell.textContent = valorOriginal;
  }

  celulaEditando = null;
}

function atualizarDado(itemId, campo, valor) {
  let array, tipo;

  if (itemId.startsWith('cli_')) {
    array = clientes;
    tipo = 'cliente';
    itemId = itemId.replace('cli_', '');
  } else if (itemId.startsWith('for_')) {
    array = fornecedores;
    tipo = 'fornecedor';
    itemId = itemId.replace('for_', '');
  } else if (itemId.startsWith('orc_')) {
    array = orcamentos;
    tipo = 'orcamento';
    itemId = itemId.replace('orc_', '');
  } else if (itemId.startsWith('est_')) {
    array = estoque;
    tipo = 'estoque';
    itemId = itemId.replace('est_', '');
  } else if (itemId.startsWith('rec_')) {
    array = receber;
    tipo = 'receber';
    itemId = itemId.replace('rec_', '');
  } else if (itemId.startsWith('pag_')) {
    array = pagar;
    tipo = 'pagar';
    itemId = itemId.replace('pag_', '');
  } else if (itemId.startsWith('pat_')) {
    array = patrimonio;
    tipo = 'patrimonio';
    itemId = itemId.replace('pat_', '');
  } else if (itemId.startsWith('con_')) {
    array = contratos;
    tipo = 'contrato';
    itemId = itemId.replace('con_', '');
  }

  const item = array.find(item => item.id === itemId);
  if (item) {
    item[campo] = valor;

    if (tipo === 'estoque' && (campo === 'quantidade' || campo === 'minimo')) {
      item.status = calcularStatusEstoque(item).texto;
    }

    if (tipo === 'orcamento' && campo === 'valor') {
      valor = formatarMoeda(valor);
    }

    salvarDados();

    if (tipo === 'estoque' || tipo === 'orcamento' || tipo === 'receber' || tipo === 'pagar') {
      atualizarEstatisticas();
    }

    // Recarrega apenas quando confirma a edição (Enter ou blur)
    try {
      switch (tipo) {
        case 'cliente':
          reloadSecao('clientes'); break;
        case 'fornecedor':
          reloadSecao('fornecedores'); break;
        case 'orcamento':
          reloadSecao('orcamentos'); break;
        case 'estoque':
          reloadSecao('estoque'); break;
        case 'receber':
        case 'pagar':
          reloadSecao('financeiro'); break;
        case 'patrimonio':
          reloadSecao('patrimonio'); break;
        case 'contrato':
          reloadSecao('contratos'); break;
        default:
          break;
      }
    } catch (e) {
      // Se reloadSecao não existir por algum motivo, ignora
    }

    Swal.fire({
      title: 'Atualizado!',
      text: 'Campo atualizado com sucesso.',
      icon: 'success',
      timer: 1500,
      showConfirmButton: false
    });
  }
}

function salvarAlteracoesEmMassa(secao) {
  Swal.fire({
    title: 'Alterações salvas!',
    text: 'Todas as alterações foram salvas automaticamente.',
    icon: 'success',
    timer: 2000,
    showConfirmButton: false
  });
}

// ==================== FUNÇÕES DE NAVEGAÇÃO ====================
function mostrarDashboard(e) {
  if (e) e.preventDefault();
  secaoAtual = 'dashboard';
  atualizarNavbar();
  esconderTodasSecoes();
  const dash = $('#dashboard');
  if (dash) {
    dash.style.display = 'block';
    atualizarEstatisticas();
  } else {
    // Se não houver dashboard na interface atual, abrir seção 'clientes' por padrão
    mostrarSecao('clientes');
    return;
  }
  window.scrollTo(0, 0);
}

function mostrarSecao(secao) {
  secaoAtual = secao;
  atualizarNavbar();
  esconderTodasSecoes();
  $(`#${secao}`).style.display = 'block';
  // carregar dados específicos da seção
  switch(secao) {
    case 'clientes':
      carregarClientes();
      break;
    case 'fornecedores':
      carregarFornecedores();
      break;
    case 'orcamentos':
      carregarOrcamentos();
      break;
    case 'estoque':
      carregarEstoque();
      break;
    case 'financeiro':
      carregarFinanceiro();
      break;
    case 'patrimonio':
      carregarPatrimonio();
      break;
    case 'agenda':
      carregarAgenda();
      break;
    case 'contratos':
      carregarContratos();
      break;
    case 'relatorios':
      atualizarEstatisticas();
      // Gerar gráficos após um pequeno delay para garantir que o DOM está pronto
      setTimeout(() => gerarGraficos(), 100);
      break;
  }

  window.scrollTo(0, 0);
}

function atualizarNavbar() {
  $$('.nav-link-top').forEach(link => {
    link.classList.remove('active');
  });

  const linkAtivo = Array.from($$('.nav-link-top')).find(link => 
    link.textContent.includes(getTituloSecao(secaoAtual))
  );

  if (linkAtivo) {
    linkAtivo.classList.add('active');
  }
}

function getTituloSecao(secao) {
  const titulos = {
    'dashboard': 'Dashboard',
    'clientes': 'Clientes',
    'fornecedores': 'Fornecedores',
    'orcamentos': 'Orçamentos',
    'estoque': 'Estoque',
    'financeiro': 'Financeiro',
    'patrimonio': 'Patrimônio',
    'contratos': 'Contratos',
    'relatorios': 'Relatórios',
    'configuracoes': 'Configurações'
  };
  return titulos[secao] || secao;
}

function esconderTodasSecoes() {
  $$('.secao, #dashboard').forEach(secao => {
    secao.style.display = 'none';
  });
}

// ==================== FUNÇÕES UTILITÁRIAS ====================
function formatarData(data) {
  if (!data) return '-';
  const date = new Date(data);
  return date.toLocaleDateString('pt-BR');
}

function formatarMoeda(valor) {
  return parseFloat(valor || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  });
}

function gerarId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// ==================== CÓDIGOS DE ESTOQUE ====================
function gerarCodigoEstoquePreview() {
  const key = 'estoque_codigo_counter';
  const counter = parseInt(localStorage.getItem(key) || '0', 10) || 0;
  const next = counter + 1;
  return `EST-${String(next).padStart(4, '0')}`;
}

function gerarCodigoEstoque(commit = false) {
  const key = 'estoque_codigo_counter';
  let counter = parseInt(localStorage.getItem(key) || '0', 10) || 0;
  counter = counter + 1;
  if (commit) localStorage.setItem(key, String(counter));
  return `EST-${String(counter).padStart(4, '0')}`;
}

function salvarDados() {
  localStorage.setItem('clientes', JSON.stringify(clientes));
  localStorage.setItem('fornecedores', JSON.stringify(fornecedores));
  localStorage.setItem('orcamentos', JSON.stringify(orcamentos));
  localStorage.setItem('estoque', JSON.stringify(estoque));
  localStorage.setItem('receber', JSON.stringify(receber));
  localStorage.setItem('pagar', JSON.stringify(pagar));
  localStorage.setItem('patrimonio', JSON.stringify(patrimonio));
  localStorage.setItem('contratos', JSON.stringify(contratos));
  // salva também a lixeira (últimas exclusões)
  localStorage.setItem('lixeira', JSON.stringify(lixeira));
  atualizarEstatisticas();
  atualizarBotaoRefazer();
}

// ==================== FUNÇÕES DE CLIENTES ====================
// ==================== FUNÇÕES DE CADASTRO COM MODAL ====================
function adicionarCliente() {
  const modalEl = document.getElementById('modalNovoCliente');
  const form = document.getElementById('formNovoCliente');
  form.reset();
  const modal = new bootstrap.Modal(modalEl);
  modal.show();
}

document.getElementById('btnSalvarNovoCliente')?.addEventListener('click', () => {
  // Pegando todos os valores
  const nome         = document.getElementById('novoClienteNome').value.trim();
  const cpf          = document.getElementById('novoClienteCpf')?.value.trim();
  const email        = document.getElementById('novoClienteEmail').value.trim();
  const telefone     = document.getElementById('novoClienteTelefone').value.trim();
  const profissao    = document.getElementById('novoClienteProfissao')?.value.trim() || '';
  const rua          = document.getElementById('novoClienteRua')?.value.trim() || '';
  const numero       = document.getElementById('novoClienteNumero')?.value.trim() || '';
  const complemento  = document.getElementById('novoClienteComplemento')?.value.trim() || '';
  const localizacao  = document.getElementById('novoClienteLocalizacao')?.value.trim() || '';
  const cidade       = document.getElementById('novoClienteCidade')?.value.trim() || '';
  const estado       = document.getElementById('novoClienteEstado')?.value || '';

  // Validação básica
  if (!nome || !cpf || !email || !telefone) {
    Swal.fire({
      title: 'Campos obrigatórios!',
      text: 'Por favor preencha todos os campos marcados com *',
      icon: 'warning',
      confirmButtonText: 'Entendi'
    });
    return;
  }

  // Validação simples de e-mail
  if (!email.includes('@') || !email.includes('.')) {
    Swal.fire('Atenção', 'E-mail parece inválido!', 'warning');
    return;
  }

  const novoCliente = {
    id: gerarId(),
    nome,
    cpf,
    email,
    telefone,
    profissao,
    rua,
    numero,
    complemento,
    localizacao,
    cidade,
    estado,
    dataCadastro: new Date().toISOString()
  };

  clientes.push(novoCliente);
  salvarDados();
  carregarClientes();

  // Atualiza selects que usam a lista de clientes sem recarregar a página
  preencherSelectClientes('novoReceberCliente');
  preencherSelectClientes('novoContratoCliente');
  preencherSelectClientes('novoOrcamentoCliente');

  bootstrap.Modal.getInstance(document.getElementById('modalNovoCliente')).hide();

  mostrarNotificacao('Cliente "' + nome + '" adicionado com sucesso.', 'sucesso');
});

function excluirCliente(id) {
  const item = clientes.find(c => c.id === id);
  empurrarLixeira('cliente', item);
  clientes = clientes.filter(c => c.id !== id);
  salvarDados();
  carregarClientes();
  try { if (typeof reloadSecao === 'function') reloadSecao('clientes'); } catch(e){}
  console.log('Cliente excluído:', id);
  atualizarTabelaAtual();
  mostrarNotificacao('Cliente removido com sucesso.', 'sucesso');
}

function filtrarClientes() {
  const termo = $('#buscarCliente').value.toLowerCase();
  carregarClientes(termo);
}

function carregarClientes(filtro = '') {
  const tbody = $('#listaClientes');
  let clientesFiltrados = clientes;

  if (filtro) {
    clientesFiltrados = clientes.filter(c =>
      c.nome.toLowerCase().includes(filtro) ||
      (c.email && c.email.toLowerCase().includes(filtro)) ||
      (c.telefone && c.telefone.includes(filtro)) ||
      (c.cpf && c.cpf.includes(filtro)) ||
      (c.profissao && c.profissao.toLowerCase().includes(filtro))
    );
  }

  if (clientesFiltrados.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="12" class="text-center py-4">
          <i class="bi bi-people display-4 text-muted mb-3 d-block"></i>
          <p class="text-muted">${filtro ? 'Nenhum cliente encontrado' : 'Nenhum cliente cadastrado'}</p>
        </td>
      </tr>
    `;
    return;
  }
  tbody.innerHTML = clientesFiltrados.map(cliente => `
  <tr>
    <td class="editable-cell" data-id="cli_${cliente.id}" data-field="nome">${cliente.nome}</td>
    <td class="editable-cell" data-id="cli_${cliente.id}" data-field="cpf">${cliente.cpf || '-'}</td>
    <td class="editable-cell" data-id="cli_${cliente.id}" data-field="email">${cliente.email || '-'}</td>
    <td class="editable-cell" data-id="cli_${cliente.id}" data-field="telefone">${cliente.telefone || '-'}</td>
    <td class="editable-cell" data-id="cli_${cliente.id}" data-field="profissao">${cliente.profissao || '-'}</td>
    <td class="editable-cell" data-id="cli_${cliente.id}" data-field="rua">${cliente.rua || '-'}</td>
    <td class="editable-cell" data-id="cli_${cliente.id}" data-field="numero">${cliente.numero || '-'}</td>
    <td class="editable-cell" data-id="cli_${cliente.id}" data-field="complemento">${cliente.complemento || '-'}</td>
    <td class="editable-cell" data-id="cli_${cliente.id}" data-field="localizacao">${cliente.localizacao || '-'}</td>
    <td class="editable-cell" data-id="cli_${cliente.id}" data-field="cidade">${cliente.cidade || '-'}</td>
    <td class="editable-cell" data-id="cli_${cliente.id}" data-field="estado">${cliente.estado || '-'}</td>
    <td class="no-print">
      <button class="btn btn-sm btn-outline-danger btn-excluir" data-delete-type="cliente" data-id="${cliente.id}">
        <i class="bi bi-trash"></i>
      </button>
    </td>
  </tr>
`).join('');

  $$('#listaClientes .editable-cell').forEach(cell => {
    const itemId = cell.getAttribute('data-id');
    const campo = cell.getAttribute('data-field');
    let tipo = 'text';
    if (campo === 'email') tipo = 'email';
    if (campo === 'telefone') tipo = 'tel';
    tornarCelulaEditavel(cell, itemId, campo, tipo);
  });
}

// ==================== FUNÇÕES DE FORNECEDORES ====================
function adicionarFornecedor() {
  document.getElementById('formNovoFornecedor').reset();
  new bootstrap.Modal(document.getElementById('modalNovoFornecedor')).show();
}

function carregarFornecedores(filtro = '') {
    const tbody = document.getElementById('listaFornecedores');
    let fornecedoresFiltrados = fornecedores;

    if (filtro) {
        const termo = filtro.toLowerCase();
        fornecedoresFiltrados = fornecedores.filter(f =>
            (f.nome && f.nome.toLowerCase().includes(termo)) ||
            (f.cnpj && f.cnpj.includes(termo)) ||
            (f.email && f.email.toLowerCase().includes(termo)) ||
            (f.telefone && f.telefone.includes(termo)) ||
            (f.fornecimento && f.fornecimento.toLowerCase().includes(termo)) ||
            (f.cidade && f.cidade.toLowerCase().includes(termo))
        );
    }

    if (fornecedoresFiltrados.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="13" class="text-center py-4">
                    <i class="bi bi-truck display-4 text-muted mb-3 d-block"></i>
                    <p class="text-muted">${filtro ? 'Nenhum fornecedor encontrado' : 'Nenhum fornecedor cadastrado ainda'}</p>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = fornecedoresFiltrados.map(fornecedor => `
        <tr>
            <td class="editable-cell" data-id="for_${fornecedor.id}" data-field="nome">${fornecedor.nome || '-'}</td>
            <td class="editable-cell" data-id="for_${fornecedor.id}" data-field="cnpj">${fornecedor.cnpj || '-'}</td>
            <td class="editable-cell" data-id="for_${fornecedor.id}" data-field="email">${fornecedor.email || '-'}</td>
            <td class="editable-cell" data-id="for_${fornecedor.id}" data-field="telefone">${fornecedor.telefone || '-'}</td>
            <td class="editable-cell" data-id="for_${fornecedor.id}" data-field="fornecimento">${fornecedor.fornecimento || '-'}</td>
            <td class="editable-cell" data-id="for_${fornecedor.id}" data-field="rua">${fornecedor.rua || '-'}</td>
            <td class="editable-cell" data-id="for_${fornecedor.id}" data-field="numero">${fornecedor.numero || '-'}</td>
            <td class="editable-cell" data-id="for_${fornecedor.id}" data-field="complemento">${fornecedor.complemento || '-'}</td>
            <td class="editable-cell" data-id="for_${fornecedor.id}" data-field="localizacao">${fornecedor.localizacao || '-'}</td>
            <td class="editable-cell" data-id="for_${fornecedor.id}" data-field="cidade">${fornecedor.cidade || '-'}</td>
            <td class="editable-cell" data-id="for_${fornecedor.id}" data-field="estado">${fornecedor.estado || '-'}</td>
            <td class="non-editable-cell">${formatarData(fornecedor.dataCadastro)}</td>
            <td class="no-print">
              <button class="btn btn-sm btn-outline-danger btn-excluir" data-delete-type="fornecedor" data-id="${fornecedor.id}">
                <i class="bi bi-trash"></i>
              </button>
            </td>
        </tr>
    `).join('');

    // Tornar células editáveis
    document.querySelectorAll('#listaFornecedores .editable-cell').forEach(cell => {
        const itemId = cell.getAttribute('data-id');
        const campo = cell.getAttribute('data-field');
        let tipo = 'text';

        if (campo === 'email') tipo = 'email';
        if (campo === 'telefone') tipo = 'tel';

        tornarCelulaEditavel(cell, itemId, campo, tipo);
    });
}

function excluirFornecedor(id) {
  const item = fornecedores.find(f => f.id === id);
  empurrarLixeira('fornecedor', item);
  fornecedores = fornecedores.filter(f => f.id !== id);
  salvarDados();
  carregarFornecedores();
  try { if (typeof reloadSecao === 'function') reloadSecao('fornecedores'); } catch(e){}
  console.log('Fornecedor excluído:', id);
  atualizarTabelaAtual();
  Swal.fire('Excluído!', 'Fornecedor removido com sucesso.', 'success');
}

function filtrarFornecedores() {
    const termo = document.getElementById('buscarFornecedor')?.value || '';
    carregarFornecedores(termo);
}

// ==================== FUNÇÕES DE ORÇAMENTOS ====================
// Novo Orçamento - com select de clientes
function adicionarOrcamento() {
  if (clientes.length === 0) {
    Swal.fire('Atenção', 'Cadastre pelo menos um cliente primeiro!', 'warning');
    return;
  }

  const select = document.getElementById('novoOrcamentoCliente');
  select.innerHTML = '<option value="">Selecione um cliente...</option>';
  
  clientes.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = c.nome;
    select.appendChild(opt);
  });

  const modal = new bootstrap.Modal(document.getElementById('modalNovoOrcamento'));
  document.getElementById('formNovoOrcamento').reset();
  modal.show();
}

// Busca dinâmica de clientes no modal de orçamento
document.getElementById('buscaClienteOrcamento')?.addEventListener('input', function() {
  const termo = this.value.toLowerCase().trim();
  const select = document.getElementById('novoOrcamentoCliente');
  select.innerHTML = '';

  if (termo.length < 2) {
    select.style.display = 'none';
    return;
  }

  const clientesFiltrados = clientes.filter(c => 
    c.nome.toLowerCase().includes(termo) || 
    (c.cpf && c.cpf.includes(termo))
  );

  if (clientesFiltrados.length === 0) {
    select.innerHTML = '<option disabled>Nenhum cliente encontrado</option>';
    select.style.display = 'block';
    return;
  }

  clientesFiltrados.forEach(cliente => {
    const option = document.createElement('option');
    option.value = cliente.id;
    option.textContent = `${cliente.nome} ${cliente.cpf ? `(${cliente.cpf})` : ''}`;
    select.appendChild(option);
  });

  select.style.display = 'block';
});

// Selecionar cliente ao clicar
document.getElementById('novoOrcamentoCliente')?.addEventListener('change', function() {
  const buscaInput = document.getElementById('buscaClienteOrcamento');
  const selectedOption = this.options[this.selectedIndex];
  if (selectedOption && selectedOption.value) {
    buscaInput.value = selectedOption.textContent;
    this.style.display = 'none';
  }
});

// Limpar busca
document.getElementById('btnLimparBuscaCliente')?.addEventListener('click', () => {
  document.getElementById('buscaClienteOrcamento').value = '';
  document.getElementById('novoOrcamentoCliente').style.display = 'none';
  document.getElementById('novoOrcamentoCliente').innerHTML = '';
});

// Máscara de valor (já deve existir, mas reforçando)
const _novoOrcamentoValor = document.getElementById('novoOrcamentoValor');
if (_novoOrcamentoValor) aplicarMascaraMoeda(_novoOrcamentoValor);

// Salvar novo orçamento (atualizado)
document.getElementById('btnSalvarNovoOrcamento')?.addEventListener('click', () => {
  const clienteId = document.getElementById('novoOrcamentoCliente').value;
  const valorStr = document.getElementById('novoOrcamentoValor').value
    .replace('R$', '').replace(/\./g, '').replace(',', '.').trim();
  const descricao = document.getElementById('novoOrcamentoDescricao').value.trim();
  const condPagto = document.getElementById('novoOrcamentoCondPagto').value;

  if (!clienteId || !valorStr || parseFloat(valorStr) <= 0 || !descricao || !condPagto) {
    Swal.fire('Atenção', 'Preencha todos os campos obrigatórios corretamente!', 'warning');
    return;
  }

  const cliente = clientes.find(c => c.id === clienteId);

  const orcamento = {
    id: gerarId(),
    clienteId: clienteId,
    clienteNome: cliente ? cliente.nome : 'Cliente não identificado',
    valor: parseFloat(valorStr),
    descricao: descricao,
    condPagto: condPagto,
    data: new Date().toISOString(),
    validade: document.getElementById('novoOrcamentoValidade').value || '',
    status: document.getElementById('novoOrcamentoStatus').value || 'pendente',
    observacoesInternas: document.getElementById('novoOrcamentoObservacoes').value.trim() || ''
  };

  orcamentos.push(orcamento);
  salvarDados();
  carregarOrcamentos();

  bootstrap.Modal.getInstance(document.getElementById('modalNovoOrcamento')).hide();
    
  Swal.fire({
    title: 'Orçamento criado!',
    text: `Orçamento para ${cliente?.nome || 'cliente selecionado'} no valor de ${formatarMoeda(orcamento.valor)}`,
    icon: 'success',
    timer: 2500
  });
});

function filtrarOrcamentos() {
  const status = $('#filtroStatus').value;
  carregarOrcamentos(status);
}

function carregarOrcamentos(filtroStatus = 'todos') {
  const tbody = $('#listaOrcamentos');
  let orcamentosFiltrados = orcamentos;

  if (filtroStatus !== 'todos') {
    orcamentosFiltrados = orcamentos.filter(o => o.status === filtroStatus);
  }

  if (orcamentosFiltrados.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="text-center py-4">
          <i class="bi bi-calculator display-4 text-muted mb-3 d-block"></i>
          <p class="text-muted">${filtroStatus !== 'todos' ? 'Nenhum orçamento com esse status' : 'Nenhum orçamento cadastrado'}</p>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = orcamentosFiltrados.map((orcamento, index) => {
    let statusClass = 'bg-secondary';
    if (orcamento.status === 'aprovado') statusClass = 'bg-success';
    if (orcamento.status === 'pendente') statusClass = 'bg-warning';
    if (orcamento.status === 'recusado') statusClass = 'bg-danger';

    return `
      <tr>
        <td class="non-editable-cell">${index + 1}</td>
        <td class="editable-cell" data-id="orc_${orcamento.id}" data-field="clienteNome">${orcamento.clienteNome}</td>
        <td class="editable-cell" data-id="orc_${orcamento.id}" data-field="descricao" data-type="textarea">${orcamento.descricao}</td>
        <td class="editable-cell" data-id="orc_${orcamento.id}" data-field="valor" data-type="currency">${formatarMoeda(orcamento.valor)}</td>
        <td class="non-editable-cell">${formatarData(orcamento.data)}</td>
        <td class="editable-cell" data-id="orc_${orcamento.id}" data-field="status" data-type="select-status">
          <span class="badge ${statusClass}">${orcamento.status}</span>
        </td>
        <td class="no-print">
          <button class="btn btn-sm btn-outline-danger btn-excluir" data-delete-type="orcamento" data-id="${orcamento.id}">
            <i class="bi bi-trash"></i>
          </button>
        </td>
      </tr>
    `;
  }).join('');

  $$('#listaOrcamentos .editable-cell').forEach(cell => {
    const itemId = cell.getAttribute('data-id');
    const campo = cell.getAttribute('data-field');
    const tipo = cell.getAttribute('data-type') || 'text';
    tornarCelulaEditavel(cell, itemId, campo, tipo);
  });
}

function excluirOrcamento(id) {
  const item = orcamentos.find(o => o.id === id);
  empurrarLixeira('orcamento', item);
  orcamentos = orcamentos.filter(o => o.id !== id);
  salvarDados();
  carregarOrcamentos();
  try { if (typeof reloadSecao === 'function') reloadSecao('orcamentos'); } catch(e){}
  console.log('Orçamento excluído:', id);
  atualizarTabelaAtual();
  Swal.fire('Excluído!', 'Orçamento removido com sucesso.', 'success');
}

// ==================== FUNÇÕES DE ESTOQUE ====================
// Item de Estoque
function adicionarItemEstoque() {
  const modal = new bootstrap.Modal(document.getElementById('modalNovoItemEstoque'));
  document.getElementById('formNovoItemEstoque').reset();
  modal.show();
}
document.getElementById('btnSalvarNovoEstoque')?.addEventListener('click', () => {
  const produto = document.getElementById('novoEstoqueProduto').value.trim();

  if (!produto) {
    Swal.fire('Atenção', 'O nome do produto é obrigatório!', 'warning');
    return;
  }

  const quantidade = parseInt(document.getElementById('novoEstoqueQuantidade').value) || 0;
  const minimo = parseInt(document.getElementById('novoEstoqueMinimo').value) || 5;
  
  const valorCustoStr = document.getElementById('novoEstoqueValorCusto').value
    .replace(/[^^\d,]/g, '').replace(',', '.').trim();
  const valorCusto = parseFloat(valorCustoStr) || 0;
  
  const valorVendaStr = document.getElementById('novoEstoqueValorVenda').value
    .replace(/[^^\d,]/g, '').replace(',', '.').trim();
  const valorVenda = parseFloat(valorVendaStr) || 0;

  const fornecedorId = document.getElementById('novoEstoqueFornecedor')?.value || '';
  const fornecedorNome = fornecedorId ? (fornecedores.find(f => f.id === fornecedorId)?.nome || '') : document.getElementById('novoEstoqueFornecedorAlt')?.value.trim() || '';

  const item = {
    id: gerarId(),
    codigo: gerarCodigoEstoque(true),
    produto,
    quantidade,
    minimo,
    valorCusto,
    valorVenda,
    fornecedorId: fornecedorId || '',
    fornecedor: fornecedorNome,
    observacao: document.getElementById('novoEstoqueObservacao')?.value.trim() || '',
    status: calcularStatusEstoque({quantidade, minimo}).texto,
    dataCadastro: new Date().toISOString()
  };

  estoque.push(item);
  salvarDados();
  carregarEstoque();

  bootstrap.Modal.getInstance(document.getElementById('modalNovoItemEstoque')).hide();
  
  Swal.fire('Sucesso!', 'Item adicionado ao estoque!', 'success');
});

// Preenche o select de fornecedores no modal de estoque
function atualizarSelectFornecedoresEstoque() {
  const select = document.getElementById('novoEstoqueFornecedor');
  if (!select) return;

  select.innerHTML = '<option value="">Selecione um fornecedor...</option>';

  fornecedores.forEach(f => {
    const opt = document.createElement('option');
    opt.value = f.id;
    opt.textContent = f.nome + (f.fornecimento ? ` (${f.fornecimento})` : '');
    select.appendChild(opt);
  });
}

// Atualiza quando o modal for aberto
document.getElementById('modalNovoItemEstoque')?.addEventListener('show.bs.modal', () => {
  atualizarSelectFornecedoresEstoque();
  const codigoInput = document.getElementById('novoEstoqueCodigo');
  if (codigoInput) codigoInput.value = gerarCodigoEstoquePreview();
});

function calcularStatusEstoque(item) {
  const porcentagem = (item.quantidade / item.minimo) * 100;

  if (porcentagem <= 30) {
    return { classe: 'badge-estoque-baixo', texto: 'BAIXO', linha: 'table-danger' };
  } else if (porcentagem <= 60) {
    return { classe: 'badge-estoque-medio', texto: 'ATENÇÃO', linha: 'table-warning' };
  } else {
    return { classe: 'badge-estoque-ok', texto: 'OK', linha: '' };
  }
}

function carregarEstoque() {
  const tbody = $('#listaEstoque');

  if (estoque.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="10" class="text-center py-4">
          <i class="bi bi-box display-4 text-muted mb-3 d-block"></i>
          <p class="text-muted">Nenhum item no estoque</p>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = estoque.map(item => {
    const status = calcularStatusEstoque(item);

    return `
      <tr class="${status.linha}">
        <td class="non-editable-cell">${item.codigo || ''}</td>
        <td class="editable-cell" data-id="est_${item.id}" data-field="produto">${item.produto}</td>
        <td class="editable-cell" data-id="est_${item.id}" data-field="quantidade" data-type="number">${item.quantidade}</td>
        <td class="editable-cell" data-id="est_${item.id}" data-field="minimo" data-type="number">${item.minimo}</td>
        <td class="editable-cell" data-id="est_${item.id}" data-field="fornecedor">${item.fornecedor || ''}</td>
        <td class="editable-cell" data-id="est_${item.id}" data-field="observacao">${item.observacao || ''}</td>
        <td class="editable-cell" data-id="est_${item.id}" data-field="valorCusto" data-type="currency">${formatarMoeda(item.valorCusto || item.valorUnitario || 0)}</td>
        <td class="editable-cell" data-id="est_${item.id}" data-field="valorVenda" data-type="currency">${formatarMoeda(item.valorVenda || item.valorUnitario || 0)}</td>
        <td class="non-editable-cell">
          <span class="badge ${status.classe}">${status.texto}</span>
        </td>
        <td class="no-print">
          <button class="btn btn-sm btn-outline-danger btn-excluir" data-delete-type="estoque" data-id="${item.id}">
            <i class="bi bi-trash"></i>
          </button>
        </td>
      </tr>
    `;
  }).join('');

  $$('#listaEstoque .editable-cell').forEach(cell => {
    const itemId = cell.getAttribute('data-id');
    const campo = cell.getAttribute('data-field');
    const tipo = cell.getAttribute('data-type') || 'text';
    tornarCelulaEditavel(cell, itemId, campo, tipo);
  });
}

function excluirItemEstoque(id) {
  const item = estoque.find(e => e.id === id);
  empurrarLixeira('estoque', item);
  estoque = estoque.filter(e => e.id !== id);
  salvarDados();
  carregarEstoque();
  try { if (typeof reloadSecao === 'function') reloadSecao('estoque'); } catch(e){}
  console.log('Item de estoque excluído:', id);
  atualizarTabelaAtual();
  Swal.fire('Excluído!', 'Item removido do estoque.', 'success');
}

// ==================== FUNÇÕES FINANCEIRAS ====================
function adicionarContaReceber() {
  document.getElementById('formNovoReceber').reset();
  new bootstrap.Modal(document.getElementById('modalNovoReceber')).show();
}

function adicionarContaPagar() {
  document.getElementById('formNovoPagar').reset();
  new bootstrap.Modal(document.getElementById('modalNovoPagar')).show();
}

function carregarFinanceiro() {
  carregarContasReceber();
  carregarContasPagar();
  atualizarSaldo();
}

// Preenche selects para modais financeiros
function preencherSelectClientes(selectId) {
  const select = document.getElementById(selectId);
  if (!select) return;
  select.innerHTML = '<option value="">Selecione um cliente...</option>';
  clientes.forEach(cliente => {
    const opt = document.createElement('option');
    opt.value = cliente.id;
    opt.textContent = cliente.nome + (cliente.cpf ? ` (${cliente.cpf})` : '');
    select.appendChild(opt);
  });
}

function preencherSelectFornecedores(selectId) {
  const select = document.getElementById(selectId);
  if (!select) return;
  select.innerHTML = '<option value="">Selecione um fornecedor...</option>';
  fornecedores.forEach(fornecedor => {
    const opt = document.createElement('option');
    opt.value = fornecedor.id;
    opt.textContent = fornecedor.nome + (fornecedor.cnpj ? ` (${fornecedor.cnpj})` : '');
    select.appendChild(opt);
  });
}

// Ao abrir os modais, popular selects e ajustar datas
document.getElementById('modalNovoReceber')?.addEventListener('show.bs.modal', () => {
  preencherSelectClientes('novoReceberCliente');
  const inputData = document.getElementById('novoReceberDataVenc');
  if (inputData) inputData.value = new Date().toISOString().split('T')[0];
});

document.getElementById('modalNovoPagar')?.addEventListener('show.bs.modal', () => {
  preencherSelectFornecedores('novoPagarFornecedor');
  const inputData = document.getElementById('novoPagarDataVenc');
  if (inputData) inputData.value = new Date().toISOString().split('T')[0];
});

// Salvar novo receber (entrada)
document.getElementById('btnSalvarNovoReceber')?.addEventListener('click', () => {
  const descricao = document.getElementById('novoReceberDescricao')?.value.trim();
  const valor = parseFloat((document.getElementById('novoReceberValor')?.value || '').replace(/[^\d,]/g, '').replace(',', '.') || 0);
  const dataVenc = document.getElementById('novoReceberDataVenc')?.value;
  const clienteId = document.getElementById('novoReceberCliente')?.value;
  const forma = document.getElementById('novoReceberForma')?.value;
  const categoria = document.getElementById('novoReceberCategoria')?.value;
  const status = document.getElementById('novoReceberStatus')?.value;
  const obs = document.getElementById('novoReceberObs')?.value.trim() || '';

  if (!descricao || !valor || !dataVenc || !clienteId || !forma || !categoria || !status) {
    Swal.fire('Atenção', 'Preencha todos os campos obrigatórios!', 'warning');
    return;
  }

  const cliente = clientes.find(c => c.id === clienteId);
  const entrada = {
    id: gerarId(),
    descricao,
    valor,
    dataVencimento: dataVenc,
    clienteId,
    clienteNome: cliente ? cliente.nome : '',
    formaRecebimento: forma,
    categoria,
    status,
    observacoes: obs,
    dataCadastro: new Date().toISOString()
  };

  receber.push(entrada);
  salvarDados();
  carregarFinanceiro();
  bootstrap.Modal.getInstance(document.getElementById('modalNovoReceber')).hide();
  Swal.fire('Sucesso!', 'Entrada financeira adicionada.', 'success');
  atualizarEstatisticas();
});

// Salvar novo pagar (saída)
document.getElementById('btnSalvarNovoPagar')?.addEventListener('click', () => {
  const descricao = document.getElementById('novoPagarDescricao')?.value.trim();
  const valor = parseFloat((document.getElementById('novoPagarValor')?.value || '').replace(/[^\d,]/g, '').replace(',', '.') || 0);
  const dataVenc = document.getElementById('novoPagarDataVenc')?.value;
  const fornecedorId = document.getElementById('novoPagarFornecedor')?.value;
  const forma = document.getElementById('novoPagarForma')?.value;
  const categoria = document.getElementById('novoPagarCategoria')?.value;
  const status = document.getElementById('novoPagarStatus')?.value;
  const obs = document.getElementById('novoPagarObs')?.value.trim() || '';

  if (!descricao || !valor || !dataVenc || !fornecedorId || !forma || !categoria || !status) {
    Swal.fire('Atenção', 'Preencha todos os campos obrigatórios!', 'warning');
    return;
  }

  const fornecedor = fornecedores.find(f => f.id === fornecedorId);
  const saida = {
    id: gerarId(),
    descricao,
    valor,
    dataVencimento: dataVenc,
    fornecedorId,
    fornecedorNome: fornecedor ? fornecedor.nome : '',
    formaPagamento: forma,
    categoria,
    status,
    observacoes: obs,
    dataCadastro: new Date().toISOString()
  };

  pagar.push(saida);
  salvarDados();
  carregarFinanceiro();
  bootstrap.Modal.getInstance(document.getElementById('modalNovoPagar')).hide();
  Swal.fire('Sucesso!', 'Saída financeira adicionada.', 'success');
  atualizarEstatisticas();
});

function carregarContasReceber() {
  const tbody = $('#listaReceber');
  if (receber.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="text-center text-muted">Nenhuma conta a receber</td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = receber.map((conta) => `
    <tr>
      <td class="editable-cell" data-id="rec_${conta.id}" data-field="descricao">${conta.descricao}</td>
      <td class="editable-cell" data-id="rec_${conta.id}" data-field="valor" data-type="currency">${formatarMoeda(conta.valor)}</td>
      <td>${formatarData(conta.dataVencimento)}</td>
      <td>${conta.clienteNome || '-'}</td>
      <td>${conta.formaRecebimento || '-'}</td>
      <td>${conta.categoria || '-'}</td>
      <td><span class="badge ${conta.status === 'pago' ? 'bg-success' : conta.status === 'atrasado' ? 'bg-danger' : 'bg-warning'}">${conta.status}</span></td>
      <td class="no-print">
        <button class="btn btn-sm btn-outline-danger btn-excluir" data-delete-type="receber" data-id="${conta.id}">
          <i class="bi bi-trash"></i>
        </button>
      </td>
    </tr>
  `).join('');

  $$('#listaReceber .editable-cell').forEach(cell => {
    const itemId = cell.getAttribute('data-id');
    const campo = cell.getAttribute('data-field');
    const tipo = cell.getAttribute('data-type') || 'text';
    tornarCelulaEditavel(cell, itemId, campo, tipo);
  });
}

function carregarContasPagar() {
  const tbody = $('#listaPagar');
  if (pagar.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="text-center text-muted">Nenhuma conta a pagar</td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = pagar.map((conta) => `
    <tr>
      <td class="editable-cell" data-id="pag_${conta.id}" data-field="descricao">${conta.descricao}</td>
      <td class="editable-cell" data-id="pag_${conta.id}" data-field="valor" data-type="currency">${formatarMoeda(conta.valor)}</td>
      <td>${formatarData(conta.dataVencimento)}</td>
      <td>${conta.fornecedorNome || '-'}</td>
      <td>${conta.formaPagamento || '-'}</td>
      <td>${conta.categoria || '-'}</td>
      <td><span class="badge ${conta.status === 'pago' ? 'bg-success' : conta.status === 'atrasado' ? 'bg-danger' : 'bg-warning'}">${conta.status}</span></td>
      <td class="no-print">
        <button class="btn btn-sm btn-outline-danger btn-excluir" data-delete-type="pagar" data-id="${conta.id}">
          <i class="bi bi-trash"></i>
        </button>
      </td>
    </tr>
  `).join('');

  $$('#listaPagar .editable-cell').forEach(cell => {
    const itemId = cell.getAttribute('data-id');
    const campo = cell.getAttribute('data-field');
    const tipo = cell.getAttribute('data-type') || 'text';
    tornarCelulaEditavel(cell, itemId, campo, tipo);
  });
}

function removerContaReceber(id) {
  const item = receber.find(c => c.id === id);
  empurrarLixeira('receber', item);
  receber = receber.filter(c => c.id !== id);
  salvarDados();
  carregarFinanceiro();
  try { if (typeof reloadSecao === 'function') reloadSecao('financeiro'); } catch(e){}
  console.log('Conta a receber removida:', id);
  atualizarTabelaAtual();
  Swal.fire('Removido!', 'Conta a receber removida.', 'success');
}

function removerContaPagar(id) {
  const item = pagar.find(c => c.id === id);
  empurrarLixeira('pagar', item);
  pagar = pagar.filter(c => c.id !== id);
  salvarDados();
  carregarFinanceiro();
  try { if (typeof reloadSecao === 'function') reloadSecao('financeiro'); } catch(e){}
  console.log('Conta a pagar removida:', id);
  atualizarTabelaAtual();
  Swal.fire('Removido!', 'Conta a pagar removida.', 'success');
}

function atualizarSaldo() {
  const totalReceber = receber.reduce((s, v) => s + parseFloat(v.valor || 0), 0);
  const totalPagar = pagar.reduce((s, v) => s + parseFloat(v.valor || 0), 0);
  const saldo = totalReceber - totalPagar;

  const elTotalReceitas = $('#totalReceitas');
  if (elTotalReceitas) elTotalReceitas.textContent = formatarMoeda(totalReceber);

  const elTotalDespesas = $('#totalDespesas');
  if (elTotalDespesas) elTotalDespesas.textContent = formatarMoeda(totalPagar);

  const elSaldoAtual = $('#saldoAtual');
  if (elSaldoAtual) {
    elSaldoAtual.textContent = formatarMoeda(saldo);
    elSaldoAtual.className = saldo >= 0 ? 'saldo-positivo' : 'saldo-negativo';
  }

  const alert = $('#saldoAlert');
  if (alert) alert.className = `alert ${saldo >= 0 ? 'alert-success' : 'alert-danger'}`;
}

// ==================== FUNÇÕES DE PATRIMÔNIO ====================
function adicionarPatrimonio() {
  document.getElementById('formNovoPatrimonio').reset();
  document.getElementById('novoPatrimonioDataAquisicao').value = new Date().toISOString().split('T')[0];
  new bootstrap.Modal(document.getElementById('modalNovoPatrimonio')).show();
}

// Popular select de fornecedores ao abrir modal de patrimônio
document.getElementById('modalNovoPatrimonio')?.addEventListener('show.bs.modal', function () {
  preencherSelectFornecedores('novoPatrimonioFornecedor');
  const input = document.getElementById('novoPatrimonioDataAquisicao');
  if (input) input.value = new Date().toISOString().split('T')[0];
});

// Botão de teste rápido - novo patrimônio
document.querySelector('[onclick="adicionarPatrimonio()"]')?.addEventListener('click', function(e) {
  e.preventDefault();
  console.log("Botão Novo Patrimônio clicado!");
  
  const modalElement = document.getElementById('modalNovoPatrimonio');
  if (!modalElement) {
    alert("Modal de patrimônio não encontrado! Verifique o ID no HTML.");
    return;
  }
  
  try {
    const modal = new bootstrap.Modal(modalElement);
    modal.show();
  } catch (err) {
    console.error("Erro ao abrir modal:", err);
    alert("Erro ao abrir o modal. Veja o console (F12).");
  }
});

function carregarPatrimonio() {
  const tbody = $('#listaPatrimonio');

  if (patrimonio.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9" class="text-center py-4">
          <i class="bi bi-building display-4 text-muted mb-3 d-block"></i>
          <p class="text-muted">Nenhum item no patrimônio</p>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = patrimonio.map(item => {
    let estadoClass = 'bg-success';
    if (item.estado === 'regular') estadoClass = 'bg-warning';
    if (item.estado === 'ruim') estadoClass = 'bg-danger';

    return `
      <tr>
        <td class="editable-cell" data-id="pat_${item.id}" data-field="codigo">${item.codigo || '-'}</td>
        <td class="editable-cell" data-id="pat_${item.id}" data-field="nome">${item.nome || '-'}</td>
        <td class="editable-cell" data-id="pat_${item.id}" data-field="categoria">${item.categoria || '-'}</td>
        <td class="non-editable-cell">${formatarData(item.dataAquisicao)}</td>
        <td class="editable-cell" data-id="pat_${item.id}" data-field="fornecedorNome">${item.fornecedorNome || '-'}</td>
        <td class="editable-cell" data-id="pat_${item.id}" data-field="localizacao">${item.localizacao || '-'}</td>
        <td class="editable-cell" data-id="pat_${item.id}" data-field="estado" data-type="select-estado">
          <span class="badge ${estadoClass}">${item.estado || '-'}</span>
        </td>
        <td class="editable-cell" data-id="pat_${item.id}" data-field="vidaUtil" data-type="number">${item.vidaUtil || 0}</td>
        <td class="no-print">
          <button class="btn btn-sm btn-outline-danger btn-excluir" data-delete-type="patrimonio" data-id="${item.id}">
            <i class="bi bi-trash"></i>
          </button>
        </td>
      </tr>
    `;
  }).join('');

  $$('#listaPatrimonio .editable-cell').forEach(cell => {
    const itemId = cell.getAttribute('data-id');
    const campo = cell.getAttribute('data-field');
    const tipo = cell.getAttribute('data-type') || 'text';
    tornarCelulaEditavel(cell, itemId, campo, tipo);
  });
}

function excluirPatrimonio(id) {
  const item = patrimonio.find(p => p.id === id);
  empurrarLixeira('patrimonio', item);
  patrimonio = patrimonio.filter(p => p.id !== id);
  salvarDados();
  carregarPatrimonio();
  try { if (typeof reloadSecao === 'function') reloadSecao('patrimonio'); } catch(e){}
  console.log('Patrimônio excluído:', id);
  atualizarTabelaAtual();
  Swal.fire('Excluído!', 'Item removido do patrimônio.', 'success');
}

// ==================== FUNÇÕES DE CONTRATOS ====================
function adicionarContrato() {
  if (clientes.length === 0) {
    Swal.fire('Atenção', 'Cadastre primeiro um cliente!', 'warning');
    return;
  }

  const select = document.getElementById('novoContratoCliente');
  select.innerHTML = '<option value="">Selecione um cliente...</option>';
  clientes.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.id; opt.textContent = c.nome;
    select.appendChild(opt);
  });
  document.getElementById('formNovoContrato').reset();
  new bootstrap.Modal(document.getElementById('modalNovoContrato')).show();
}

function carregarContratos() {
  const container = $('#listaContratos');

  if (contratos.length === 0) {
    container.innerHTML = `
      <div class="col-12">
        <div class="empty-state">
          <i class="bi bi-file-earmark-text"></i>
          <h5>Nenhum contrato</h5>
          <p>Comece criando seu primeiro contrato</p>
        </div>
      </div>
    `;
    return;
  }

  container.innerHTML = contratos.map(contrato => `
    <div class="col-md-6 mb-3">
      <div class="card h-100">
        <div class="card-body">
          <h6 class="card-title editable-cell" data-id="con_${contrato.id}" data-field="clienteNome">${contrato.clienteNome}</h6>
          <p class="card-text text-muted small editable-cell" data-id="con_${contrato.id}" data-field="descricao" data-type="textarea">${contrato.descricao.substring(0, 100)}...</p>
          <div class="d-flex justify-content-between align-items-center mt-3">
            <small class="text-muted non-editable-cell">${formatarData(contrato.data)}</small>
            <button class="btn btn-sm btn-outline-danger btn-excluir" data-delete-type="contrato" data-id="${contrato.id}">
              <i class="bi bi-trash"></i>
            </button>
          </div>
        </div>
      </div>
    </div>
  `).join('');

  $$('#listaContratos .editable-cell').forEach(cell => {
    const itemId = cell.getAttribute('data-id');
    const campo = cell.getAttribute('data-field');
    const tipo = cell.getAttribute('data-type') || 'text';
    tornarCelulaEditavel(cell, itemId, campo, tipo);
  });
}

function excluirContrato(id) {
  const item = contratos.find(c => c.id === id);
  empurrarLixeira('contrato', item);
  contratos = contratos.filter(c => c.id !== id);
  salvarDados();
  carregarContratos();
  try { if (typeof reloadSecao === 'function') reloadSecao('contratos'); } catch(e){}
  console.log('Contrato excluído:', id);
  atualizarTabelaAtual();
  Swal.fire('Excluído!', 'Contrato removido com sucesso.', 'success');
}

// ==================== FUNÇÕES DE IMPRESSÃO ====================
function imprimirSecaoAtual() {
  if (secaoAtual === 'dashboard') {
    imprimirRelatorioCompleto();
  } else {
    window.print();
  }
}

function imprimirRelatorioCompleto() {
  const receberTotal = receber.reduce((s, v) => s + parseFloat(v.valor || 0), 0);
  const pagarTotal = pagar.reduce((s, v) => s + parseFloat(v.valor || 0), 0);
  const saldo = receberTotal - pagarTotal;
  const itensBaixos = estoque.filter(item => calcularStatusEstoque(item).texto === 'BAIXO').length;

  const html = `<div style="padding: 20px; font-family: Arial, sans-serif;">
          <h2 style="text-align: center; color: #2c3e50;">Relatório de Clientes</h2>
          <h4 style="text-align: center; color: #666;">MarcenariaPro - ${new Date().toLocaleDateString('pt-BR')}</h4>
          
          <div style="margin: 20px 0; padding: 15px; background: #f8f9fa; border-radius: 5px;">
            <p><strong>Total de Clientes:</strong> ${clientes.length}</p>
          </div>
          
          <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <thead>
              <tr style="background: #f8f9fa;">
                <th style="padding: 10px; text-align: left; border-bottom: 2px solid #ddd;">Nome</th>
                <th style="padding: 10px; text-align: left; border-bottom: 2px solid #ddd;">Telefone</th>
                <th style="padding: 10px; text-align: left; border-bottom: 2px solid #ddd;">E-mail</th>
                <th style="padding: 10px; text-align: left; border-bottom: 2px solid #ddd;">Data Cadastro</th>
              </tr>
            </thead>
            <tbody>
              ${clientes.map(cliente => `
                <tr>
                  <td style="padding: 8px; border-bottom: 1px solid #ddd;">${cliente.nome}</td>
                  <td style="padding: 8px; border-bottom: 1px solid #ddd;">${cliente.telefone || '-'}</td>
                  <td style="padding: 8px; border-bottom: 1px solid #ddd;">${cliente.email || '-'}</td>
                  <td style="padding: 8px; border-bottom: 1px solid #ddd;">${formatarData(cliente.dataCadastro)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>`; 

  const janela = window.open('', '_blank');
  janela.document.write(html);
  janela.document.close();
  setTimeout(() => {
    janela.print();
    janela.close();
  }, 500);
}

// As demais funções de impressão (imprimirRelatorioFinanceiro, imprimirRelatorioEstoque, imprimirRelatorioClientes) permanecem exatamente como no código original.

function imprimirRelatorioFinanceiro() {
  const receberTotal = receber.reduce((s, v) => s + parseFloat(v.valor || 0), 0);
      const pagarTotal = pagar.reduce((s, v) => s + parseFloat(v.valor || 0), 0);
      const saldo = receberTotal - pagarTotal;
      
      const html = `
        <div style="padding: 20px; font-family: Arial, sans-serif;">
          <h2 style="text-align: center; color: #2c3e50;">Relatório Financeiro</h2>
          <h4 style="text-align: center; color: #666;">MarcenariaPro - ${new Date().toLocaleDateString('pt-BR')}</h4>
          
          <div style="margin: 20px 0;">
            <h3>Contas a Receber (${receber.length})</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <thead>
                <tr style="background: #f8f9fa;">
                  <th style="padding: 10px; text-align: left; border-bottom: 2px solid #ddd;">Descrição</th>
                  <th style="padding: 10px; text-align: right; border-bottom: 2px solid #ddd;">Valor</th>
                </tr>
              </thead>
              <tbody>
                ${receber.map(conta => `
                  <tr>
                    <td style="padding: 8px; border-bottom: 1px solid #ddd;">${conta.descricao}</td>
                    <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">${formatarMoeda(conta.valor)}</td>
                  </tr>
                `).join('') || '<tr><td colspan="2" style="padding: 8px; text-align: center;">Nenhuma conta a receber</td></tr>'}
                <tr style="background: #f8f9fa;">
                  <td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>TOTAL:</strong></td>
                  <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;"><strong>${formatarMoeda(receberTotal)}</strong></td>
                </tr>
              </tbody>
            </table>
          </div>
          
          <div style="margin: 20px 0;">
            <h3>Contas a Pagar (${pagar.length})</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <thead>
                <tr style="background: #f8f9fa;">
                  <th style="padding: 10px; text-align: left; border-bottom: 2px solid #ddd;">Descrição</th>
                  <th style="padding: 10px; text-align: right; border-bottom: 2px solid #ddd;">Valor</th>
                </tr>
              </thead>
              <tbody>
                ${pagar.map(conta => `
                  <tr>
                    <td style="padding: 8px; border-bottom: 1px solid #ddd;">${conta.descricao}</td>
                    <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">${formatarMoeda(conta.valor)}</td>
                  </tr>
                `).join('') || '<tr><td colspan="2" style="padding: 8px; text-align: center;">Nenhuma conta a pagar</td></tr>'}
                <tr style="background: #f8f9fa;">
                  <td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>TOTAL:</strong></td>
                  <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;"><strong>${formatarMoeda(pagarTotal)}</strong></td>
                </tr>
              </tbody>
            </table>
          </div>
          
          <div style="margin: 30px 0; padding: 20px; background: ${saldo >= 0 ? '#d4edda' : '#f8d7da'}; border-radius: 5px;">
            <h3 style="text-align: center; margin: 0; color: ${saldo >= 0 ? '#155724' : '#721c24'}">
              Saldo Atual: ${formatarMoeda(saldo)}
            </h3>
          </div>
        </div>
      `;
      
      const janela = window.open('', '_blank');
      janela.document.write(html);
      janela.document.close();
      setTimeout(() => {
        janela.print();
        janela.close();
      }, 500);
    }

function imprimirRelatorioEstoque() {
  const itensBaixos = estoque.filter(item => calcularStatusEstoque(item).texto === 'BAIXO').length;
      const valorTotal = estoque.reduce((s, item) => s + (item.quantidade * (item.valorUnitario || 0)), 0);
      
      const html = `
        <div style="padding: 20px; font-family: Arial, sans-serif;">
          <h2 style="text-align: center; color: #2c3e50;">Relatório de Estoque</h2>
          <h4 style="text-align: center; color: #666;">MarcenariaPro - ${new Date().toLocaleDateString('pt-BR')}</h4>
          
          <div style="margin: 20px 0; padding: 15px; background: #f8f9fa; border-radius: 5px;">
            <p><strong>Total de Itens:</strong> ${estoque.length}</p>
            <p><strong>Itens com Estoque Baixo:</strong> <span style="${itensBaixos > 0 ? 'color: red;' : ''}">${itensBaixos}</span></p>
            <p><strong>Valor Total em Estoque:</strong> ${formatarMoeda(valorTotal)}</p>
          </div>
          
          <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <thead>
              <tr style="background: #f8f9fa;">
                <th style="padding: 10px; text-align: left; border-bottom: 2px solid #ddd;">Produto</th>
                <th style="padding: 10px; text-align: center; border-bottom: 2px solid #ddd;">Quantidade</th>
                <th style="padding: 10px; text-align: center; border-bottom: 2px solid #ddd;">Mínimo</th>
                <th style="padding: 10px; text-align: center; border-bottom: 2px solid #ddd;">Status</th>
              </tr>
            </thead>
            <tbody>
              ${estoque.map(item => {
                const status = calcularStatusEstoque(item);
                const rowStyle = status.texto === 'BAIXO' ? 'background: #f8d7da;' : status.texto === 'ATENÇÃO' ? 'background: #fff3cd;' : '';
                return `
                  <tr style="${rowStyle}">
                    <td style="padding: 8px; border-bottom: 1px solid #ddd;">${item.produto}</td>
                    <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: center;">${item.quantidade}</td>
                    <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: center;">${item.minimo}</td>
                    <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: center;">
                      <span style="display: inline-block; padding: 3px 8px; border-radius: 3px; 
                        background: ${status.texto === 'BAIXO' ? '#dc3545' : status.texto === 'ATENÇÃO' ? '#ffc107' : '#28a745'}; 
                        color: ${status.texto === 'ATENÇÃO' ? '#000' : '#fff'};">
                        ${status.texto}
                      </span>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
          
          ${itensBaixos > 0 ? `
            <div style="margin: 20px 0; padding: 15px; background: #fff3cd; border-radius: 5px;">
              <p style="margin: 0;"><strong>Atenção:</strong> ${itensBaixos} ${itensBaixos === 1 ? 'item necessita' : 'itens necessitam'} de reposição urgente.</p>
            </div>
          ` : ''}
        </div>
      `;
      
      const janela = window.open('', '_blank');
      janela.document.write(html);
      janela.document.close();
      setTimeout(() => {
        janela.print();
        janela.close();
      }, 500);
}

function imprimirRelatorioClientes() {
  const html = `
        <div style="padding: 20px; font-family: Arial, sans-serif;">
          <h2 style="text-align: center; color: #2c3e50;">Relatório de Clientes</h2>
          <h4 style="text-align: center; color: #666;">MarcenariaPro - ${new Date().toLocaleDateString('pt-BR')}</h4>
          
          <div style="margin: 20px 0; padding: 15px; background: #f8f9fa; border-radius: 5px;">
            <p><strong>Total de Clientes:</strong> ${clientes.length}</p>
          </div>
          
          <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <thead>
              <tr style="background: #f8f9fa;">
                <th style="padding: 10px; text-align: left; border-bottom: 2px solid #ddd;">Nome</th>
                <th style="padding: 10px; text-align: left; border-bottom: 2px solid #ddd;">Telefone</th>
                <th style="padding: 10px; text-align: left; border-bottom: 2px solid #ddd;">E-mail</th>
                <th style="padding: 10px; text-align: left; border-bottom: 2px solid #ddd;">Data Cadastro</th>
              </tr>
            </thead>
            <tbody>
              ${clientes.map(cliente => `
                <tr>
                  <td style="padding: 8px; border-bottom: 1px solid #ddd;">${cliente.nome}</td>
                  <td style="padding: 8px; border-bottom: 1px solid #ddd;">${cliente.telefone || '-'}</td>
                  <td style="padding: 8px; border-bottom: 1px solid #ddd;">${cliente.email || '-'}</td>
                  <td style="padding: 8px; border-bottom: 1px solid #ddd;">${formatarData(cliente.dataCadastro)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
      
      const janela = window.open('', '_blank');
      janela.document.write(html);
      janela.document.close();
      setTimeout(() => {
        janela.print();
        janela.close();
      }, 500);
}

// ==================== FUNÇÕES DE EXPORTAÇÃO ====================
function exportarDados() {
  const dados = {
    clientes, fornecedores, orcamentos, estoque, receber, pagar, patrimonio, contratos,
    dataExportacao: new Date().toISOString()
  };

  const json = JSON.stringify(dados, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `backup-marcenaria-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  Swal.fire('Sucesso!', 'Dados exportados com sucesso!', 'success');
}

// ==================== FUNÇÕES DE ESTATÍSTICAS ====================
// ==================== FUNÇÕES DE GRÁFICOS ====================
let chartsInstances = {};

function gerarGraficos() {
  if (secaoAtual !== 'relatorios') return;

  // Gráficos Financeiros
  gerarGraficoFinanceiroPizza();
  gerarGraficoFinanceiroLinha();
  gerarGraficoFinanceiroBarras();

  // Gráficos Estoque
  gerarGraficoEstoqueDoughnut();
  gerarGraficoEstoqueBarras();

  // Gráficos Clientes
  gerarGraficoClientesPizza();
  gerarGraficoClientesBarras();

  // Resumo Executivo
  atualizarResumoExecutivo();
  gerarGraficoRadarResumo();
}

function gerarGraficoFinanceiroPizza() {
  const ctx = document.getElementById('chartPizzaFinanceiro');
  if (!ctx) return;

  const receberTotal = receber.reduce((s, v) => s + parseFloat(v.valor || 0), 0);
  const pagarTotal = pagar.reduce((s, v) => s + parseFloat(v.valor || 0), 0);

  if (chartsInstances.pizzaFinanceiro) chartsInstances.pizzaFinanceiro.destroy();

  chartsInstances.pizzaFinanceiro = new Chart(ctx, {
    type: 'pie',
    data: {
      labels: ['Receitas', 'Despesas'],
      datasets: [{
        data: [receberTotal, pagarTotal],
        backgroundColor: ['#28a745', '#dc3545'],
        borderColor: ['#20c997', '#fd7e14'],
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: { position: 'bottom' },
        tooltip: {
          callbacks: {
            label: function(context) {
              return formatarMoeda(context.parsed);
            }
          }
        }
      }
    }
  });
}

function gerarGraficoFinanceiroLinha() {
  const ctx = document.getElementById('chartLinhaFinanceiro');
  if (!ctx) return;

  // Agrupar por mês
  const meses = {};
  const hoje = new Date();
  const ultimosMeses = 6;

  for (let i = ultimosMeses - 1; i >= 0; i--) {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
    const mesChave = d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
    meses[mesChave] = { receita: 0, despesa: 0 };
  }

  receber.forEach(r => {
    const data = new Date(r.dataCadastro || r.dataVencimento);
    const mesChave = data.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
    if (meses[mesChave]) meses[mesChave].receita += parseFloat(r.valor || 0);
  });

  pagar.forEach(p => {
    const data = new Date(p.dataCadastro || p.dataVencimento);
    const mesChave = data.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
    if (meses[mesChave]) meses[mesChave].despesa += parseFloat(p.valor || 0);
  });

  const labels = Object.keys(meses);
  const receitas = labels.map(m => meses[m].receita);
  const despesas = labels.map(m => meses[m].despesa);

  if (chartsInstances.linhaFinanceiro) chartsInstances.linhaFinanceiro.destroy();

  chartsInstances.linhaFinanceiro = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Receitas',
          data: receitas,
          borderColor: '#28a745',
          backgroundColor: 'rgba(40, 167, 69, 0.1)',
          fill: true,
          tension: 0.4
        },
        {
          label: 'Despesas',
          data: despesas,
          borderColor: '#dc3545',
          backgroundColor: 'rgba(220, 53, 69, 0.1)',
          fill: true,
          tension: 0.4
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: { position: 'bottom' },
        tooltip: {
          callbacks: {
            label: function(context) {
              return context.dataset.label + ': ' + formatarMoeda(context.parsed.y);
            }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: function(value) {
              return formatarMoeda(value);
            }
          }
        }
      }
    }
  });
}

function gerarGraficoFinanceiroBarras() {
  const ctx = document.getElementById('chartBarraFinanceiro');
  if (!ctx) return;

  const pagas = receber.filter(r => r.status === 'pago').length;
  const pendentes = receber.filter(r => r.status === 'pendente').length;
  const atrasadas = receber.filter(r => r.status === 'atrasado').length;

  if (chartsInstances.barraFinanceiro) chartsInstances.barraFinanceiro.destroy();

  chartsInstances.barraFinanceiro = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['Pagas', 'Pendentes', 'Atrasadas'],
      datasets: [{
        label: 'Contas a Receber',
        data: [pagas, pendentes, atrasadas],
        backgroundColor: ['#28a745', '#ffc107', '#dc3545'],
        borderColor: ['#20c997', '#fd7e14', '#fd7e14'],
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      indexAxis: 'x',
      plugins: {
        legend: { position: 'bottom' }
      },
      scales: {
        y: { beginAtZero: true }
      }
    }
  });
}

function gerarGraficoEstoqueDoughnut() {
  const ctx = document.getElementById('chartDoughnutEstoque');
  if (!ctx) return;

  const ok = estoque.filter(i => calcularStatusEstoque(i).texto === 'OK').length;
  const atencao = estoque.filter(i => calcularStatusEstoque(i).texto === 'ATENÇÃO').length;
  const baixo = estoque.filter(i => calcularStatusEstoque(i).texto === 'BAIXO').length;

  if (chartsInstances.doughnutEstoque) chartsInstances.doughnutEstoque.destroy();

  chartsInstances.doughnutEstoque = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['OK', 'Atenção', 'Baixo'],
      datasets: [{
        data: [ok, atencao, baixo],
        backgroundColor: ['#28a745', '#ffc107', '#dc3545'],
        borderColor: ['#20c997', '#fd7e14', '#fd7e14'],
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: { position: 'bottom' }
      }
    }
  });
}

function gerarGraficoEstoqueBarras() {
  const ctx = document.getElementById('chartBarraEstoque');
  if (!ctx) return;

  const top10 = estoque.slice(0, 10);
  const labels = top10.map(i => i.nome || i.codigo || 'Item');
  const quantidades = top10.map(i => parseInt(i.quantidade) || 0);

  if (chartsInstances.barraEstoque) chartsInstances.barraEstoque.destroy();

  chartsInstances.barraEstoque = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Quantidade',
        data: quantidades,
        backgroundColor: '#17a2b8',
        borderColor: '#0dcaf0',
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      indexAxis: 'y',
      scales: {
        x: { beginAtZero: true }
      },
      plugins: {
        legend: { display: false }
      }
    }
  });
}

function gerarGraficoClientesPizza() {
  const ctx = document.getElementById('chartPizzaClientes');
  if (!ctx) return;

  const cidades = {};
  clientes.forEach(c => {
    const cidade = c.cidade || 'Não informado';
    cidades[cidade] = (cidades[cidade] || 0) + 1;
  });

  const labels = Object.keys(cidades);
  const dados = Object.values(cidades);
  const cores = ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40'];

  if (chartsInstances.pizzaClientes) chartsInstances.pizzaClientes.destroy();

  chartsInstances.pizzaClientes = new Chart(ctx, {
    type: 'pie',
    data: {
      labels: labels,
      datasets: [{
        data: dados,
        backgroundColor: cores.slice(0, labels.length),
        borderColor: '#fff',
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: { position: 'bottom' }
      }
    }
  });
}

function gerarGraficoClientesBarras() {
  const ctx = document.getElementById('chartBarraClientes');
  if (!ctx) return;

  const meses = {};
  const hoje = new Date();
  const ultimosMeses = 6;

  for (let i = ultimosMeses - 1; i >= 0; i--) {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
    const mesChave = d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
    meses[mesChave] = 0;
  }

  clientes.forEach(c => {
    const data = new Date(c.dataCadastro);
    const mesChave = data.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
    if (meses[mesChave] !== undefined) meses[mesChave]++;
  });

  const labels = Object.keys(meses);
  const dados = Object.values(meses);

  if (chartsInstances.barraClientes) chartsInstances.barraClientes.destroy();

  chartsInstances.barraClientes = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Novos Clientes',
        data: dados,
        backgroundColor: '#007bff',
        borderColor: '#0056b3',
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      scales: { y: { beginAtZero: true } },
      plugins: {
        legend: { display: false }
      }
    }
  });
}

function atualizarResumoExecutivo() {
  const receberTotal = receber.reduce((s, v) => s + parseFloat(v.valor || 0), 0);
  const pagarTotal = pagar.reduce((s, v) => s + parseFloat(v.valor || 0), 0);
  const saldo = receberTotal - pagarTotal;
  const estoqueTotal = estoque.reduce((s, i) => s + (parseInt(i.quantidade) || 0), 0);

  document.getElementById('resumoReceitaTotal').textContent = formatarMoeda(receberTotal);
  document.getElementById('resumoDespesaTotal').textContent = formatarMoeda(pagarTotal);
  document.getElementById('resumoSaldoTotal').textContent = formatarMoeda(saldo);
  document.getElementById('resumoEstoqueTotal').textContent = estoqueTotal;
}

function gerarGraficoRadarResumo() {
  const ctx = document.getElementById('chartRadarResumo');
  if (!ctx) return;

  const maxClientes = Math.max(clientes.length * 2, 20);
  const maxOrcamentos = Math.max(orcamentos.length * 2, 20);
  const maxFornecedores = Math.max(fornecedores.length * 2, 20);

  if (chartsInstances.radarResumo) chartsInstances.radarResumo.destroy();

  chartsInstances.radarResumo = new Chart(ctx, {
    type: 'radar',
    data: {
      labels: ['Clientes', 'Fornecedores', 'Orçamentos', 'Itens Estoque', 'Contratos'],
      datasets: [{
        label: 'Quantidade de Registros',
        data: [
          clientes.length,
          fornecedores.length,
          orcamentos.length,
          estoque.length,
          contratos.length
        ],
        borderColor: '#667eea',
        backgroundColor: 'rgba(102, 126, 234, 0.2)',
        borderWidth: 2,
        fill: true,
        pointRadius: 5,
        pointBackgroundColor: '#667eea'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: { position: 'bottom' }
      },
      scales: {
        r: {
          beginAtZero: true,
          ticks: { stepSize: 5 }
        }
      }
    }
  });
}

function atualizarEstatisticas() {
  const elTotalClientes = $('#totalClientes');
  if (elTotalClientes) elTotalClientes.textContent = clientes.length;

  const elTotalOrcamentos = $('#totalOrcamentos');
  if (elTotalOrcamentos) elTotalOrcamentos.textContent = orcamentos.length;

  const elEstoqueBaixo = $('#estoqueBaixo');
  if (elEstoqueBaixo) elEstoqueBaixo.textContent = estoque.filter(item => calcularStatusEstoque(item).texto === 'BAIXO').length;

  const receberTotal = receber.reduce((s, v) => s + parseFloat(v.valor || 0), 0);
  const pagarTotal = pagar.reduce((s, v) => s + parseFloat(v.valor || 0), 0);
  const saldo = receberTotal - pagarTotal;

  const elSaldoResumo = $('#saldoResumo');
  if (elSaldoResumo) {
    elSaldoResumo.textContent = formatarMoeda(saldo);
    elSaldoResumo.className = saldo >= 0 ? 'saldo-positivo' : 'saldo-negativo';
  }
}

// ==================== MIGRAÇÃO DE DADOS ====================
function migrarEnderecos() {
  // Migrar clientes do formato antigo (endereco + bairro) para novo (rua + numero + complemento + localizacao)
  clientes = clientes.map(cliente => {
    if (cliente.endereco && !cliente.rua) {
      // Tentar fazer split do endereço antigo
      const partes = cliente.endereco.split(',').map(p => p.trim());
      return {
        ...cliente,
        rua: partes[0] || cliente.endereco,
        numero: partes[1] || '',
        complemento: partes[2] || '',
        localizacao: cliente.bairro || '',
        // Manter endereco para compatibilidade
        endereco: cliente.endereco,
        bairro: cliente.bairro
      };
    }
    return cliente;
  });

  // Migrar fornecedores do formato antigo (endereco + bairro) para novo (rua + numero + complemento + localizacao)
  fornecedores = fornecedores.map(fornecedor => {
    if (fornecedor.endereco && !fornecedor.rua) {
      // Tentar fazer split do endereço antigo
      const partes = fornecedor.endereco.split(',').map(p => p.trim());
      return {
        ...fornecedor,
        rua: partes[0] || fornecedor.endereco,
        numero: partes[1] || '',
        complemento: partes[2] || '',
        localizacao: fornecedor.bairro || '',
        // Manter endereco para compatibilidade
        endereco: fornecedor.endereco,
        bairro: fornecedor.bairro
      };
    }
    return fornecedor;
  });

  salvarDados();
}

// ==================== INICIALIZAÇÃO ====================
function inicializar() {
  // Migração de dados antigos
  migrarEnderecos();
  
  // Handler para logo - limpar estados ao clicar
  const logo = document.querySelector('.navbar-brand');
  if (logo) {
    logo.addEventListener('click', function() {
      // Remover classes residuais e resetar cor
      this.style.color = 'white';
    });
  }

  mostrarDashboard();

  if (clientes.length === 0) {
    clientes = [
      {
        id: gerarId(),
        nome: 'João Silva',
        telefone: '(11) 99999-8888',
        email: 'joao@exemplo.com',
        rua: 'Rua das Flores',
        numero: '123',
        complemento: '',
        localizacao: 'Centro',
        cidade: '',
        estado: '',
        dataCadastro: new Date().toISOString()
      }
    ];
  }

  if (estoque.length === 0) {
    estoque = [
      {
        id: gerarId(),
        produto: 'MDF 15mm',
        quantidade: 10,
        minimo: 20,
        fornecedor: 'Madeireira Central',
        valorUnitario: 89.90,
        status: 'ATENÇÃO',
        dataCadastro: new Date().toISOString()
      }
    ];
  }

  if (receber.length === 0) {
    receber = [
      {
        id: gerarId(),
        descricao: 'Mesa de Jantar',
        valor: 1200.00,
        data: new Date().toISOString()
      }
    ];
  }

  if (pagar.length === 0) {
    pagar = [
      {
        id: gerarId(),
        descricao: 'Compra de Madeira',
        valor: 850.00,
        data: new Date().toISOString()
      }
    ];
  }

  salvarDados();
  atualizarEstatisticas();
  // Botões de reload foram removidos
}

// ==================== SISTEMA DE ALERTAS AUTOMÁTICOS ====================
function verificarAlertas() {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  // Verificar contas a receber vencidas
  const receberVencidas = receber.filter(r => {
    if (r.status === 'pago') return false;
    const dataVenc = new Date(r.dataVencimento);
    dataVenc.setHours(0, 0, 0, 0);
    return dataVenc < hoje;
  });

  if (receberVencidas.length > 0) {
    mostrarNotificacao(
      `⚠️ ${receberVencidas.length} conta(s) a receber vencida(s)`,
      'aviso',
      5000
    );
  }

  // Verificar contas a receber próximas de vencer (próximos 3 dias)
  const receberProximas = receber.filter(r => {
    if (r.status === 'pago') return false;
    const dataVenc = new Date(r.dataVencimento);
    dataVenc.setHours(0, 0, 0, 0);
    const em3Dias = new Date(hoje);
    em3Dias.setDate(em3Dias.getDate() + 3);
    return dataVenc >= hoje && dataVenc <= em3Dias;
  });

  if (receberProximas.length > 0) {
    mostrarNotificacao(
      `💰 ${receberProximas.length} conta(s) a receber vencendo em breve`,
      'info',
      4000
    );
  }

  // Verificar contas a pagar vencidas
  const pagarVencidas = pagar.filter(p => {
    if (p.status === 'pago') return false;
    const dataVenc = new Date(p.dataVencimento);
    dataVenc.setHours(0, 0, 0, 0);
    return dataVenc < hoje;
  });

  if (pagarVencidas.length > 0) {
    mostrarNotificacao(
      `❌ ${pagarVencidas.length} conta(s) a pagar vencida(s)`,
      'erro',
      5000
    );
  }

  // Verificar contas a pagar próximas de vencer (próximos 3 dias)
  const pagarProximas = pagar.filter(p => {
    if (p.status === 'pago') return false;
    const dataVenc = new Date(p.dataVencimento);
    dataVenc.setHours(0, 0, 0, 0);
    const em3Dias = new Date(hoje);
    em3Dias.setDate(em3Dias.getDate() + 3);
    return dataVenc >= hoje && dataVenc <= em3Dias;
  });

  if (pagarProximas.length > 0) {
    mostrarNotificacao(
      `⏰ ${pagarProximas.length} conta(s) a pagar vencendo em breve`,
      'aviso',
      4000
    );
  }

  // Verificar itens em falta no estoque (quantidade = 0)
  const estoqueFaltando = estoque.filter(item => {
    const qtd = parseInt(item.quantidade) || 0;
    return qtd === 0;
  });

  if (estoqueFaltando.length > 0) {
    mostrarNotificacao(
      `📦 ${estoqueFaltando.length} item(ns) SEM estoque`,
      'erro',
      5000
    );
  }

  // Verificar itens com estoque baixo
  const estoqueBaixo = estoque.filter(item => {
    const qtd = parseInt(item.quantidade) || 0;
    const minimo = parseInt(item.minimo) || 5;
    return qtd > 0 && qtd <= minimo;
  });

  if (estoqueBaixo.length > 0) {
    mostrarNotificacao(
      `⚠️ ${estoqueBaixo.length} item(ns) com estoque BAIXO`,
      'aviso',
      4000
    );
  }
}

// Verificar alertas periodicamente (a cada 5 minutos)
setInterval(verificarAlertas, 5 * 60 * 1000);

document.addEventListener('DOMContentLoaded', function() {
  inicializar();
  atualizarBotaoRefazer();
  carregarConfiguracoes();
  verificarAlertas(); // Verificar alertas ao carregar
  // vincula botões de configurações
  document.getElementById('btnExportarBackup')?.addEventListener('click', exportarBackup);
  document.getElementById('btnImportarBackup')?.addEventListener('click', () => document.getElementById('inputImportBackup')?.click());
  document.getElementById('inputImportBackup')?.addEventListener('change', function(e){ if (e.target.files && e.target.files[0]) importarBackup(e.target.files[0]); });
  document.getElementById('btnLimparLixeira')?.addEventListener('click', limparLixeira);
  document.getElementById('btnLimparDados')?.addEventListener('click', limparTodosDados);
  document.getElementById('btnSalvarConfiguracoes')?.addEventListener('click', salvarConfiguracoes);
  
  // Event listener para mudar tema em tempo real
  document.getElementById('cfgTema')?.addEventListener('change', function() {
    aplicarTema(this.value);
  });
});

// ==================== BOTÕES DE RELOAD POR TABELA ====================
// Função de reload de seções removida - botões não serão mais adicionados automaticamente

function reloadSecao(secao) {
  switch (secao) {
    case 'clientes':
      carregarClientes();
      break;
    case 'fornecedores':
      carregarFornecedores();
      break;
    case 'orcamentos':
      carregarOrcamentos();
      break;
    case 'estoque':
      carregarEstoque();
      break;
    case 'financeiro':
      carregarFinanceiro();
      break;
    case 'patrimonio':
      carregarPatrimonio();
      break;
    case 'contratos':
      carregarContratos();
      break;
    case 'relatorios':
      atualizarEstatisticas();
      break;
    default:
      // tenta mostrar a seção (se existir)
      const el = document.getElementById(secao);
      if (el) {
        // dispara mostrarSecao para re-executar carregamento
        mostrarSecao(secao);
      }
  }
  // feedback visual rápido
  const toast = document.createElement('div');
  toast.className = 'reload-toast';
  toast.style.position = 'fixed';
  toast.style.right = '16px';
  toast.style.bottom = '16px';
  toast.style.padding = '8px 12px';
  toast.style.background = '#222';
  toast.style.color = '#fff';
  toast.style.borderRadius = '6px';
  toast.style.zIndex = 9999;
  toast.textContent = 'Tabela recarregada';
  document.body.appendChild(toast);
  setTimeout(() => document.body.removeChild(toast), 1200);
}

document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape' && celulaEditando) {
    finalizarEdicaoCelula(false);
  }
});

// Delegated handler para botões de excluir nas tabelas
document.addEventListener('click', function(e) {
  const btn = e.target.closest('.btn-excluir');
  if (!btn) return;

  const tipo = btn.dataset.deleteType;
  const id = btn.dataset.id;

  if (!tipo || !id) return;

  // Verificar se confirmação é necessária
  if (configuracoes.confirmDelete) {
    Swal.fire({
      title: 'Tem certeza?',
      text: 'Você não poderá recuperar este item depois de excluído!',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc3545',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Sim, excluir!',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (result.isConfirmed) {
        executarExclusao(tipo, id);
      }
    });
  } else {
    executarExclusao(tipo, id);
  }
});

function executarExclusao(tipo, id) {
  switch (tipo) {
    case 'cliente':
      excluirCliente(id);
      break;
    case 'fornecedor':
      excluirFornecedor(id);
      break;
    case 'orcamento':
      excluirOrcamento(id);
      break;
    case 'estoque':
      excluirItemEstoque(id);
      break;
    case 'patrimonio':
      excluirPatrimonio(id);
      break;
    case 'contrato':
      excluirContrato(id);
      break;
    case 'receber':
      removerContaReceber(id);
      break;
    case 'pagar':
      removerContaPagar(id);
      break;
  }
}

// Listener genérico para botões de salvar: após o handler original rodar fechamos modal e recarregamos seção
document.addEventListener('click', function(e) {
  const btn = e.target.closest('[data-save-section]');
  if (!btn) return;
  const sec = btn.dataset.saveSection;
  const modalId = btn.dataset.modalId;
  // executar um pouco depois para garantir que o handler de salvar já atualizou os dados
  setTimeout(() => {
    if (modalId) {
      const modalEl = document.getElementById(modalId);
      try { bootstrap.Modal.getInstance(modalEl)?.hide(); } catch (err) { /* ignore */ }
    }
    if (sec && typeof reloadSecao === 'function') {
      reloadSecao(sec);
    }
    if (typeof atualizarEstatisticas === 'function') atualizarEstatisticas();
  }, 60);
});

// Máscara CPF
document.getElementById('novoClienteCpf')?.addEventListener('input', function(e) {
  let v = e.target.value.replace(/\D/g, '');
  v = v.replace(/(\d{3})(\d)/, '$1.$2');
  v = v.replace(/(\d{3})\.(\d{3})(\d)/, '$1.$2.$3');
  v = v.replace(/(\d{3})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3-$4');
  e.target.value = v.slice(0, 14);
});

// Máscara Telefone (já existe, mas reforçando)
document.getElementById('novoClienteTelefone')?.addEventListener('input', function(e) {
  let v = e.target.value.replace(/\D/g, '');
  v = v.replace(/^(\d{2})(\d)/g,"($1) $2");
  v = v.replace(/(\d)(\d{4})$/,"$1-$2");
  if (v.length > 14) v = v.substring(0,14);
  e.target.value = v;
});

// Máscara telefone fornecedor
document.getElementById('novoFornecedorTelefone')?.addEventListener('input', function(e) {
  let v = e.target.value.replace(/\D/g, '');
  if (v.length <= 10) {
    v = v.replace(/^(\d{2})(\d)/g, '($1) $2');
    v = v.replace(/(\d{4})(\d)/, '$1-$2');
  } else {
    v = v.replace(/^(\d{2})(\d)/g, '($1) $2');
    v = v.replace(/(\d{5})(\d)/, '$1-$2');
  }
  e.target.value = v;
});

// Máscara CNPJ para fornecedor
document.getElementById('novoFornecedorCnpj')?.addEventListener('input', function(e) {
    let v = e.target.value.replace(/\D/g, '');
    if (v.length <= 14) {
        v = v.replace(/^(\d{2})(\d)/, '$1.$2');
        v = v.replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3');
        v = v.replace(/\.(\d{3})(\d)/, '.$1/$2');
        v = v.replace(/(\d{4})(\d)/, '$1-$2');
    }
    e.target.value = v;
});

// Máscara monetária simples
function aplicarMascaraMoeda(input) {
  input.addEventListener('input', function(e) {
    let valor = e.target.value.replace(/\D/g, '');
    valor = (valor / 100).toFixed(2).replace('.', ',');
    valor = valor.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    e.target.value = valor ? 'R$ ' + valor : '';
  });
}

// Aplicar máscaras de moeda somente se os inputs existirem
{
  const elOrc = document.getElementById('novoOrcamentoValor');
  const elEst = document.getElementById('novoEstoqueValorUnitario');
  const elPat = document.getElementById('novoPatrimonioValor');
  const elRec = document.getElementById('novoReceberValor');
  const elPag = document.getElementById('novoPagarValor');

  if (elOrc) aplicarMascaraMoeda(elOrc);
  if (elEst) aplicarMascaraMoeda(elEst);
  if (elPat) aplicarMascaraMoeda(elPat);
  if (elRec) aplicarMascaraMoeda(elRec);
  if (elPag) aplicarMascaraMoeda(elPag);
}

// Aplicar máscara em qualquer campo com class="moeda" quando aparecer
document.addEventListener('input', function(e) {
  if (e.target && e.target.classList && e.target.classList.contains('moeda')) {
    let valor = e.target.value.replace(/\D/g, '');
    valor = (valor / 100).toFixed(2).replace('.', ',');
    valor = valor.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    e.target.value = valor ? 'R$ ' + valor : '';
  }
});

document.getElementById('btnSalvarNovoFornecedor')?.addEventListener('click', () => {
  // Campos obrigatórios
  const nome        = document.getElementById('novoFornecedorNome').value.trim();
  const cnpj        = document.getElementById('novoFornecedorCnpj').value.trim();
  const telefone    = document.getElementById('novoFornecedorTelefone').value.trim();
  const email       = document.getElementById('novoFornecedorEmail').value.trim();
  const fornecimento = document.getElementById('novoFornecedorFornecimento').value.trim();

  if (!nome || !cnpj || !telefone || !email || !fornecimento) {
    Swal.fire({
      title: 'Campos obrigatórios',
      text: 'Preencha Nome, CNPJ, Telefone, E-mail e Principal fornecimento',
      icon: 'warning',
      confirmButtonText: 'Entendi'
    });
    return;
  }

  // Validação básica de e-mail
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    Swal.fire('E-mail inválido', 'Por favor, verifique o formato do e-mail', 'warning');
    return;
  }

  const fornecedor = {
    id: gerarId(),
    nome,
    cnpj,
    telefone,
    email,
    fornecimento,
    rua:        document.getElementById('novoFornecedorRua').value.trim()       || '',
    numero:     document.getElementById('novoFornecedorNumero').value.trim()    || '',
    complemento: document.getElementById('novoFornecedorComplemento').value.trim() || '',
    localizacao: document.getElementById('novoFornecedorLocalizacao').value.trim() || '',
    cidade:     document.getElementById('novoFornecedorCidade').value.trim()     || '',
    estado:     document.getElementById('novoFornecedorEstado').value            || '',
    dataCadastro: new Date().toISOString()
  };

  fornecedores.push(fornecedor);
  salvarDados();
  carregarFornecedores();

  // Atualiza selects que listam fornecedores (estoque, financeiro, patrimônio)
  atualizarSelectFornecedoresEstoque();
  preencherSelectFornecedores('novoPagarFornecedor');
  preencherSelectFornecedores('novoPatrimonioFornecedor');
  preencherSelectFornecedores('novoEstoqueFornecedor');

  bootstrap.Modal.getInstance(document.getElementById('modalNovoFornecedor')).hide();

  Swal.fire({
    title: 'Fornecedor cadastrado!',
    text: 'O novo fornecedor foi adicionado com sucesso.',
    icon: 'success',
    timer: 1800,
    showConfirmButton: false
  });
});

document.getElementById('btnSalvarNovoPatrimonio')?.addEventListener('click', function() {
    const codigo       = document.getElementById('novoPatrimonioCodigo')?.value.trim();
    const nome         = document.getElementById('novoPatrimonioNome')?.value.trim();
    const categoria    = document.getElementById('novoPatrimonioCategoria')?.value;
    const dataAquisicao = document.getElementById('novoPatrimonioDataAquisicao')?.value;
    const fornecedorId = document.getElementById('novoPatrimonioFornecedor')?.value;
    const localizacao  = document.getElementById('novoPatrimonioLocalizacao')?.value.trim();
    const estado       = document.getElementById('novoPatrimonioEstado')?.value;
    const vidaUtil     = parseInt(document.getElementById('novoPatrimonioVidaUtil')?.value) || 0;

    if (!codigo || !nome || !categoria || !dataAquisicao || !localizacao || !estado || vidaUtil <= 0) {
        Swal.fire({
            title: 'Atenção!',
            text: 'Preencha todos os campos obrigatórios corretamente.',
            icon: 'warning'
        });
        return;
    }

    const novoItem = {
        id: gerarId(),
        codigo,
        nome,
        categoria,
        dataAquisicao,
        fornecedorId: fornecedorId || null,
        fornecedorNome: fornecedorId ? (fornecedores.find(f => f.id === fornecedorId)?.nome || '') : '',
        localizacao,
        estado,
        vidaUtil,
        dataCadastro: new Date().toISOString()
    };

    patrimonio.push(novoItem);
    salvarDados();
    carregarPatrimonio();

    const modal = bootstrap.Modal.getInstance(document.getElementById('modalNovoPatrimonio'));
    modal?.hide();

    Swal.fire({
        title: 'Sucesso!',
        text: 'Patrimônio cadastrado com sucesso!',
        icon: 'success',
        timer: 1800,
        showConfirmButton: false
    });

    console.log('Patrimônio salvo:', novoItem);
});

document.getElementById('btnSalvarNovoContrato')?.addEventListener('click', () => {
  const clienteId = document.getElementById('novoContratoCliente').value;
  const descricao = document.getElementById('novoContratoDescricao').value.trim();
  if (!clienteId || !descricao) return Swal.fire('Atenção', 'Cliente e descrição obrigatórios!', 'warning');
  const cliente = clientes.find(c => c.id === clienteId);
  contratos.push({
    id: gerarId(),
    clienteId,
    clienteNome: cliente.nome,
    descricao,
    data: new Date().toISOString(),
    status: document.getElementById('novoContratoStatus').value
  });
  salvarDados(); carregarContratos();
  bootstrap.Modal.getInstance(document.getElementById('modalNovoContrato')).hide();
  Swal.fire('Sucesso!', 'Contrato criado!', 'success');
});

// Corrige possíveis backdrops ou bloqueio de tela quando modais são fechados/cancelados
document.addEventListener('hidden.bs.modal', function(e) {
  // Aguarda um pouco para permitir que o Bootstrap finalize limpeza padrão
  setTimeout(() => {
    // remove backdrops extras, se houver
    const backdrops = document.querySelectorAll('.modal-backdrop');
    backdrops.forEach(b => b.remove());
    // garante que a página não fique travada
    document.body.classList.remove('modal-open');
    document.body.style.overflow = '';
    document.body.style.paddingRight = '';
  }, 50);
});

// Caso o botão 'Cancelar' use data-bs-dismiss, limpamos quaisquer sobras logo após o clique
document.addEventListener('click', function(e) {
  const btn = e.target.closest('[data-bs-dismiss="modal"]');
  if (!btn) return;
  setTimeout(() => {
    const backdrops = document.querySelectorAll('.modal-backdrop');
    backdrops.forEach(b => b.remove());
    document.body.classList.remove('modal-open');
    document.body.style.overflow = '';
    document.body.style.paddingRight = '';
  }, 50);
});

// Funções rápidas para atalhos
function adicionarClienteRapido() { adicionarCliente(); }
function adicionarOrcamentoRapido() { adicionarOrcamento(); }
function adicionarEstoqueRapido() { adicionarItemEstoque(); }