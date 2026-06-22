/* =====================================================================
   PetShop Manager — Frontend integrado à API REST
   ===================================================================== */

const API = 'http://localhost:3000/api';

/* ---------- helpers ---------- */

async function apiGet(path) {
  const r = await fetch(`${API}${path}`);
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}
async function apiPost(path, body) {
  const r = await fetch(`${API}${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}
async function apiPut(path, body) {
  const r = await fetch(`${API}${path}`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}
async function apiDelete(path) {
  const r = await fetch(`${API}${path}`, { method: 'DELETE' });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

function formData(form) {
  const obj = {};
  new FormData(form).forEach((v, k) => { obj[k] = v; });
  return obj;
}

function fmtDate(d) {
  if (!d) return '—';
  const dt = new Date(d);
  return dt.toLocaleDateString('pt-BR');
}

function fmtMoney(v) {
  return parseFloat(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg || 'Operação realizada com sucesso!';
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2600);
}

function populateSelect(selectId, items, valueKey, labelKey) {
  const sel = document.getElementById(selectId);
  if (!sel) return;
  const first = sel.querySelector('option');
  sel.innerHTML = '';
  if (first) sel.appendChild(first);
  items.forEach(item => {
    const o = document.createElement('option');
    o.value = item[valueKey];
    o.textContent = item[labelKey];
    sel.appendChild(o);
  });
}

/* ====================================================================
   NAVEGAÇÃO
   ==================================================================== */

const pageInfo = {
  dashboard: ['Dashboard', 'Visão geral do pet shop'],
  clientes: ['Clientes', 'Cadastro e informações dos tutores'],
  pets: ['Pets', 'Animais vinculados aos clientes'],
  agendamentos: ['Agendamentos', 'Agenda de atendimentos'],
  servicos: ['Serviços', 'Serviços e valores oferecidos'],
  funcionarios: ['Funcionários', 'Equipe e dados funcionais'],
  produtos: ['Produtos', 'Estoque, preços e fornecedores'],
  fornecedores: ['Fornecedores', 'Empresas fornecedoras'],
  vendas: ['Vendas', 'Registro das saídas de produtos'],
  compras: ['Compras', 'Registro das entradas de estoque'],
  relatorios: ['Relatórios', 'Consultas baseadas nas views do banco'],
};

const menuItems = document.querySelectorAll('.menu-item');
const pages = document.querySelectorAll('.page');
const sidebar = document.querySelector('.sidebar');

function openPage(id) {
  pages.forEach(p => p.classList.toggle('active', p.id === id));
  menuItems.forEach(i => i.classList.toggle('active', i.dataset.page === id));
  document.getElementById('pageTitle').textContent = pageInfo[id][0];
  document.getElementById('pageSubtitle').textContent = pageInfo[id][1];
  document.getElementById('globalSearch').value = '';
  filterCurrentPage('');
  sidebar.classList.remove('open');
  // trigger load
  if (loaders[id]) loaders[id]();
}

menuItems.forEach(i => i.addEventListener('click', () => openPage(i.dataset.page)));
document.querySelectorAll('[data-go]').forEach(b => b.addEventListener('click', () => openPage(b.dataset.go)));
document.getElementById('mobileMenu').addEventListener('click', () => sidebar.classList.toggle('open'));
document.getElementById('globalSearch').addEventListener('input', e => filterCurrentPage(e.target.value));

function filterCurrentPage(term) {
  const current = document.querySelector('.page.active');
  if (!current) return;
  const v = term.toLowerCase().trim();
  current.querySelectorAll('tbody tr').forEach(row => {
    row.classList.toggle('hidden-row', v && !row.textContent.toLowerCase().includes(v));
  });
  current.querySelectorAll('.service-card, .supplier-card, .report-card').forEach(card => {
    card.style.display = !v || card.textContent.toLowerCase().includes(v) ? '' : 'none';
  });
}

/* ====================================================================
   MODAIS
   ==================================================================== */

document.querySelectorAll('.open-modal').forEach(button => {
  button.addEventListener('click', () => {
    const modal = document.getElementById(button.dataset.modal);
    modal.classList.add('open');
    // Preencher selects dinâmicos quando o modal abrir
    loadModalSelects(button.dataset.modal);
  });
});

function closeModal(modal) {
  modal.classList.remove('open');
  const form = modal.querySelector('form');
  if (form) form.reset();
  // limpar hidden id
  const hidden = form ? form.querySelector('input[type=hidden]') : null;
  if (hidden) hidden.value = '';
  // restaurar título
  const titleEl = modal.querySelector('h2[id]');
  if (titleEl) {
    titleEl.textContent = titleEl.textContent.replace('Editar', 'Novo(a)').replace('Novo(a)', 'Novo');
    if (titleEl.id === 'modalCliente-title') titleEl.textContent = 'Novo cliente';
    if (titleEl.id === 'modalPet-title') titleEl.textContent = 'Novo pet';
    if (titleEl.id === 'modalAgendamento-title') titleEl.textContent = 'Novo agendamento';
    if (titleEl.id === 'modalServico-title') titleEl.textContent = 'Novo serviço';
    if (titleEl.id === 'modalFuncionario-title') titleEl.textContent = 'Novo funcionário';
    if (titleEl.id === 'modalProduto-title') titleEl.textContent = 'Novo produto';
    if (titleEl.id === 'modalFornecedor-title') titleEl.textContent = 'Novo fornecedor';
  }
}

document.querySelectorAll('.modal').forEach(modal => {
  modal.addEventListener('click', e => { if (e.target === modal) closeModal(modal); });
  const closeBtn = modal.querySelector('.modal-close');
  if (closeBtn) closeBtn.addEventListener('click', () => closeModal(modal));
  const cancelBtn = modal.querySelector('.modal-cancel');
  if (cancelBtn) cancelBtn.addEventListener('click', () => closeModal(modal));
});

async function loadModalSelects(modalId) {
  try {
    if (modalId === 'modalPet') {
      const clientes = await apiGet('/clientes');
      populateSelect('select-pet-cliente', clientes, 'id_cliente', 'nome');
    }
    if (modalId === 'modalAgendamento') {
      const [pets, servicos, funcs] = await Promise.all([
        apiGet('/pets'), apiGet('/servicos'), apiGet('/funcionarios'),
      ]);
      populateSelect('select-agend-pet', pets, 'id_pet', 'nome');
      populateSelect('select-agend-servico', servicos, 'id_servicos', 'nome');
      populateSelect('select-agend-func', funcs, 'id_funcionario', 'nome');
    }
    if (modalId === 'modalProduto') {
      const fornecedores = await apiGet('/fornecedores');
      populateSelect('select-prod-fornecedor', fornecedores, 'id_fornecedor', 'nome');
    }
    if (modalId === 'modalVenda') {
      const [clientes, produtos] = await Promise.all([
        apiGet('/clientes'), apiGet('/produtos'),
      ]);
      populateSelect('select-venda-cliente', clientes, 'id_cliente', 'nome');
      populateSelect('select-venda-produto', produtos, 'id_produto', 'nome');
    }
    if (modalId === 'modalCompra') {
      const [fornecedores, produtos] = await Promise.all([
        apiGet('/fornecedores'), apiGet('/produtos'),
      ]);
      populateSelect('select-compra-fornecedor', fornecedores, 'id_fornecedor', 'nome');
      populateSelect('select-compra-produto', produtos, 'id_produto', 'nome');
    }
  } catch (err) {
    console.error('Erro ao carregar selects:', err);
  }
}

/* ====================================================================
   LOADERS — funções de cada página
   ==================================================================== */

const loaders = {};
const serviceIcons = ['🛁', '✂️', '🩺', '💉', '🐾', '👂', '🧴', '🔬', '🧪', '💊', '🐕', '🐈'];

/* ---------- DASHBOARD ---------- */

loaders.dashboard = async () => {
  try {
    const d = await apiGet('/dashboard');
    document.getElementById('dash-clientes').textContent = d.totalClientes;
    document.getElementById('dash-pets').textContent = d.totalPets;
    document.getElementById('dash-agendamentos').textContent = d.agendamentosAtivos;
    document.getElementById('dash-vendas').textContent = fmtMoney(d.totalVendas);

    // Próximos agendamentos
    const agList = document.getElementById('dash-agenda-list');
    if (d.proximosAgendamentos.length === 0) {
      agList.innerHTML = '<p style="padding:1rem;opacity:.5">Nenhum agendamento ativo.</p>';
    } else {
      agList.innerHTML = d.proximosAgendamentos.map(a => {
        const dt = new Date(a.data_hora);
        const day = dt.getDate();
        const mon = dt.toLocaleString('pt-BR', { month: 'short' }).toUpperCase().replace('.', '');
        const badgeClass = a.status === 'Pendente' ? 'yellow' : 'blue';
        return `<div class="agenda-item">
          <div class="date-box"><strong>${day}</strong><span>${mon}</span></div>
          <div class="agenda-info"><strong>${a.pet_nome} · ${a.servico_nome}</strong><span>${a.funcionario_nome}</span></div>
          <span class="badge ${badgeClass}">${a.status}</span>
        </div>`;
      }).join('');
    }

    // Resumo operacional
    const prog = document.getElementById('dash-progress');
    const maxVal = Math.max(d.totalProdutos, d.totalFuncionarios, d.totalServicos, d.totalFornecedores, 1);
    prog.innerHTML = [
      { label: 'Produtos cadastrados', val: d.totalProdutos },
      { label: 'Funcionários', val: d.totalFuncionarios },
      { label: 'Serviços oferecidos', val: d.totalServicos },
      { label: 'Fornecedores', val: d.totalFornecedores },
    ].map(item => `<div class="progress-row">
      <div><span>${item.label}</span><strong>${item.val}</strong></div>
      <div class="progress"><span style="width:${Math.round((item.val / maxVal) * 100)}%"></span></div>
    </div>`).join('');

    // Produtos mini
    const mp = document.getElementById('dash-mini-products');
    if (d.produtosEstoque.length === 0) {
      mp.innerHTML = '<p style="padding:1rem;opacity:.5">Nenhum produto cadastrado.</p>';
    } else {
      mp.innerHTML = d.produtosEstoque.map(p =>
        `<div class="mini-product"><span>${p.nome}</span><strong>${p.estoque} un.</strong></div>`
      ).join('');
    }

    document.getElementById('dbStatus').textContent = 'Conectado ✅';
  } catch (err) {
    console.error('Erro no dashboard:', err);
    document.getElementById('dbStatus').textContent = 'Erro de conexão ❌';
  }
};

/* ---------- CLIENTES ---------- */

loaders.clientes = async () => {
  try {
   const data = await apiGet('/clientes');
    const tbody = document.getElementById('tbody-clientes');
    tbody.innerHTML = data.map(c => `<tr>
      <td>${c.id_cliente}</td><td>${c.nome}</td><td>${c.cpf}</td>
      <td>${c.telefone || '—'}</td><td>${c.endereco || '—'}</td>
      <td class="actions">
        <button onclick="editCliente(${c.id_cliente})">✏️</button>
        <button onclick="deleteCliente(${c.id_cliente})">🗑️</button>
      </td>
    </tr>`).join('');
  } catch (err) { console.error(err); }
};

window.editCliente = async (id) => {
  const c = await apiGet(`/clientes/${id}`);
  const form = document.getElementById('formCliente');
  form.querySelector('[name=id_cliente]').value = c.id_cliente;
  form.querySelector('[name=nome]').value = c.nome;
  form.querySelector('[name=cpf]').value = c.cpf;
  form.querySelector('[name=telefone]').value = c.telefone || '';
  form.querySelector('[name=endereco]').value = c.endereco || '';
  document.getElementById('modalCliente-title').textContent = 'Editar cliente';
  document.getElementById('modalCliente').classList.add('open');
};

window.deleteCliente = async (id) => {
  if (!confirm('Deseja realmente excluir este cliente?')) return;
  try {
    await apiDelete(`/clientes/${id}`);
    showToast('Cliente excluído!');
    loaders.clientes();
  } catch (err) { alert('Erro ao excluir: ' + err.message); }
};

document.getElementById('formCliente').addEventListener('submit', async (e) => {
  e.preventDefault();
  const data = formData(e.target);
  try {
    if (data.id_cliente) {
      await apiPut(`/clientes/${data.id_cliente}`, data);
    } else {
      await apiPost('/clientes', data);
    }
    closeModal(document.getElementById('modalCliente'));
    showToast('Cliente salvo!');
    loaders.clientes();
    loaders.dashboard();
  } catch (err) { alert('Erro: ' + err.message); }
});

/* ---------- PETS ---------- */

loaders.pets = async () => {
  try {
    const data = await apiGet('/pets');
    const tbody = document.getElementById('tbody-pets');
    tbody.innerHTML = data.map(p => `<tr>
      <td>${p.id_pet}</td><td>${p.nome}</td><td>${p.dono_nome}</td>
      <td>${p.especie}</td><td>${p.raca || '—'}</td><td>${p.sexo || '—'}</td>
      <td>${fmtDate(p.data_nascimento)}</td><td>${p.peso ? p.peso + ' kg' : '—'}</td>
      <td class="actions">
        <button onclick="editPet(${p.id_pet})">✏️</button>
        <button onclick="deletePet(${p.id_pet})">🗑️</button>
      </td>
    </tr>`).join('');
  } catch (err) { console.error(err); }
};

window.editPet = async (id) => {
  await loadModalSelects('modalPet');
  const p = await apiGet(`/pets/${id}`);
  const form = document.getElementById('formPet');
  form.querySelector('[name=id_pet]').value = p.id_pet;
  form.querySelector('[name=id_cliente]').value = p.id_cliente;
  form.querySelector('[name=nome]').value = p.nome;
  form.querySelector('[name=especie]').value = p.especie;
  form.querySelector('[name=raca]').value = p.raca || '';
  form.querySelector('[name=sexo]').value = p.sexo || 'M';
  form.querySelector('[name=data_nascimento]').value = p.data_nascimento ? p.data_nascimento.substring(0, 10) : '';
  form.querySelector('[name=peso]').value = p.peso || '';
  document.getElementById('modalPet-title').textContent = 'Editar pet';
  document.getElementById('modalPet').classList.add('open');
};

window.deletePet = async (id) => {
  if (!confirm('Deseja excluir este pet?')) return;
  try {
    await apiDelete(`/pets/${id}`);
    showToast('Pet excluído!');
    loaders.pets();
  } catch (err) { alert('Erro: ' + err.message); }
};


document.getElementById('formPet').addEventListener('submit', async (e) => {
  e.preventDefault();
  const data = formData(e.target);
  try {
    if (data.id_pet) {
      await apiPut(`/pets/${data.id_pet}`, data);
    } else {
      await apiPost('/pets', data);
    }
    closeModal(document.getElementById('modalPet'));
    showToast('Pet salvo!');
    loaders.pets();
    loaders.dashboard();
  } catch (err) { alert('Erro: ' + err.message); }
});

/* ---------- SERVIÇOS ---------- */

loaders.servicos = async () => {
  try {
    const data = await apiGet('/servicos');
    const grid = document.getElementById('servicos-grid');
    grid.innerHTML = data.map((s, i) => `<article class="service-card">
      <div>${serviceIcons[i % serviceIcons.length]}</div>
      <h3>${s.nome}</h3>
      <p>${s.descricao || ''}</p>
      <span>${s.duracao} min</span>
      <strong>${fmtMoney(s.preco)}</strong>
      <div class="card-actions" style="margin-top:.5rem">
        <button class="btn secondary" onclick="editServico(${s.id_servicos})" style="font-size:.75rem;padding:.25rem .5rem">✏️</button>
        <button class="btn danger" onclick="deleteServico(${s.id_servicos})" style="font-size:.75rem;padding:.25rem .5rem">🗑️</button>
      </div>
    </article>`).join('');
  } catch (err) { console.error(err); }
};

window.editServico = async (id) => {
  const s = await apiGet(`/servicos/${id}`);
  const form = document.getElementById('formServico');
  form.querySelector('[name=id_servicos]').value = s.id_servicos;
  form.querySelector('[name=nome]').value = s.nome;
  form.querySelector('[name=preco]').value = s.preco;
  form.querySelector('[name=duracao]').value = s.duracao;
  form.querySelector('[name=descricao]').value = s.descricao || '';
  document.getElementById('modalServico-title').textContent = 'Editar serviço';
  document.getElementById('modalServico').classList.add('open');
};

window.deleteServico = async (id) => {
  if (!confirm('Deseja excluir este serviço?')) return;
  try {
    await apiDelete(`/servicos/${id}`);
    showToast('Serviço excluído!');
    loaders.servicos();
  } catch (err) { alert('Erro: ' + err.message); }
};

document.getElementById('formServico').addEventListener('submit', async (e) => {
  e.preventDefault();
  const data = formData(e.target);
  try {
    if (data.id_servicos) {
      await apiPut(`/servicos/${data.id_servicos}`, data);
    } else {
      await apiPost('/servicos', data);
    }
    closeModal(document.getElementById('modalServico'));
    showToast('Serviço salvo!');
    loaders.servicos();
    loaders.dashboard();
  } catch (err) { alert('Erro: ' + err.message); }
});

/* ---------- FUNCIONÁRIOS ---------- */

loaders.funcionarios = async () => {
  try {
    const data = await apiGet('/funcionarios');
    const tbody = document.getElementById('tbody-funcionarios');
    tbody.innerHTML = data.map(f => `<tr>
      <td>${f.id_funcionario}</td><td>${f.nome}</td><td>${f.cargo || '—'}</td>
      <td>${f.telefone || '—'}</td><td>${f.salario ? fmtMoney(f.salario) : '—'}</td>
      <td>${fmtDate(f.data_admissao)}</td>
      <td class="actions">
        <button onclick="editFuncionario(${f.id_funcionario})">✏️</button>
        <button onclick="deleteFuncionario(${f.id_funcionario})">🗑️</button
      </td>
    </tr>`).join('');
  } catch (err) { console.error(err); }
};

window.editFuncionario = async (id) => {
  const f = await apiGet(`/funcionarios/${id}`);
  const form = document.getElementById('formFuncionario');
  form.querySelector('[name=id_funcionario]').value = f.id_funcionario;
  form.querySelector('[name=nome]').value = f.nome;
  form.querySelector('[name=cargo]').value = f.cargo || '';
  form.querySelector('[name=telefone]').value = f.telefone || '';
  form.querySelector('[name=salario]').value = f.salario || '';
  form.querySelector('[name=data_admissao]').value = f.data_admissao ? f.data_admissao.substring(0, 10) : '';
  document.getElementById('modalFuncionario-title').textContent = 'Editar funcionário';
  document.getElementById('modalFuncionario').classList.add('open');
};

window.deleteFuncionario = async (id) => {
  if (!confirm('Deseja excluir este funcionário?')) return;
  try {
    await apiDelete(`/funcionarios/${id}`);
    showToast('Funcionário excluído!');
    loaders.funcionarios();
  } catch (err) { alert('Erro: ' + err.message); }
};

document.getElementById('formFuncionario').addEventListener('submit', async (e) => {
  e.preventDefault();
  const data = formData(e.target);
  try {
    if (data.id_funcionario) {
      await apiPut(`/funcionarios/${data.id_funcionario}`, data);
    } else {
      await apiPost('/funcionarios', data);
    }
    closeModal(document.getElementById('modalFuncionario'));
    showToast('Funcionário salvo!');
    loaders.funcionarios();
    loaders.dashboard();
  } catch (err) { alert('Erro: ' + err.message); }
});

/* ---------- AGENDAMENTOS ---------- */

loaders.agendamentos = async () => {
  try {
    const data = await apiGet('/agendamentos');
    const tbody = document.getElementById('tbody-agendamentos');
    tbody.innerHTML = data.map(a => {
      const badgeClass = a.status === 'Concluído' ? 'green' : a.status === 'Pendente' ? 'yellow' : 'blue';
      return `<tr>
        <td>${a.id_agendamentos}</td><td>${fmtDate(a.data_hora)}</td><td>${a.pet_nome}</td>
        <td>${a.servico_nome}</td><td>${a.funcionario_nome}</td>
        <td><span class="badge ${badgeClass}">${a.status}</span></td>
        <td>${a.observacoes || '—'}</td>
        <td class="actions">
          <button onclick="editAgendamento(${a.id_agendamentos})">✏️</button>
          <button onclick="deleteAgendamento(${a.id_agendamentos})">🗑️</button>
        </td>
      </tr>`;
    }).join('');
  } catch (err) { console.error(err); }
};

window.editAgendamento = async (id) => {
  await loadModalSelects('modalAgendamento');
  const a = await apiGet(`/agendamentos/${id}`);
  const form = document.getElementById('formAgendamento');
  form.querySelector('[name=id_agendamentos]').value = a.id_agendamentos;
  form.querySelector('[name=id_pet]').value = a.id_pet;
  form.querySelector('[name=id_servico]').value = a.id_servico;
  form.querySelector('[name=id_funcionario]').value = a.id_funcionario;
  form.querySelector('[name=data_hora]').value = a.data_hora ? a.data_hora.substring(0, 16) : '';
  form.querySelector('[name=status]').value = a.status || 'Agendado';
  form.querySelector('[name=observacoes]').value = a.observacoes || '';
  document.getElementById('modalAgendamento-title').textContent = 'Editar agendamento';
  document.getElementById('modalAgendamento').classList.add('open');
};

window.deleteAgendamento = async (id) => {
  if (!confirm('Deseja excluir este agendamento?')) return;
  try {
    await apiDelete(`/agendamentos/${id}`);
    showToast('Agendamento excluído!');
    loaders.agendamentos();
  } catch (err) { alert('Erro: ' + err.message); }
};

document.getElementById('formAgendamento').addEventListener('submit', async (e) => {
  e.preventDefault();
  const data = formData(e.target);
  try {
    if (data.id_agendamentos) {
      await apiPut(`/agendamentos/${data.id_agendamentos}`, data);
    } else {
      await apiPost('/agendamentos', data);
    }
    closeModal(document.getElementById('modalAgendamento'));
    showToast('Agendamento salvo!');
    loaders.agendamentos();
    loaders.dashboard();
  } catch (err) { alert('Erro: ' + err.message); }
});

/* ---------- PRODUTOS ---------- */

loaders.produtos = async () => {
  try {
    const data = await apiGet('/produtos');
    const tbody = document.getElementById('tbody-produtos');
    tbody.innerHTML = data.map(p => {
      const stockClass = p.estoque < 10 ? 'low' : 'ok';
      return `<tr>
        <td>${p.id_produto}</td><td>${p.nome}</td><td>${p.categoria || '—'}</td>
        <td>${p.marca || '—'}</td><td>${fmtMoney(p.preco)}</td>
        <td><span class="stock ${stockClass}">${p.estoque} un.</span></td>
        <td>${p.fornecedor_nome}</td><td>${fmtDate(p.data_cadastro)}</td>
        <td class="actions">
          <button onclick="editProduto(${p.id_produto})">✏️</button>
          <button onclick="deleteProduto(${p.id_produto})">🗑️</button>
        </td>
      </tr>`;
    }).join('');
  } catch (err) { console.error(err); }
};

window.editProduto = async (id) => {
  await loadModalSelects('modalProduto');
  const p = await apiGet(`/produtos/${id}`);
  const form = document.getElementById('formProduto');
  form.querySelector('[name=id_produto]').value = p.id_produto;
  form.querySelector('[name=nome]').value = p.nome;
  form.querySelector('[name=categoria]').value = p.categoria || '';
  form.querySelector('[name=marca]').value = p.marca || '';
  form.querySelector('[name=preco]').value = p.preco;
  form.querySelector('[name=estoque]').value = p.estoque;
  form.querySelector('[name=id_fornecedor]').value = p.id_fornecedor;
  document.getElementById('modalProduto-title').textContent = 'Editar produto';
  document.getElementById('modalProduto').classList.add('open');
};

window.deleteProduto = async (id) => {
  if (!confirm('Deseja excluir este produto?')) return;
  try {
    await apiDelete(`/produtos/${id}`);
    showToast('Produto excluído!');
    loaders.produtos();
  } catch (err) { alert('Erro: ' + err.message); }
};

document.getElementById('formProduto').addEventListener('submit', async (e) => {
  e.preventDefault();
  const data = formData(e.target);
  try {
    if (data.id_produto) {
      await apiPut(`/produtos/${data.id_produto}`, data);
    } else {
      await apiPost('/produtos', data);
    }
    closeModal(document.getElementById('modalProduto'));
    showToast('Produto salvo!');
    loaders.produtos();
    loaders.dashboard();
  } catch (err) { alert('Erro: ' + err.message); }
});

/* ---------- FORNECEDORES ---------- */

loaders.fornecedores = async () => {
  try {
    const data = await apiGet('/fornecedores');
    const grid = document.getElementById('fornecedores-grid');
    grid.innerHTML = data.map(f => {
      const initials = f.nome.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
      return `<article class="supplier-card">
        <div class="supplier-logo">${initials}</div>
        <h3>${f.nome}</h3>
        <p><strong>CNPJ:</strong> ${f.cnpj}</p>
        <p><strong>Telefone:</strong> ${f.telefone || '—'}</p>
        <p><strong>E-mail:</strong> ${f.email || '—'}</p>
        <div class="card-actions">
          <button class="btn secondary" onclick="editFornecedor(${f.id_fornecedor})">Editar</button>
          <button class="btn danger" onclick="deleteFornecedor(${f.id_fornecedor})">Excluir</button>
        </div>
      </article>`;
    }).join('');
  } catch (err) { console.error(err); }
};

window.editFornecedor = async (id) => {
  const f = await apiGet(`/fornecedores/${id}`);
  const form = document.getElementById('formFornecedor');
  form.querySelector('[name=id_fornecedor]').value = f.id_fornecedor;
  form.querySelector('[name=nome]').value = f.nome;
  form.querySelector('[name=cnpj]').value = f.cnpj;
  form.querySelector('[name=telefone]').value = f.telefone || '';
  form.querySelector('[name=email]').value = f.email || '';
  document.getElementById('modalFornecedor-title').textContent = 'Editar fornecedor';
  document.getElementById('modalFornecedor').classList.add('open');
};

window.deleteFornecedor = async (id) => {
  if (!confirm('Deseja excluir este fornecedor?')) return;
  try {
    await apiDelete(`/fornecedores/${id}`);
    showToast('Fornecedor excluído!');
    loaders.fornecedores();
  } catch (err) { alert('Erro: ' + err.message); }
};

document.getElementById('formFornecedor').addEventListener('submit', async (e) => {
  e.preventDefault();
  const data = formData(e.target);
  try {
    if (data.id_fornecedor) {
      await apiPut(`/fornecedores/${data.id_fornecedor}`, data);
    } else {
      await apiPost('/fornecedores', data);
    }
    closeModal(document.getElementById('modalFornecedor'));
    showToast('Fornecedor salvo!');
    loaders.fornecedores();
    loaders.dashboard();
  } catch (err) { alert('Erro: ' + err.message); }
});

/* ---------- VENDAS ---------- */

loaders.vendas = async () => {
  try {
    const data = await apiGet('/vendas');
    // Resumo
    const totalVendido = data.reduce((s, v) => s + parseFloat(v.valor_total), 0);
    const ticket = data.length ? totalVendido / data.length : 0;
    const totalItens = data.reduce((s, v) => s + parseInt(v.total_itens || 0), 0);
    const resumo = document.getElementById('vendas-resumo');
    resumo.innerHTML = `
      <article class="metric-card"><div class="metric-icon">💰</div><div><span>Total vendido</span><strong>${fmtMoney(totalVendido)}</strong><small>${data.length} vendas</small></div></article>
      <article class="metric-card"><div class="metric-icon">🧾</div><div><span>Ticket médio</span><strong>${fmtMoney(ticket)}</strong><small>por venda</small></div></article>
      <article class="metric-card"><div class="metric-icon">📦</div><div><span>Itens vendidos</span><strong>${totalItens}</strong><small>unidades</small></div></article>
    `;
    // Tabela
    const tbody = document.getElementById('tbody-vendas');
    tbody.innerHTML = data.map(v => `<tr>
      <td>${v.id_venda}</td><td>${fmtDate(v.data_venda)}</td><td>${v.cliente_nome}</td>
      <td>${v.forma_pagamento}</td><td>${v.total_itens}</td><td>${fmtMoney(v.valor_total)}</td>
      <td class="actions">
        <button onclick="deleteVenda(${v.id_venda})">🗑️</button>
      </td>
    </tr>`).join('');
  } catch (err) { console.error(err); }
};

window.deleteVenda = async (id) => {
  if (!confirm('Excluir esta venda e seus itens?')) return;
  try {
    await apiDelete(`/vendas/${id}`);
    showToast('Venda excluída!');
    loaders.vendas();
    loaders.dashboard();
  } catch (err) { alert('Erro: ' + err.message); }
};

document.getElementById('formVenda').addEventListener('submit', async (e) => {
  e.preventDefault();
  const data = formData(e.target);
  const body = {
    id_cliente: data.id_cliente,
    data_venda: data.data_venda,
    forma_pagamento: data.forma_pagamento,
    itens: [{
      id_produto: parseInt(data.id_produto),
      quantidade: parseInt(data.quantidade),
      preco_produto: parseFloat(data.preco_produto),
    }],
  };
  try {
    await apiPost('/vendas', body);
    closeModal(document.getElementById('modalVenda'));
    showToast('Venda registrada!');
    loaders.vendas();
    loaders.dashboard();
  } catch (err) { alert('Erro: ' + err.message); }
});

/* ---------- COMPRAS ---------- */

loaders.compras = async () => {
  try {
    const data = await apiGet('/compras');
    const tbody = document.getElementById('tbody-compras');
    tbody.innerHTML = data.map(c => `<tr>
      <td>${c.id_compra}</td><td>${fmtDate(c.data_compra)}</td><td>${c.fornecedor_nome}</td>
      <td>${c.total_itens} unidades</td><td>${fmtMoney(c.valor_total)}</td>
      <td class="actions">
        <button onclick="deleteCompra(${c.id_compra})">🗑️</button>
      </td>
    </tr>`).join('');
  } catch (err) { console.error(err); }
};

window.deleteCompra = async (id) => {
  if (!confirm('Excluir esta compra e seus itens?')) return;
  try {
    await apiDelete(`/compras/${id}`);
    showToast('Compra excluída!');
    loaders.compras();
  } catch (err) { alert('Erro: ' + err.message); }
};

document.getElementById('formCompra').addEventListener('submit', async (e) => {
  e.preventDefault();
  const data = formData(e.target);
  const body = {
    id_fornecedor: data.id_fornecedor,
    data_compra: data.data_compra,
    itens: [{
      id_produto: parseInt(data.id_produto),
      quantidade: parseInt(data.quantidade),
      custo_unitario: parseFloat(data.custo_unitario),
    }],
  };
  try {
    await apiPost('/compras', body);
    closeModal(document.getElementById('modalCompra'));
    showToast('Compra registrada!');
    loaders.compras();
    loaders.dashboard();
  } catch (err) { alert('Erro: ' + err.message); }
});

/* ---------- RELATÓRIOS ---------- */

let currentReport = null;

loaders.relatorios = () => {}; // estático, sem carga extra

document.querySelectorAll('.report-card').forEach(card => {
  card.querySelector('button').addEventListener('click', async () => {
    const tipo = card.dataset.report;
    try {
      const report = await apiGet(`/relatorios/${tipo}`);
      currentReport = report;
      document.getElementById('reportTitle').textContent = report.title;
      document.getElementById('reportDescription').textContent = report.description;
      const table = document.getElementById('reportTable');
      table.querySelector('thead').innerHTML = `<tr>${report.headers.map(h => `<th>${h}</th>`).join('')}</tr>`;
      if (report.rows.length === 0) {
        table.querySelector('tbody').innerHTML = '<tr><td colspan="' + report.headers.length + '">Nenhum registro encontrado.</td></tr>';
      } else {
        table.querySelector('tbody').innerHTML = report.rows.map(row =>
          `<tr>${row.map(cell => `<td>${cell !== null && cell !== undefined ? cell : '—'}</td>`).join('')}</tr>`
        ).join('');
      }
    } catch (err) {
      console.error('Erro no relatório:', err);
      alert('Erro ao carregar relatório.');
    }
  });
});

document.getElementById('exportBtn').addEventListener('click', () => {
  if (!currentReport) {
    alert('Selecione um relatório antes de exportar.');
    return;
  }
  const csv = [
    currentReport.headers.join(';'),
    ...currentReport.rows.map(row => row.join(';')),
  ].join('\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'relatorio_petshop.csv';
  link.click();
  URL.revokeObjectURL(url);
});

/* ====================================================================
   INIT — carrega o dashboard ao abrir
   ==================================================================== */

loaders.dashboard();
