// storage.js
// Camada de persistência local (localStorage) para o banco de questões
// e para o histórico de respostas do usuário.

const Storage = (() => {
  const KEY_BANK = 'bq_bank_v1';
  const KEY_HISTORY = 'bq_history_v1';

  function loadBank() {
    try {
      const raw = localStorage.getItem(KEY_BANK);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      console.error('Falha ao carregar banco de questões:', e);
      return [];
    }
  }

  function saveBank(bank) {
    localStorage.setItem(KEY_BANK, JSON.stringify(bank));
  }

  function defaultHistory() {
    return { meta: { roundCount: 0 }, questions: {} };
  }

  function loadHistory() {
    try {
      const raw = localStorage.getItem(KEY_HISTORY);
      if (!raw) return defaultHistory();
      const parsed = JSON.parse(raw);
      if (!parsed.meta) parsed.meta = { roundCount: 0 };
      if (!parsed.questions) parsed.questions = {};
      return parsed;
    } catch (e) {
      console.error('Falha ao carregar histórico:', e);
      return defaultHistory();
    }
  }

  function saveHistory(history) {
    localStorage.setItem(KEY_HISTORY, JSON.stringify(history));
  }

  // Gera um id estável para a questão. Prioriza fonte+numero (evita colisão
  // entre provas diferentes), com fallback para materia+numero, e por fim
  // um id sintético se nada disso existir.
  function makeQuestionId(q, existingIds) {
    let base;
    if (q.fonte && q.numero != null) base = `${q.fonte}__${q.numero}`;
    else if (q.materia && q.numero != null) base = `${q.materia}__${q.numero}`;
    else base = `q__${Math.random().toString(36).slice(2, 10)}`;

    let id = base;
    let suffix = 2;
    while (existingIds.has(id)) {
      id = `${base}__${suffix}`;
      suffix += 1;
    }
    return id;
  }

  return { loadBank, saveBank, loadHistory, saveHistory, makeQuestionId };
})();