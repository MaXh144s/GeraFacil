// selection.js
// Validação de questões e algoritmo de seleção de questões para uma rodada,
// implementando a regra de repetição inteligente (acerto x erro x nunca vista).

const Selection = (() => {

  // ---------- Validação de importação ----------

  function validateQuestion(q, index) {
    const errors = [];
    if (typeof q !== 'object' || q === null) {
      return [`Item ${index}: não é um objeto de questão válido.`];
    }
    if (!q.materia || typeof q.materia !== 'string') {
      errors.push(`Item ${index}: campo "materia" ausente ou inválido.`);
    }
    if (!Array.isArray(q.alternativas) || q.alternativas.length < 2) {
      errors.push(`Item ${index}: precisa de ao menos 2 "alternativas".`);
    }
    if (
      q.correta == null ||
      typeof q.correta !== 'number' ||
      !Array.isArray(q.alternativas) ||
      q.correta < 0 ||
      q.correta >= (q.alternativas ? q.alternativas.length : 0)
    ) {
      errors.push(`Item ${index}: campo "correta" ausente ou fora do intervalo de alternativas.`);
    }
    const hasEnunciado = typeof q.enunciado === 'string' && q.enunciado.trim().length > 0;
    const hasImagem = typeof q.imagem === 'string' && q.imagem.trim().length > 0;
    if (!hasEnunciado && !hasImagem) {
      errors.push(`Item ${index}: precisa ter "enunciado" e/ou "imagem".`);
    }
    return errors;
  }

  // Valida uma lista bruta vinda do JSON importado.
  // Retorna { valid: [...], errors: [...] }
  function validateImport(rawList) {
    const valid = [];
    const errors = [];
    if (!Array.isArray(rawList)) {
      return { valid, errors: ['O JSON precisa ser uma lista (array) de questões.'] };
    }
    rawList.forEach((q, i) => {
      const itemErrors = validateQuestion(q, i + 1);
      if (itemErrors.length === 0) {
        valid.push(q);
      } else {
        errors.push(...itemErrors);
      }
    });
    return { valid, errors };
  }

  // ---------- Seleção de questões para uma rodada ----------

  // Peso de cada questão baseado no seu histórico:
  // - nunca respondida -> peso normal (1)
  // - acertada -> peso muito baixo (praticamente não reaparece)
  // - errada -> peso baixo logo após errar, crescendo com as rodadas
  //   desde a última aparição, e com leve bônus por quantidade de erros.
  function weightFor(historyEntry, currentRound) {
    if (!historyEntry || historyEntry.status === 'never') return 1;

    if (historyEntry.status === 'correct') return 0.03;

    if (historyEntry.status === 'wrong') {
      const roundsSince = historyEntry.lastSeenRound != null
        ? currentRound - historyEntry.lastSeenRound
        : 3;
      let weight = Math.min(0.9, Math.max(0.05, roundsSince * 0.18));
      weight += Math.min(0.2, (historyEntry.timesWrong || 0) * 0.03);
      return weight;
    }

    return 1;
  }

  // Amostragem aleatória ponderada, sem reposição.
  function weightedSample(items, count) {
    const pool = items.slice();
    const result = [];
    while (pool.length > 0 && result.length < count) {
      const total = pool.reduce((sum, it) => sum + it.weight, 0);
      if (total <= 0) break;
      let r = Math.random() * total;
      let idx = 0;
      for (; idx < pool.length; idx++) {
        r -= pool[idx].weight;
        if (r <= 0) break;
      }
      idx = Math.min(idx, pool.length - 1);
      result.push(pool[idx].q);
      pool.splice(idx, 1);
    }
    return result;
  }

  // bank: array de questões com id
  // history: { meta: { roundCount }, questions: { [id]: {...} } }
  // materiaFilter: string ou '' para todas
  // count: quantidade desejada
  function selectRound(bank, history, materiaFilter, count) {
    const pool = bank.filter(q => !materiaFilter || q.materia === materiaFilter);
    const currentRound = history.meta.roundCount;

    const weighted = pool.map(q => ({
      q,
      weight: weightFor(history.questions[q.id], currentRound),
    }));

    let selected = weightedSample(weighted, count);

    // Fallback: se o pool ponderado não preencher a quantidade pedida
    // (banco pequeno ou muitas questões já dominadas), completa com as
    // questões restantes, priorizando as vistas há mais tempo.
    if (selected.length < count) {
      const selectedIds = new Set(selected.map(q => q.id));
      const remaining = pool
        .filter(q => !selectedIds.has(q.id))
        .sort((a, b) => {
          const ha = history.questions[a.id];
          const hb = history.questions[b.id];
          const la = ha && ha.lastSeenRound != null ? ha.lastSeenRound : -1;
          const lb = hb && hb.lastSeenRound != null ? hb.lastSeenRound : -1;
          return la - lb;
        });
      for (const q of remaining) {
        if (selected.length >= count) break;
        selected.push(q);
      }
    }

    return selected;
  }

  return { validateImport, validateQuestion, selectRound };
})();