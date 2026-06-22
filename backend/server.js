const express = require('express');
const cors = require('cors');
const path = require('path');
const pool = require('./db');

const app = express();
app.use(cors());
app.use(express.json());

// Serve os arquivos estáticos do frontend (pasta pai)
app.use(express.static(path.join(__dirname, '..')));

const PORT = process.env.PORT || 3000;

/* ========================================================
   HELPERS
   ======================================================== */

function handleError(res, err, msg = 'Erro interno do servidor') {
  console.error(msg, err.message);
  res.status(500).json({ error: msg, detail: err.message });
}

/* ========================================================
   DASHBOARD
   ======================================================== */

app.get('/api/dashboard', async (_req, res) => {
  try {
    const [clientes, pets, agendamentos, vendas, produtos, funcionarios, servicos, fornecedores] =
      await Promise.all([
        pool.query('SELECT COUNT(*) AS total FROM clientes'),
        pool.query('SELECT COUNT(*) AS total FROM pets'),
        pool.query(
          "SELECT COUNT(*) AS total FROM agendamentos WHERE status IN ('Agendado','Pendente')"
        ),
        pool.query('SELECT COALESCE(SUM(valor_total),0) AS total FROM vendas'),
        pool.query('SELECT COUNT(*) AS total FROM produtos'),
        pool.query('SELECT COUNT(*) AS total FROM funcionarios'),
        pool.query('SELECT COUNT(*) AS total FROM servicos'),
        pool.query('SELECT COUNT(*) AS total FROM fornecedor'),
      ]);

    // Próximos agendamentos (ativos, com JOINs)
    const proximos = await pool.query(`
      SELECT a.id_agendamentos, a.data_hora, a.status, a.observacoes,
             p.nome AS pet_nome, s.nome AS servico_nome, f.nome AS funcionario_nome
      FROM agendamentos a
      JOIN pets p ON p.id_pet = a.id_pet
      JOIN servicos s ON s.id_servicos = a.id_servico
      JOIN funcionarios f ON f.id_funcionario = a.id_funcionario
      WHERE a.status IN ('Agendado','Pendente')
      ORDER BY a.data_hora ASC
      LIMIT 5
    `);

    // Produtos para mini-lista
    const produtosLista = await pool.query(
      'SELECT nome, estoque FROM produtos ORDER BY nome LIMIT 10'
    );

    res.json({
      totalClientes: parseInt(clientes.rows[0].total),
      totalPets: parseInt(pets.rows[0].total),
      agendamentosAtivos: parseInt(agendamentos.rows[0].total),
      totalVendas: parseFloat(vendas.rows[0].total),
      totalProdutos: parseInt(produtos.rows[0].total),
      totalFuncionarios: parseInt(funcionarios.rows[0].total),
      totalServicos: parseInt(servicos.rows[0].total),
      totalFornecedores: parseInt(fornecedores.rows[0].total),
      proximosAgendamentos: proximos.rows,
      produtosEstoque: produtosLista.rows,
    });
  } catch (err) {
    handleError(res, err, 'Erro ao buscar dados do dashboard');
  }
});

/* ========================================================
   CLIENTES
   ======================================================== */

app.get('/api/clientes', async (_req, res) => {
  try {
   const { rows } = await pool.query('SELECT * FROM clientes ORDER BY id_cliente');
    res.json(rows);
  } catch (err) {
    handleError(res, err);
  }
});


app.get('/api/clientes/:id', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM clientes WHERE id_cliente = $1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Cliente não encontrado' });
    res.json(rows[0]);
  } catch (err) {
    handleError(res, err);
  }
});

