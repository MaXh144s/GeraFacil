// app.js
// Orquestra as telas (início, rodada, resultado) usando Storage e Selection.

(() => {
  let bank = Storage.loadBank();
  let history = Storage.loadHistory();

  let currentRound = null; // { questions: [...], answers: {id: altIndex}, index: 0 }

  const el = (id) => document.getElementById(id);

  // ---------- TELA INICIAL ----------

  function renderHome() {
    const materias = [...new Set(bank.map(q => q.materia).filter(Boolean))].sort();
    const select = el('select-materia');
    const currentValue = select.value;
    select.innerHTML = '<option value="">Todas as matérias</option>' +
      materias.map(m => `<option value="${escapeAttr(m)}">${escapeHtml(m)}</option>`).join('');
    if (materias.includes(currentValue)) select.value = currentValue;

    el('bank-status').textContent = bank.length === 0
      ? 'Nenhuma questão no banco ainda. Importe um JSON abaixo para começar.'
      : `${bank.length} questão(ões) no banco · ${materias.length} matéria(s).`;

    el('btn-start').disabled = bank.length === 0;
  }

  el('form-round').addEventListener('submit', (e) => {
    e.preventDefault();
    const materia = el('select-materia').value;
    let count = parseInt(el('input-count').value, 10);
    if (!count || count < 1) count = 10;
    startRound(materia, count);
  });

  // ---------- IMPORTAÇÃO ----------

  el('btn-import').addEventListener('click', () => {
    const feedback = el('import-feedback');
    const raw = el('import-textarea').value.trim();
    feedback.className = 'import-feedback';
    feedback.textContent = '';

    if (!raw) {
      feedback.classList.add('error');
      feedback.textContent = 'Cole um JSON antes de importar.';
      return;
    }

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      feedback.classList.add('error');
      feedback.textContent = 'JSON inválido: ' + e.message;
      return;
    }

    const { valid, errors } = Selection.validateImport(parsed);

    const existingIds = new Set(bank.map(q => q.id));
    valid.forEach(q => {
      q.id = Storage.makeQuestionId(q, existingIds);
      existingIds.add(q.id);
    });

    bank = bank.concat(valid);
    Storage.saveBank(bank);
    renderHome();

    const parts = [];
    if (valid.length > 0) parts.push(`${valid.length} questão(ões) importada(s) com sucesso.`);
    if (errors.length > 0) parts.push(`${errors.length} erro(s):\n` + errors.join('\n'));

    feedback.classList.add(errors.length > 0 ? 'error' : 'ok');
    feedback.textContent = parts.join('\n\n');

    if (valid.length > 0) el('import-textarea').value = '';
  });

  // ---------- EXEMPLO DE JSON ----------

  const EXAMPLE_JSON = [
    {
      numero: 1,
      materia: "Matemática",
      fonte: "ENEM-2022",
      enunciado: "Uma empresa possui 120 funcionários, distribuídos entre os setores administrativo, comercial e operacional.",
      comando: "Considerando essas informações, qual é o percentual de funcionários que trabalham no setor administrativo?",
      alternativas: ["10%", "20%", "25%", "30%", "40%"],
      correta: 2
    },
    {
      numero: 2,
      // A ordem entre os campos no JSON não importa — aqui "comando" vem
      // antes de "imagem" e "enunciado", ao contrário do exemplo acima.
      comando: "De acordo com o gráfico, a velocidade final do objeto é de aproximadamente:",
      imagem: "https://exemplo.com/questao2.png",
      materia: "Física",
      fonte: "ENEM-2023",
      alternativas: ["A", "B", "C", "D", "E"],
      correta: 0
    },
    {
      numero: 3,
      materia: "Literatura",
      // Sem "fonte" e sem "enunciado" (ambos opcionais) — quando não há
      // texto de apoio, só o "comando" já é suficiente.
      comando: "O eu lírico dirige-se diretamente a seu leitor em:",
      alternativas: ["Alternativa A", "Alternativa B", "Alternativa C", "Alternativa D"],
      correta: 1
    }
  ];

  el('btn-example').addEventListener('click', () => {
    el('import-textarea').value = JSON.stringify(EXAMPLE_JSON, null, 2);
    const feedback = el('import-feedback');
    feedback.className = 'import-feedback';
    feedback.textContent = '';
  });

  // ---------- RODADA ----------

  function startRound(materia, count) {
    const questions = Selection.selectRound(bank, history, materia, count);
    if (questions.length === 0) {
      alert('Não há questões disponíveis para essa seleção.');
      return;
    }
    currentRound = { questions, answers: {}, index: 0 };
    showScreen('round');
    renderQuestion();
  }

  function renderQuestion() {
    const { questions, index, answers } = currentRound;
    const q = questions[index];

    el('round-progress').textContent = `Questão ${index + 1} de ${questions.length}`;

    const metaParts = [];
    if (q.fonte) metaParts.push(q.fonte);
    if (q.materia) metaParts.push(q.materia);
    el('question-meta').textContent = metaParts.join(' · ');

    el('question-number').textContent = q.numero != null ? `Questão ${q.numero}` : '';

    const imageWrap = el('question-image-wrap');
    imageWrap.innerHTML = '';
    if (q.imagem) {
      const img = document.createElement('img');
      img.src = q.imagem;
      img.alt = q.enunciado ? q.enunciado.slice(0, 80) : `Imagem da questão ${q.numero || ''}`;
      img.addEventListener('click', () => openLightbox(q.imagem));
      imageWrap.appendChild(img);
    }

    el('question-statement').textContent = q.enunciado || '';

    const altsWrap = el('alternatives');
    altsWrap.innerHTML = '';
    q.alternativas.forEach((altText, i) => {
      const label = document.createElement('label');
      label.className = 'alt-option';
      if (answers[q.id] === i) label.classList.add('selected');

      const input = document.createElement('input');
      input.type = 'radio';
      input.name = 'alternativa';
      input.value = i;
      input.checked = answers[q.id] === i;
      input.addEventListener('change', () => {
        currentRound.answers[q.id] = i;
        renderQuestion();
      });

      const span = document.createElement('span');
      span.className = 'alt-text';
      span.textContent = altText;

      label.appendChild(input);
      label.appendChild(span);
      altsWrap.appendChild(label);
    });

    const isLast = index === questions.length - 1;
    const btnNext = el('btn-next');
    btnNext.textContent = isLast ? 'Finalizar rodada' : 'Próxima questão';
    btnNext.disabled = answers[q.id] == null;
  }

  el('btn-exit-round').addEventListener('click', () => {
    const ok = confirm('Sair sem terminar a rodada? As respostas desta rodada não serão salvas.');
    if (!ok) return;
    currentRound = null;
    showScreen('home');
    renderHome();
  });

  el('btn-next').addEventListener('click', () => {
    const { questions, index } = currentRound;
    if (index === questions.length - 1) {
      finishRound();
    } else {
      currentRound.index += 1;
      renderQuestion();
    }
  });

  function finishRound() {
    const { questions, answers } = currentRound;
    history.meta.roundCount += 1;
    const roundNumber = history.meta.roundCount;

    let correctCount = 0;
    const details = [];

    questions.forEach(q => {
      const picked = answers[q.id];
      const isCorrect = picked === q.correta;
      if (isCorrect) correctCount += 1;

      if (!history.questions[q.id]) {
        history.questions[q.id] = { timesShown: 0, timesCorrect: 0, timesWrong: 0, lastSeenRound: null, status: 'never' };
      }
      const h = history.questions[q.id];
      h.timesShown += 1;
      h.lastSeenRound = roundNumber;
      if (isCorrect) { h.timesCorrect += 1; h.status = 'correct'; }
      else { h.timesWrong += 1; h.status = 'wrong'; }

      details.push({ q, picked, isCorrect });
    });

    Storage.saveHistory(history);
    currentRound.details = details;
    currentRound.correctCount = correctCount;

    showResult(details, correctCount, questions.length);
  }

  // ---------- RESULTADO ----------

  function showResult(details, correctCount, total) {
    const wrongCount = total - correctCount;
    const percent = Math.round((correctCount / total) * 100);

    el('result-score').textContent = `${correctCount} / ${total} acertos`;
    el('result-percent').textContent = `${percent}%`;
    el('result-correct').textContent = `Acertos: ${correctCount}`;
    el('result-wrong').textContent = `Erros: ${wrongCount}`;

    const reviewList = el('review-list');
    reviewList.classList.add('hidden');
    reviewList.innerHTML = details.map(({ q, picked, isCorrect }) => {
      const metaParts = [];
      if (q.fonte) metaParts.push(q.fonte);
      if (q.materia) metaParts.push(q.materia);
      const altsHtml = q.alternativas.map((altText, i) => {
        let cls = 'rev-alt';
        if (i === q.correta) cls += ' is-correct';
        else if (i === picked) cls += ' is-wrong-picked';
        return `<div class="${cls}">${escapeHtml(altText)}</div>`;
      }).join('');
      return `
        <div class="review-item">
          <div class="rev-meta">${escapeHtml(metaParts.join(' · '))} ${isCorrect ? '✓' : '✗'}</div>
          <p class="rev-statement">${escapeHtml(q.enunciado || `Questão ${q.numero || ''}`)}</p>
          ${altsHtml}
        </div>`;
    }).join('');

    showScreen('result');
  }

  el('btn-review').addEventListener('click', () => {
    el('review-list').classList.toggle('hidden');
  });

  el('btn-new-round').addEventListener('click', () => {
    showScreen('home');
    renderHome();
  });

  // ---------- BANCO DE QUESTÕES ----------

  let editingId = null; // id da questão atualmente aberta no modal de edição
  let altVisible = false; // controla se o blur das alternativas está desativado (reseta a cada abertura do modal)

  el('btn-bank').addEventListener('click', () => {
    renderBankFilters();
    renderBankList();
    showScreen('bank');
  });

  el('btn-bank-back').addEventListener('click', () => {
    showScreen('home');
    renderHome();
  });

  function renderBankFilters() {
    const materias = [...new Set(bank.map(q => q.materia).filter(Boolean))].sort();
    const select = el('select-bank-materia');
    const currentValue = select.value;
    select.innerHTML = '<option value="">Todas as matérias</option>' +
      materias.map(m => `<option value="${escapeAttr(m)}">${escapeHtml(m)}</option>`).join('');
    if (materias.includes(currentValue)) select.value = currentValue;
  }

  el('select-bank-materia').addEventListener('change', renderBankList);
  el('input-bank-search').addEventListener('input', renderBankList);

  function renderBankList() {
    const materiaFilter = el('select-bank-materia').value;
    const term = el('input-bank-search').value.trim().toLowerCase();

    let list = bank.filter(q => !materiaFilter || q.materia === materiaFilter);
    if (term) {
      list = list.filter(q => {
        const haystack = [q.enunciado, q.fonte, q.numero, q.materia]
          .filter(v => v != null)
          .join(' ')
          .toLowerCase();
        return haystack.includes(term);
      });
    }

    list = list.slice().sort((a, b) => {
      const ma = a.materia || '';
      const mb = b.materia || '';
      if (ma !== mb) return ma.localeCompare(mb);
      return (a.numero || 0) - (b.numero || 0);
    });

    const container = el('bank-list');
    container.innerHTML = '';

    if (list.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'bank-empty';
      empty.textContent = bank.length === 0
        ? 'O banco ainda não tem questões.'
        : 'Nenhuma questão encontrada com esse filtro.';
      container.appendChild(empty);
      return;
    }

    list.forEach(q => {
      container.appendChild(renderBankItem(q));
    });
  }

  function renderBankItem(q) {
    const item = document.createElement('div');
    item.className = 'bank-item';

    if (q.imagem) {
      const thumb = document.createElement('img');
      thumb.className = 'bank-item-thumb';
      thumb.src = q.imagem;
      thumb.alt = '';
      item.appendChild(thumb);
    }

    const body = document.createElement('div');
    body.className = 'bank-item-body';

    const metaParts = [];
    if (q.fonte) metaParts.push(q.fonte);
    if (q.materia) metaParts.push(q.materia);
    if (q.numero != null) metaParts.push(`Questão ${q.numero}`);
    const meta = document.createElement('div');
    meta.className = 'bank-item-meta';
    meta.textContent = metaParts.join(' · ');
    body.appendChild(meta);

    const statement = document.createElement('p');
    statement.className = 'bank-item-statement';
    statement.textContent = q.enunciado || (q.imagem ? '[Questão com imagem, sem texto]' : '[Sem enunciado]');
    body.appendChild(statement);

    item.appendChild(body);

    const actions = document.createElement('div');
    actions.className = 'bank-item-actions';

    const btnEdit = document.createElement('button');
    btnEdit.type = 'button';
    btnEdit.className = 'btn btn-secondary btn-small';
    btnEdit.textContent = 'Editar';
    btnEdit.addEventListener('click', () => openEditModal(q.id));

    const btnRemove = document.createElement('button');
    btnRemove.type = 'button';
    btnRemove.className = 'btn btn-danger btn-small';
    btnRemove.textContent = 'Remover';
    btnRemove.addEventListener('click', () => removeQuestion(q.id));

    actions.appendChild(btnEdit);
    actions.appendChild(btnRemove);
    item.appendChild(actions);

    return item;
  }

  function removeQuestion(id) {
    const q = bank.find(x => x.id === id);
    if (!q) return;
    const label = q.enunciado ? q.enunciado.slice(0, 60) : `Questão ${q.numero || ''}`;
    const ok = confirm(`Remover esta questão do banco?\n\n"${label}"\n\nEssa ação não pode ser desfeita.`);
    if (!ok) return;

    bank = bank.filter(x => x.id !== id);
    Storage.saveBank(bank);

    if (history.questions[id]) {
      delete history.questions[id];
      Storage.saveHistory(history);
    }

    renderBankFilters();
    renderBankList();
  }

  // ---------- MODAL DE EDIÇÃO ----------

  function openEditModal(id) {
    const q = bank.find(x => x.id === id);
    if (!q) return;
    editingId = id;

    el('edit-materia').value = q.materia || '';
    el('edit-fonte').value = q.fonte || '';
    el('edit-numero').value = q.numero != null ? q.numero : '';
    el('edit-imagem').value = q.imagem || '';
    el('edit-enunciado').value = q.enunciado || '';

    renderEditAlternatives(q.alternativas || ['', ''], q.correta);

    altVisible = false;
    updateAltVisibility();

    const feedback = el('edit-feedback');
    feedback.className = 'import-feedback';
    feedback.textContent = '';

    el('edit-modal').classList.remove('hidden');
  }

  function closeEditModal() {
    editingId = null;
    el('edit-modal').classList.add('hidden');
  }

  el('btn-edit-cancel').addEventListener('click', closeEditModal);
  el('edit-modal').addEventListener('click', (e) => {
    if (e.target.id === 'edit-modal') closeEditModal();
  });

  function shuffleIndices(length) {
    const order = Array.from({ length }, (_, i) => i);
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    return order;
  }

  function renderEditAlternatives(alternativas, correctIndex) {
    const wrap = el('edit-alternatives');
    wrap.innerHTML = '';
    // A ordem é sorteada a cada abertura da edição, para não expor
    // a posição da resposta correta por hábito/memorização.
    const order = shuffleIndices(alternativas.length);
    order.forEach(i => {
      wrap.appendChild(buildEditAltRow(alternativas[i], i === correctIndex));
    });
  }

  function updateAltVisibility() {
    const wrap = el('edit-alternatives');
    wrap.classList.toggle('is-blurred', !altVisible);

    const btn = el('btn-toggle-alt-visibility');
    const icon = btn.querySelector('.eye-icon');
    const label = btn.querySelector('.eye-label');
    icon.textContent = altVisible ? '🙈' : '👁';
    label.textContent = altVisible ? 'Ocultar alternativas' : 'Ver alternativas';
    btn.setAttribute('aria-pressed', String(altVisible));
  }

  el('btn-toggle-alt-visibility').addEventListener('click', () => {
    altVisible = !altVisible;
    updateAltVisibility();
  });

  function buildEditAltRow(text, isCorrect) {
    const row = document.createElement('div');
    row.className = 'edit-alt-row';

    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = 'edit-correct';
    radio.checked = !!isCorrect;

    const input = document.createElement('input');
    input.type = 'text';
    input.value = text || '';
    input.placeholder = 'Texto da alternativa';

    const btnRemove = document.createElement('button');
    btnRemove.type = 'button';
    btnRemove.className = 'btn-remove-alt';
    btnRemove.title = 'Remover alternativa';
    btnRemove.textContent = '×';
    btnRemove.addEventListener('click', () => {
      const wrap = el('edit-alternatives');
      if (wrap.children.length <= 2) return; // mínimo de 2 alternativas
      row.remove();
    });

    row.appendChild(radio);
    row.appendChild(input);
    row.appendChild(btnRemove);
    return row;
  }

  el('btn-edit-add-alt').addEventListener('click', () => {
    el('edit-alternatives').appendChild(buildEditAltRow('', false));
  });

  el('edit-form').addEventListener('submit', (e) => {
    e.preventDefault();
    if (!editingId) return;

    const rows = [...el('edit-alternatives').children];
    const alternativas = rows.map(row => row.querySelector('input[type="text"]').value.trim());
    let correta = rows.findIndex(row => row.querySelector('input[type="radio"]').checked);

    const candidate = {
      materia: el('edit-materia').value.trim(),
      fonte: el('edit-fonte').value.trim(),
      numero: el('edit-numero').value ? parseInt(el('edit-numero').value, 10) : undefined,
      imagem: el('edit-imagem').value.trim(),
      enunciado: el('edit-enunciado').value.trim(),
      alternativas,
      correta,
    };

    const errors = Selection.validateQuestion(candidate, 1)
      .map(msg => msg.replace(/^Item 1: /, ''));

    const feedback = el('edit-feedback');
    if (errors.length > 0) {
      feedback.className = 'import-feedback error';
      feedback.textContent = errors.join('\n');
      return;
    }

    const idx = bank.findIndex(x => x.id === editingId);
    if (idx === -1) {
      closeEditModal();
      return;
    }

    bank[idx] = { ...bank[idx], ...candidate };
    Storage.saveBank(bank);

    closeEditModal();
    renderBankFilters();
    renderBankList();
  });

  // ---------- LIGHTBOX ----------

  function openLightbox(src) {
    el('lightbox-img').src = src;
    el('lightbox').classList.remove('hidden');
  }
  el('lightbox').addEventListener('click', () => {
    el('lightbox').classList.add('hidden');
  });

  // ---------- UTIL ----------

  function showScreen(name) {
    ['home', 'round', 'result', 'bank'].forEach(s => {
      el(`screen-${s}`).classList.toggle('hidden', s !== name);
    });
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
  function escapeAttr(str) {
    return escapeHtml(str).replace(/"/g, '&quot;');
  }

  // ---------- INIT ----------
  renderHome();
})();