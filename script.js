// ==================== VARIÁVEIS GLOBAIS ====================
const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

let secaoAtual = 'dashboard';
let editandoClienteId = null;
let editandoOrcamentoId = null;
let celulaEditando = null;
let modoEdicaoTodos = false;

let clientes = JSON.parse(localStorage.getItem('clientes') || '[]');
let fornecedores = JSON.parse(localStorage.getItem('fornecedores') || '[]');
let orcamentos = JSON.parse(localStorage.getItem('orcamentos') || '[]');
let estoque = JSON.parse(localStorage.getItem('estoque') || '[]');
let receber = JSON.parse(localStorage.getItem('receber') || '[]');
let pagar = JSON.parse(localStorage.getItem('pagar') || '[]');
let patrimonio = JSON.parse(localStorage.getItem('patrimonio') || '[]');
let contratos = JSON.parse(localStorage.getItem('contratos') || '[]');

// ==================== SISTEMA DE EDIÇÃO DE CÉLULAS ====================

function ativarEdicaoTodos(secao) {
  modoEdicaoTodos = !modoEdicaoTodos;
  const botao = $(`#${secao} .btn-outline-secondary`) || $(`#${secao} .btn-outline-primary`);

  if (modoEdicaoTodos) {
    botao.classList.remove('btn-outline-secondary', 'btn-outline-primary');
    botao.classList.add('btn-success');
    botao.innerHTML = '<i class="bi bi-check-square me-2"></i>Salvar Tudo';

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
    botao.classList.remove('btn-success');
    if (secao === 'financeiro') {
      botao.classList.add('btn-outline-primary');
    } else {
      botao.classList.add('btn-outline-secondary');
    }
    botao.innerHTML = '<i class="bi bi-pencil-square me-2"></i>Editar Tudo';

    $$(`#${secao} .editing-todos`).forEach(cell => {
      cell.classList.remove('editing-todos');
    });

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
    if (tipo === 'currency') {
      novoValor = formatarMoeda(parseFloat(novoValor) || 0);
    } else if (tipo === 'number') {
      novoValor = parseInt(novoValor) || 0;
    }

    cell.textContent = novoValor;

    atualizarDado(itemId, campo, novoValor);
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
  $('#dashboard').style.display = 'block';
  atualizarEstatisticas();
  window.scrollTo(0, 0);
}

function mostrarSecao(secao) {
  secaoAtual = secao;
  atualizarNavbar();
  esconderTodasSecoes();
  $(`#${secao}`).style.display = 'block';

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
    case 'contratos':
      carregarContratos();
      break;
    case 'relatorios':
      atualizarEstatisticas();
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

function salvarDados() {
  localStorage.setItem('clientes', JSON.stringify(clientes));
  localStorage.setItem('fornecedores', JSON.stringify(fornecedores));
  localStorage.setItem('orcamentos', JSON.stringify(orcamentos));
  localStorage.setItem('estoque', JSON.stringify(estoque));
  localStorage.setItem('receber', JSON.stringify(receber));
  localStorage.setItem('pagar', JSON.stringify(pagar));
  localStorage.setItem('patrimonio', JSON.stringify(patrimonio));
  localStorage.setItem('contratos', JSON.stringify(contratos));
  atualizarEstatisticas();
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
  const cnpj         = document.getElementById('novoClienteCnpj').value.trim();
  const email        = document.getElementById('novoClienteEmail').value.trim();
  const telefone     = document.getElementById('novoClienteTelefone').value.trim();
  const fornecimento = document.getElementById('novoClienteFornecimento').value.trim();
  const endereco     = document.getElementById('novoClienteEndereco').value.trim();
  const bairro       = document.getElementById('novoClienteBairro').value.trim();
  const cidade       = document.getElementById('novoClienteCidade').value.trim();
  const estado       = document.getElementById('novoClienteEstado').value;

  // Validação básica
  if (!nome || !cnpj || !email || !telefone || !fornecimento || 
      !endereco || !bairro || !cidade || !estado) {
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
    cnpj,
    email,
    telefone,
    fornecimento,
    endereco,
    bairro,
    cidade,
    estado,
    dataCadastro: new Date().toISOString()
  };

  clientes.push(novoCliente);
  salvarDados();
  carregarClientes();

  bootstrap.Modal.getInstance(document.getElementById('modalNovoCliente')).hide();

  Swal.fire({
    title: 'Cliente cadastrado!',
    text: `${nome} foi adicionado com sucesso`,
    icon: 'success',
    timer: 2000,
    showConfirmButton: false
  });
});

function excluirCliente(id) {
  Swal.fire({
    title: 'Tem certeza?',
    text: "Esta ação não pode ser desfeita!",
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#d33',
    cancelButtonColor: '#3085d6',
    confirmButtonText: 'Sim, excluir!',
    cancelButtonText: 'Cancelar'
  }).then((result) => {
    if (result.isConfirmed) {
      clientes = clientes.filter(c => c.id !== id);
      salvarDados();
      carregarClientes();
      Swal.fire('Excluído!', 'Cliente removido com sucesso.', 'success');
    }
  });
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
      (c.telefone && c.telefone.includes(filtro))
    );
  }

  if (clientesFiltrados.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="11" class="text-center py-4">
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
    <td class="editable-cell" data-id="cli_${cliente.id}" data-field="cnpj">${cliente.cnpj || '-'}</td>
    <td class="editable-cell" data-id="cli_${cliente.id}" data-field="telefone">${cliente.telefone || ''}</td>
    <td class="editable-cell" data-id="cli_${cliente.id}" data-field="email">${cliente.email || ''}</td>
    <td class="editable-cell" data-id="cli_${cliente.id}" data-field="fornecimento">${cliente.fornecimento || '-'}</td>
    <td class="editable-cell" data-id="cli_${cliente.id}" data-field="endereco">${cliente.endereco || '-'}</td>
    <td class="editable-cell" data-id="cli_${cliente.id}" data-field="bairro">${cliente.bairro || '-'}</td>
    <td class="editable-cell" data-id="cli_${cliente.id}" data-field="cidade">${cliente.cidade || '-'}</td>
    <td class="editable-cell" data-id="cli_${cliente.id}" data-field="estado">${cliente.estado || '-'}</td>
    <td class="non-editable-cell">${formatarData(cliente.dataCadastro)}</td>
    <td class="no-print">
      <button class="btn btn-sm btn-outline-danger" onclick="excluirCliente('${cliente.id}')">
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
                <td colspan="11" class="text-center py-4">
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
            <td class="editable-cell" data-id="for_${fornecedor.id}" data-field="endereco">${fornecedor.endereco || '-'}</td>
            <td class="editable-cell" data-id="for_${fornecedor.id}" data-field="bairro">${fornecedor.bairro || '-'}</td>
            <td class="editable-cell" data-id="for_${fornecedor.id}" data-field="cidade">${fornecedor.cidade || '-'}</td>
            <td class="editable-cell" data-id="for_${fornecedor.id}" data-field="estado">${fornecedor.estado || '-'}</td>
            <td class="non-editable-cell">${formatarData(fornecedor.dataCadastro)}</td>
            <td class="no-print">
                <button class="btn btn-sm btn-outline-danger" onclick="excluirFornecedor('${fornecedor.id}')">
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
  Swal.fire({
    title: 'Excluir Fornecedor',
    text: "Tem certeza que deseja excluir este fornecedor?",
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'Sim, excluir',
    cancelButtonText: 'Cancelar'
  }).then((result) => {
    if (result.isConfirmed) {
      fornecedores = fornecedores.filter(f => f.id !== id);
      salvarDados();
      carregarFornecedores();
      Swal.fire('Excluído!', 'Fornecedor removido com sucesso.', 'success');
    }
  });
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
          <button class="btn btn-sm btn-outline-danger" onclick="excluirOrcamento('${orcamento.id}')">
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
  Swal.fire({
    title: 'Excluir Orçamento',
    text: "Tem certeza que deseja excluir este orçamento?",
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'Sim, excluir',
    cancelButtonText: 'Cancelar'
  }).then((result) => {
    if (result.isConfirmed) {
      orcamentos = orcamentos.filter(o => o.id !== id);
      salvarDados();
      carregarOrcamentos();
      Swal.fire('Excluído!', 'Orçamento removido com sucesso.', 'success');
    }
  });
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
  const valorUnitarioStr = document.getElementById('novoEstoqueValorUnitario').value
    .replace(/[^^\d,]/g, '').replace(',', '.').trim();
  const valorUnitario = parseFloat(valorUnitarioStr) || 0;

  const fornecedorId = document.getElementById('novoEstoqueFornecedor')?.value || '';
  const fornecedorNome = fornecedorId ? (fornecedores.find(f => f.id === fornecedorId)?.nome || '') : document.getElementById('novoEstoqueFornecedorAlt')?.value.trim() || '';

  const item = {
    id: gerarId(),
    produto,
    quantidade,
    minimo,
    valorUnitario,
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
        <td colspan="7" class="text-center py-4">
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
        <td class="editable-cell" data-id="est_${item.id}" data-field="produto">${item.produto}</td>
        <td class="editable-cell" data-id="est_${item.id}" data-field="quantidade" data-type="number">${item.quantidade}</td>
        <td class="editable-cell" data-id="est_${item.id}" data-field="minimo" data-type="number">${item.minimo}</td>
        <td class="editable-cell" data-id="est_${item.id}" data-field="fornecedor">${item.fornecedor || ''}</td>
        <td class="editable-cell" data-id="est_${item.id}" data-field="valorUnitario" data-type="currency">${formatarMoeda(item.valorUnitario)}</td>
        <td class="non-editable-cell">
          <span class="badge ${status.classe}">${status.texto}</span>
        </td>
        <td class="no-print">
          <button class="btn btn-sm btn-outline-danger" onclick="excluirItemEstoque('${item.id}')">
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
  Swal.fire({
    title: 'Excluir Item',
    text: "Tem certeza que deseja excluir este item do estoque?",
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'Sim, excluir',
    cancelButtonText: 'Cancelar'
  }).then((result) => {
    if (result.isConfirmed) {
      estoque = estoque.filter(e => e.id !== id);
      salvarDados();
      carregarEstoque();
      Swal.fire('Excluído!', 'Item removido do estoque.', 'success');
    }
  });
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
        <button class="btn btn-sm btn-outline-danger" onclick="removerContaReceber('${conta.id}')">
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
        <button class="btn btn-sm btn-outline-danger" onclick="removerContaPagar('${conta.id}')">
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
  receber = receber.filter(c => c.id !== id);
  salvarDados();
  carregarFinanceiro();
  Swal.fire('Removido!', 'Conta a receber removida.', 'success');
}

function removerContaPagar(id) {
  pagar = pagar.filter(c => c.id !== id);
  salvarDados();
  carregarFinanceiro();
  Swal.fire('Removido!', 'Conta a pagar removida.', 'success');
}

function atualizarSaldo() {
  const totalReceber = receber.reduce((s, v) => s + parseFloat(v.valor || 0), 0);
  const totalPagar = pagar.reduce((s, v) => s + parseFloat(v.valor || 0), 0);
  const saldo = totalReceber - totalPagar;

  $('#totalReceitas').textContent = formatarMoeda(totalReceber);
  $('#totalDespesas').textContent = formatarMoeda(totalPagar);
  $('#saldoAtual').textContent = formatarMoeda(saldo);

  const alert = $('#saldoAlert');
  alert.className = `alert ${saldo >= 0 ? 'alert-success' : 'alert-danger'}`;
  $('#saldoAtual').className = saldo >= 0 ? 'saldo-positivo' : 'saldo-negativo';
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
        <td colspan="6" class="text-center py-4">
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
        <td class="editable-cell" data-id="pat_${item.id}" data-field="nome">${item.nome}</td>
        <td class="non-editable-cell">${formatarData(item.dataAquisicao)}</td>
        <td class="editable-cell" data-id="pat_${item.id}" data-field="valor" data-type="currency">${formatarMoeda(item.valor)}</td>
        <td class="editable-cell" data-id="pat_${item.id}" data-field="departamento">${item.departamento}</td>
        <td class="editable-cell" data-id="pat_${item.id}" data-field="estado" data-type="select-estado">
          <span class="badge ${estadoClass}">${item.estado}</span>
        </td>
        <td class="no-print">
          <button class="btn btn-sm btn-outline-danger" onclick="excluirPatrimonio('${item.id}')">
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
  Swal.fire({
    title: 'Excluir Item',
    text: "Tem certeza que deseja excluir este item do patrimônio?",
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'Sim, excluir',
    cancelButtonText: 'Cancelar'
  }).then((result) => {
    if (result.isConfirmed) {
      patrimonio = patrimonio.filter(p => p.id !== id);
      salvarDados();
      carregarPatrimonio();
      Swal.fire('Excluído!', 'Item removido do patrimônio.', 'success');
    }
  });
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
            <button class="btn btn-sm btn-outline-danger" onclick="excluirContrato('${contrato.id}')">
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
  Swal.fire({
    title: 'Excluir Contrato',
    text: "Tem certeza que deseja excluir este contrato?",
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'Sim, excluir',
    cancelButtonText: 'Cancelar'
  }).then((result) => {
    if (result.isConfirmed) {
      contratos = contratos.filter(c => c.id !== id);
      salvarDados();
      carregarContratos();
      Swal.fire('Excluído!', 'Contrato removido com sucesso.', 'success');
    }
  });
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
function atualizarEstatisticas() {
  $('#totalClientes').textContent = clientes.length;
  $('#totalOrcamentos').textContent = orcamentos.length;
  $('#estoqueBaixo').textContent = estoque.filter(item => calcularStatusEstoque(item).texto === 'BAIXO').length;

  const receberTotal = receber.reduce((s, v) => s + parseFloat(v.valor || 0), 0);
  const pagarTotal = pagar.reduce((s, v) => s + parseFloat(v.valor || 0), 0);
  const saldo = receberTotal - pagarTotal;
  $('#saldoResumo').textContent = formatarMoeda(saldo);

  const elementoSaldo = $('#saldoResumo');
  elementoSaldo.className = saldo >= 0 ? 'saldo-positivo' : 'saldo-negativo';
}

// ==================== INICIALIZAÇÃO ====================
function inicializar() {
  mostrarDashboard();

  if (clientes.length === 0) {
    clientes = [
      {
        id: gerarId(),
        nome: 'João Silva',
        telefone: '(11) 99999-8888',
        email: 'joao@exemplo.com',
        endereco: 'Rua das Flores, 123',
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
}

document.addEventListener('DOMContentLoaded', inicializar);

document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape' && celulaEditando) {
    finalizarEdicaoCelula(false);
  }
});

// Máscara CNPJ
document.getElementById('novoClienteCnpj')?.addEventListener('input', function(e) {
  let v = e.target.value.replace(/\D/g, '');
  if (v.length <= 14) {
    v = v.replace(/^(\d{2})(\d)/, "$1.$2");
    v = v.replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3");
    v = v.replace(/\.(\d{3})(\d)/, ".$1/$2");
    v = v.replace(/(\d{4})(\d)/, "$1-$2");
  }
  e.target.value = v;
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
    endereco:   document.getElementById('novoFornecedorEndereco').value.trim()   || '',
    bairro:     document.getElementById('novoFornecedorBairro').value.trim()     || '',
    cidade:     document.getElementById('novoFornecedorCidade').value.trim()     || '',
    estado:     document.getElementById('novoFornecedorEstado').value            || '',
    dataCadastro: new Date().toISOString()
  };

  fornecedores.push(fornecedor);
  salvarDados();
  carregarFornecedores();

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

document.getElementById('btnSalvarNovoReceber')?.addEventListener('click', () => {
  const descricao = document.getElementById('novoReceberDescricao').value.trim();
  const valorStr = document.getElementById('novoReceberValor').value.replace(/[^\d,]/g, '').replace(',','.');
  if (!descricao || !valorStr) return Swal.fire('Atenção', 'Descrição e valor obrigatórios!', 'warning');
  receber.push({ id: gerarId(), descricao, valor: parseFloat(valorStr), data: new Date().toISOString() });
  salvarDados(); carregarFinanceiro();
  bootstrap.Modal.getInstance(document.getElementById('modalNovoReceber')).hide();
  Swal.fire('Sucesso!', 'Conta a receber adicionada!', 'success');
});

document.getElementById('btnSalvarNovoPagar')?.addEventListener('click', () => {
  const descricao = document.getElementById('novoPagarDescricao').value.trim();
  const valorStr = document.getElementById('novoPagarValor').value.replace(/[^\d,]/g, '').replace(',','.');
  if (!descricao || !valorStr) return Swal.fire('Atenção', 'Descrição e valor obrigatórios!', 'warning');
  pagar.push({ id: gerarId(), descricao, valor: parseFloat(valorStr), data: new Date().toISOString() });
  salvarDados(); carregarFinanceiro();
  bootstrap.Modal.getInstance(document.getElementById('modalNovoPagar')).hide();
  Swal.fire('Sucesso!', 'Conta a pagar adicionada!', 'success');
});

// Funções rápidas para atalhos
function adicionarClienteRapido() { adicionarCliente(); }
function adicionarOrcamentoRapido() { adicionarOrcamento(); }
function adicionarEstoqueRapido() { adicionarItemEstoque(); }