app.post('/api/clientes', async (req, res) => {
  try {
    const { nome, cpf, telefone, endereco } = req.body;
    const { rows } = await pool.query(
      'INSERT INTO clientes (nome, cpf, telefone, endereco) VALUES ($1,$2,$3,$4) RETURNING *',
      [nome, cpf, telefone, endereco]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    handleError(res, err, 'Erro ao criar cliente');
  }
});

app.put('/api/clientes/:id', async (req, res) => {
  try {
    const { nome, cpf, telefone, endereco } = req.body;
    const { rows } = await pool.query(
      'UPDATE clientes SET nome=$1, cpf=$2, telefone=$3, endereco=$4 WHERE id_cliente=$5 RETURNING *',
      [nome, cpf, telefone, endereco, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Cliente não encontrado' });
    res.json(rows[0]);
  } catch (err) {
    handleError(res, err, 'Erro ao atualizar cliente');
  }
});

// Soft delete
app.delete('/api/clientes/:id', async (req, res) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM clientes WHERE id_cliente=$1', [req.params.id]);
    if (!rowCount) return res.status(404).json({ error: 'Cliente não encontrado' });
    res.json({ message: 'Cliente excluído com sucesso' });
  } catch (err) {
    handleError(res, err, 'Erro ao excluir cliente');
  }
});

/* ========================================================
   PETS
   ======================================================== */

app.get('/api/pets', async (_req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT p.*, c.nome AS dono_nome
      FROM pets p
      JOIN clientes c ON c.id_cliente = p.id_cliente
      ORDER BY p.id_pet
    `);
    res.json(rows);
  } catch (err) {
    handleError(res, err);
  }
});

app.get('/api/pets/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT p.*, c.nome AS dono_nome
      FROM pets p JOIN clientes c ON c.id_cliente = p.id_cliente
      WHERE p.id_pet = $1
    `, [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Pet não encontrado' });
    res.json(rows[0]);
  } catch (err) {
    handleError(res, err);
  }
});

app.post('/api/pets', async (req, res) => {
  try {
    const { id_cliente, nome, especie, raca, sexo, data_nascimento, peso } = req.body;
    const { rows } = await pool.query(
      `INSERT INTO pets (id_cliente, nome, especie, raca, sexo, data_nascimento, peso)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [id_cliente, nome, especie, raca, sexo, data_nascimento || null, peso || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    handleError(res, err, 'Erro ao criar pet');
  }
});

app.put('/api/pets/:id', async (req, res) => {
  try {
    const { id_cliente, nome, especie, raca, sexo, data_nascimento, peso } = req.body;
    const { rows } = await pool.query(
      `UPDATE pets SET id_cliente=$1, nome=$2, especie=$3, raca=$4, sexo=$5,
       data_nascimento=$6, peso=$7 WHERE id_pet=$8 RETURNING *`,
      [id_cliente, nome, especie, raca, sexo, data_nascimento || null, peso || null, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Pet não encontrado' });
    res.json(rows[0]);
  } catch (err) {
    handleError(res, err, 'Erro ao atualizar pet');
  }
});

app.delete('/api/pets/:id', async (req, res) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM pets WHERE id_pet=$1', [req.params.id]);    if (!rowCount) return res.status(404).json({ error: 'Pet não encontrado' });
    res.json({ message: 'Pet excluído com sucesso' });
  } catch (err) {
    handleError(res, err, 'Erro ao excluir pet');
  }
});


/* ========================================================
   SERVICOS
   ======================================================== */

app.get('/api/servicos', async (_req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM servicos ORDER BY id_servicos');
    res.json(rows);
  } catch (err) {
    handleError(res, err);
  }
});

app.get('/api/servicos/:id', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM servicos WHERE id_servicos=$1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Serviço não encontrado' });
    res.json(rows[0]);
  } catch (err) {
    handleError(res, err);
  }
});

app.post('/api/servicos', async (req, res) => {
  try {
    const { nome, descricao, preco, duracao } = req.body;
    const { rows } = await pool.query(
      'INSERT INTO servicos (nome, descricao, preco, duracao) VALUES ($1,$2,$3,$4) RETURNING *',
      [nome, descricao, preco, duracao]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    handleError(res, err, 'Erro ao criar serviço');
  }
});

app.put('/api/servicos/:id', async (req, res) => {
  try {
    const { nome, descricao, preco, duracao } = req.body;
    const { rows } = await pool.query(
      'UPDATE servicos SET nome=$1, descricao=$2, preco=$3, duracao=$4 WHERE id_servicos=$5 RETURNING *',
      [nome, descricao, preco, duracao, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Serviço não encontrado' });
    res.json(rows[0]);
  } catch (err) {
    handleError(res, err, 'Erro ao atualizar serviço');
  }
});

app.delete('/api/servicos/:id', async (req, res) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM servicos WHERE id_servicos=$1', [req.params.id]);
    if (!rowCount) return res.status(404).json({ error: 'Serviço não encontrado' });
    res.json({ message: 'Serviço excluído com sucesso' });
  } catch (err) {
    handleError(res, err, 'Erro ao excluir serviço');
  }
});

/* ========================================================
   FUNCIONARIOS
   ======================================================== */

app.get('/api/funcionarios', async (_req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM funcionarios WHERE ativo = TRUE ORDER BY id_funcionario');
    res.json(rows);
  } catch (err) {
    handleError(res, err);
  }
});

app.get('/api/funcionarios/inativos', async (_req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM funcionarios WHERE ativo = FALSE ORDER BY id_funcionario');
    res.json(rows);
  } catch (err) {
    handleError(res, err);
  }
});

app.get('/api/funcionarios/:id', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM funcionarios WHERE id_funcionario=$1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Funcionário não encontrado' });
    res.json(rows[0]);
  } catch (err) {
    handleError(res, err);
  }
});

app.post('/api/funcionarios', async (req, res) => {
  try {
    const { nome, cargo, telefone, salario, data_admissao } = req.body;
    const { rows } = await pool.query(
      `INSERT INTO funcionarios (nome, cargo, telefone, salario, data_admissao)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [nome, cargo, telefone, salario, data_admissao || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    handleError(res, err, 'Erro ao criar funcionário');
  }
});

app.put('/api/funcionarios/:id', async (req, res) => {
  try {
    const { nome, cargo, telefone, salario, data_admissao } = req.body;
    const { rows } = await pool.query(
      `UPDATE funcionarios SET nome=$1, cargo=$2, telefone=$3, salario=$4,
       data_admissao=$5 WHERE id_funcionario=$6 RETURNING *`,
      [nome, cargo, telefone, salario, data_admissao || null, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Funcionário não encontrado' });
    res.json(rows[0]);
  } catch (err) {
    handleError(res, err, 'Erro ao atualizar funcionário');
  }
});

// Soft delete
app.delete('/api/funcionarios/:id', async (req, res) => {
  try {
    const { rowCount } = await pool.query('UPDATE funcionarios SET ativo = FALSE WHERE id_funcionario=$1', [req.params.id]);
    if (!rowCount) return res.status(404).json({ error: 'Funcionário não encontrado' });
    res.json({ message: 'Funcionário desativado com sucesso' });
  } catch (err) {
    handleError(res, err, 'Erro ao desativar funcionário');
  }
});

// Restaurar
app.patch('/api/funcionarios/:id/restaurar', async (req, res) => {
  try {
    const { rowCount } = await pool.query('UPDATE funcionarios SET ativo = TRUE WHERE id_funcionario=$1', [req.params.id]);
    if (!rowCount) return res.status(404).json({ error: 'Funcionário não encontrado' });
    res.json({ message: 'Funcionário restaurado com sucesso' });
  } catch (err) {
    handleError(res, err, 'Erro ao restaurar funcionário');
  }
});

/* ========================================================
   AGENDAMENTOS
   ======================================================== */

app.get('/api/agendamentos', async (_req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT a.*, p.nome AS pet_nome, s.nome AS servico_nome, f.nome AS funcionario_nome
      FROM agendamentos a
      JOIN pets p ON p.id_pet = a.id_pet
      JOIN servicos s ON s.id_servicos = a.id_servico
      JOIN funcionarios f ON f.id_funcionario = a.id_funcionario
      ORDER BY a.data_hora DESC
    `);
    res.json(rows);
  } catch (err) {
    handleError(res, err);
  }
});

app.get('/api/agendamentos/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT a.*, p.nome AS pet_nome, s.nome AS servico_nome, f.nome AS funcionario_nome
      FROM agendamentos a
      JOIN pets p ON p.id_pet = a.id_pet
      JOIN servicos s ON s.id_servicos = a.id_servico
      JOIN funcionarios f ON f.id_funcionario = a.id_funcionario
      WHERE a.id_agendamentos = $1
    `, [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Agendamento não encontrado' });
    res.json(rows[0]);
  } catch (err) {
    handleError(res, err);
  }
});

app.post('/api/agendamentos', async (req, res) => {
  try {
    const { id_pet, id_servico, id_funcionario, data_hora, status, observacoes } = req.body;
    const { rows } = await pool.query(
      `INSERT INTO agendamentos (id_pet, id_servico, id_funcionario, data_hora, status, observacoes)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [id_pet, id_servico, id_funcionario, data_hora, status || 'Agendado', observacoes]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    handleError(res, err, 'Erro ao criar agendamento');
  }
});

app.put('/api/agendamentos/:id', async (req, res) => {
  try {
    const { id_pet, id_servico, id_funcionario, data_hora, status, observacoes } = req.body;
    const { rows } = await pool.query(
      `UPDATE agendamentos SET id_pet=$1, id_servico=$2, id_funcionario=$3,
       data_hora=$4, status=$5, observacoes=$6 WHERE id_agendamentos=$7 RETURNING *`,
      [id_pet, id_servico, id_funcionario, data_hora, status, observacoes, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Agendamento não encontrado' });
    res.json(rows[0]);
  } catch (err) {
    handleError(res, err, 'Erro ao atualizar agendamento');
  }
});

app.delete('/api/agendamentos/:id', async (req, res) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM agendamentos WHERE id_agendamentos=$1', [req.params.id]);
    if (!rowCount) return res.status(404).json({ error: 'Agendamento não encontrado' });
    res.json({ message: 'Agendamento excluído com sucesso' });
  } catch (err) {
    handleError(res, err, 'Erro ao excluir agendamento');
  }
});

/* ========================================================
   FORNECEDORES
   ======================================================== */

app.get('/api/fornecedores', async (_req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM fornecedor ORDER BY id_fornecedor');
    res.json(rows);
  } catch (err) {
    handleError(res, err);
  }
});

app.get('/api/fornecedores/:id', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM fornecedor WHERE id_fornecedor=$1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Fornecedor não encontrado' });
    res.json(rows[0]);
  } catch (err) {
    handleError(res, err);
  }
});

app.post('/api/fornecedores', async (req, res) => {
  try {
    const { nome, cnpj, telefone, email } = req.body;
    const { rows } = await pool.query(
      'INSERT INTO fornecedor (nome, cnpj, telefone, email) VALUES ($1,$2,$3,$4) RETURNING *',
      [nome, cnpj, telefone, email]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    handleError(res, err, 'Erro ao criar fornecedor');
  }
});

app.put('/api/fornecedores/:id', async (req, res) => {
  try {
    const { nome, cnpj, telefone, email } = req.body;
    const { rows } = await pool.query(
      'UPDATE fornecedor SET nome=$1, cnpj=$2, telefone=$3, email=$4 WHERE id_fornecedor=$5 RETURNING *',
      [nome, cnpj, telefone, email, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Fornecedor não encontrado' });
    res.json(rows[0]);
  } catch (err) {
    handleError(res, err, 'Erro ao atualizar fornecedor');
  }
});

app.delete('/api/fornecedores/:id', async (req, res) => {
  try {
    res.json({ message: 'Funcionário excluído com sucesso' });
    if (!rowCount) return res.status(404).json({ error: 'Fornecedor não encontrado' });
        res.json({ message: 'Funcionário excluído com sucesso' });
  } catch (err) {
    handleError(res, err, 'Erro ao excluir funcionário');
  }
});

/* ========================================================
   PRODUTOS
   ======================================================== */

app.get('/api/produtos', async (_req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT pr.*, f.nome AS fornecedor_nome
      FROM produtos pr
      JOIN fornecedor f ON f.id_fornecedor = pr.id_fornecedor
      ORDER BY pr.id_produto
    `);
    res.json(rows);
  } catch (err) {
    handleError(res, err);
  }
});


app.get('/api/produtos/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT pr.*, f.nome AS fornecedor_nome
      FROM produtos pr
      JOIN fornecedor f ON f.id_fornecedor = pr.id_fornecedor
      WHERE pr.id_produto=$1
    `, [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Produto não encontrado' });
    res.json(rows[0]);
  } catch (err) {
    handleError(res, err);
  }
});

app.post('/api/produtos', async (req, res) => {
  try {
    const { nome, categoria, marca, preco, estoque, id_fornecedor } = req.body;
    const { rows } = await pool.query(
      `INSERT INTO produtos (nome, categoria, marca, preco, estoque, id_fornecedor)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [nome, categoria, marca, preco, estoque || 0, id_fornecedor]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    handleError(res, err, 'Erro ao criar produto');
  }
});

app.put('/api/produtos/:id', async (req, res) => {
  try {
    const { nome, categoria, marca, preco, estoque, id_fornecedor } = req.body;
    const { rows } = await pool.query(
      `UPDATE produtos SET nome=$1, categoria=$2, marca=$3, preco=$4,
       estoque=$5, id_fornecedor=$6 WHERE id_produto=$7 RETURNING *`,
      [nome, categoria, marca, preco, estoque, id_fornecedor, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Produto não encontrado' });
    res.json(rows[0]);
  } catch (err) {
    handleError(res, err, 'Erro ao atualizar produto');
  }
});

app.delete('/api/produtos/:id', async (req, res) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM produtos WHERE id_produto=$1', [req.params.id]);
    if (!rowCount) return res.status(404).json({ error: 'Produto não encontrado' });
    res.json({ message: 'Produto excluído com sucesso' });
  } catch (err) {
    handleError(res, err, 'Erro ao excluir produto');
  }
});

/* ========================================================
   VENDAS  (venda + itens_venda)
   ======================================================== */

app.get('/api/vendas', async (_req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT v.*, c.nome AS cliente_nome,
        (SELECT COALESCE(SUM(iv.quantidade),0) FROM item_venda iv WHERE iv.id_venda = v.id_venda) AS total_itens
      FROM vendas v
      JOIN clientes c ON c.id_cliente = v.id_cliente
      ORDER BY v.data_venda DESC
    `);
    res.json(rows);
  } catch (err) {
    handleError(res, err);
  }
});

app.get('/api/vendas/:id', async (req, res) => {
  try {
    const venda = await pool.query(`
      SELECT v.*, c.nome AS cliente_nome
      FROM vendas v JOIN clientes c ON c.id_cliente = v.id_cliente
      WHERE v.id_venda=$1
    `, [req.params.id]);
    if (!venda.rows.length) return res.status(404).json({ error: 'Venda não encontrada' });

    const itens = await pool.query(`
      SELECT iv.*, pr.nome AS produto_nome
      FROM item_venda iv
      JOIN produtos pr ON pr.id_produto = iv.id_produto
      WHERE iv.id_venda=$1
    `, [req.params.id]);

    res.json({ ...venda.rows[0], itens: itens.rows });
  } catch (err) {
    handleError(res, err);
  }
});

app.post('/api/vendas', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { id_cliente, data_venda, forma_pagamento, itens } = req.body;

    // Calcula valor_total a partir dos itens
    let valor_total = 0;
    if (itens && itens.length) {
      valor_total = itens.reduce((acc, item) => acc + item.quantidade * item.preco_produto, 0);
    }

    const vendaResult = await client.query(
      `INSERT INTO vendas (id_cliente, data_venda, valor_total, forma_pagamento)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [id_cliente, data_venda, valor_total, forma_pagamento]
    );
    const id_venda = vendaResult.rows[0].id_venda;

    if (itens && itens.length) {
      for (const item of itens) {
        await client.query(
          `INSERT INTO item_venda (id_venda, id_produto, quantidade, preco_produto)
           VALUES ($1,$2,$3,$4)`,
          [id_venda, item.id_produto, item.quantidade, item.preco_produto]
        );
      }
    }

    await client.query('COMMIT');
    res.status(201).json(vendaResult.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    handleError(res, err, 'Erro ao criar venda');
  } finally {
    client.release();
  }
});

app.delete('/api/vendas/:id', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM item_venda WHERE id_venda=$1', [req.params.id]);
    const { rowCount } = await client.query('DELETE FROM vendas WHERE id_venda=$1', [req.params.id]);
    if (!rowCount) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Venda não encontrada' });
    }
    await client.query('COMMIT');
    res.json({ message: 'Venda excluída com sucesso' });
  } catch (err) {
    await client.query('ROLLBACK');
    handleError(res, err, 'Erro ao excluir venda');
  } finally {
    client.release();
  }
});

/* ========================================================
   COMPRAS  (compra + itens_compra)
   ======================================================== */

app.get('/api/compras', async (_req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT co.*, f.nome AS fornecedor_nome,
        (SELECT COALESCE(SUM(ic.quantidade),0) FROM item_compra ic WHERE ic.id_compra = co.id_compra) AS total_itens
      FROM compras co
      JOIN fornecedor f ON f.id_fornecedor = co.id_fornecedor
      ORDER BY co.data_compra DESC
    `);
    res.json(rows);
  } catch (err) {
    handleError(res, err);
  }
});

app.get('/api/compras/:id', async (req, res) => {
  try {
    const compra = await pool.query(`
      SELECT co.*, f.nome AS fornecedor_nome
      FROM compras co JOIN fornecedor f ON f.id_fornecedor = co.id_fornecedor
      WHERE co.id_compra=$1
    `, [req.params.id]);
    if (!compra.rows.length) return res.status(404).json({ error: 'Compra não encontrada' });

    const itens = await pool.query(`
      SELECT ic.*, pr.nome AS produto_nome
      FROM item_compra ic
      JOIN produtos pr ON pr.id_produto = ic.id_produto
      WHERE ic.id_compra=$1
    `, [req.params.id]);

    res.json({ ...compra.rows[0], itens: itens.rows });
  } catch (err) {
    handleError(res, err);
  }
});

app.post('/api/compras', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { id_fornecedor, data_compra, itens } = req.body;

    let valor_total = 0;
    if (itens && itens.length) {
      valor_total = itens.reduce((acc, item) => acc + item.quantidade * item.custo_unitario, 0);
    }

    const compraResult = await client.query(
      `INSERT INTO compras (id_fornecedor, data_compra, valor_total)
       VALUES ($1,$2,$3) RETURNING *`,
      [id_fornecedor, data_compra, valor_total]
    );
    const id_compra = compraResult.rows[0].id_compra;

    if (itens && itens.length) {
      for (const item of itens) {
        await client.query(
          `INSERT INTO item_compra (id_compra, id_produto, quantidade, custo_unitario)
           VALUES ($1,$2,$3,$4)`,
          [id_compra, item.id_produto, item.quantidade, item.custo_unitario]
        );
      }
    }

    await client.query('COMMIT');
    res.status(201).json(compraResult.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    handleError(res, err, 'Erro ao criar compra');
  } finally {
    client.release();
  }
});

app.delete('/api/compras/:id', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM item_compra WHERE id_compra=$1', [req.params.id]);
    const { rowCount } = await client.query('DELETE FROM compras WHERE id_compra=$1', [req.params.id]);
    if (!rowCount) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Compra não encontrada' });
    }
    await client.query('COMMIT');
    res.json({ message: 'Compra excluída com sucesso' });
  } catch (err) {
    await client.query('ROLLBACK');
    handleError(res, err, 'Erro ao excluir compra');
  } finally {
    client.release();
  }
});

/* ========================================================
   RELATÓRIOS (Views do PostgreSQL com fallback)
   ======================================================== */

const reportQueries = {
  estoque: {
    view: 'SELECT * FROM vw_produtos_estoque_baixo',
    fallback: "SELECT id_produto, nome, marca, estoque FROM produtos WHERE estoque < 10 ORDER BY estoque",
    title: 'Produtos com estoque baixo',
    description: 'Produtos com estoque abaixo de 10 unidades.',
  },
  veterinarios: {
    view: 'SELECT * FROM vw_funcionarios_veterinarios',
    fallback: "SELECT id_funcionario, nome, cargo, telefone FROM funcionarios WHERE LOWER(cargo) = 'veterinário' ORDER BY nome",
    title: 'Funcionários veterinários',
    description: 'Funcionários com cargo de veterinário.',
  },
  ativos: {
    view: 'SELECT * FROM vw_agendamentos_ativos',
    fallback: `SELECT a.id_agendamentos, p.nome AS pet, a.data_hora, a.status
               FROM agendamentos a JOIN pets p ON p.id_pet = a.id_pet
               WHERE a.status IN ('Agendado','Pendente') ORDER BY a.data_hora`,
    title: 'Agendamentos ativos',
    description: 'Agendamentos com status Agendado ou Pendente.',
  },
  petsdonos: {
    view: 'SELECT * FROM vw_pets_e_donos',
    fallback: `SELECT p.id_pet, p.nome AS pet, p.especie, c.nome AS dono, c.telefone
               FROM pets p JOIN clientes c ON c.id_cliente = p.id_cliente ORDER BY p.id_pet`,
    title: 'Pets e seus donos',
    description: 'Listagem de pets com informações dos tutores.',
  },
  agenda: {
    view: 'SELECT * FROM vw_agenda_diaria_detalhada',
    fallback: `SELECT a.data_hora, pe.nome AS pet, cl.nome AS cliente, s.nome AS servico,
                      s.preco AS valor, f.nome AS funcionario, a.status
               FROM agendamentos a
               JOIN pets pe ON pe.id_pet = a.id_pet
               JOIN clientes cl ON cl.id_cliente = pe.id_cliente
               JOIN servicos s ON s.id_servicos = a.id_servico
               JOIN funcionarios f ON f.id_funcionario = a.id_funcionario
               ORDER BY a.data_hora`,
    title: 'Agenda diária detalhada',
    description: 'Pet, cliente, serviço e funcionário responsável.',
  },
  faturamento: {
    view: 'SELECT * FROM vw_faturamento_servicos_funcionario',
    fallback: `SELECT f.nome AS funcionario, f.cargo,
                      COUNT(*) AS atendimentos,
                      SUM(s.preco) AS faturamento,
                      ROUND(AVG(s.preco),2) AS media
               FROM agendamentos a
               JOIN funcionarios f ON f.id_funcionario = a.id_funcionario
               JOIN servicos s ON s.id_servicos = a.id_servico
               WHERE a.status = 'Concluído'
               GROUP BY f.id_funcionario, f.nome, f.cargo
               ORDER BY faturamento DESC`,
    title: 'Faturamento de serviços por funcionário',
    description: 'Considera apenas agendamentos concluídos.',
  },
  categorias: {
    view: 'SELECT * FROM vw_resumo_vendas_por_categoria',
    fallback: `SELECT pr.categoria,
                      SUM(iv.quantidade) AS qtd_vendida,
                      SUM(iv.quantidade * iv.preco_produto) AS faturamento,
                      COUNT(DISTINCT v.id_venda) AS vendas
               FROM item_venda iv
               JOIN vendas v ON v.id_venda = iv.id_venda
               JOIN produtos pr ON pr.id_produto = iv.id_produto
               GROUP BY pr.categoria
               ORDER BY faturamento DESC`,
    title: 'Vendas por categoria',
    description: 'Resumo da quantidade e do faturamento de produtos.',
  },
  caixa: {
    view: 'SELECT * FROM vw_fechamento_caixa_diario',
    fallback: `SELECT data_venda, forma_pagamento,
                      COUNT(*) AS qtd_vendas,
                      SUM(valor_total) AS total_recebido
               FROM vendas
               GROUP BY data_venda, forma_pagamento
               ORDER BY data_venda DESC`,
    title: 'Fechamento de caixa diário',
    description: 'Totais agrupados por data e forma de pagamento.',
  },
};

app.get('/api/relatorios/:tipo', async (req, res) => {
  const tipo = req.params.tipo;
  const report = reportQueries[tipo];
  if (!report) return res.status(404).json({ error: 'Relatório não encontrado' });

  try {
    let result;
    try {
      result = await pool.query(report.view);
    } catch (_viewErr) {
      // View não existe — usa query de fallback
      result = await pool.query(report.fallback);
    }

    const rows = result.rows;
    const headers = rows.length ? Object.keys(rows[0]) : [];
    const data = rows.map((r) => headers.map((h) => r[h]));

    res.json({
      title: report.title,
      description: report.description,
      headers,
      rows: data,
    });
  } catch (err) {
    handleError(res, err, 'Erro ao gerar relatório');
  }
});

/* ========================================================
   START
   ======================================================== */

app.listen(PORT, () => {
  console.log(`🐾 PetShop API rodando em http://localhost:${PORT}`);
});
