(function () {
  const MAX_ENTRIES = 10;
  const NAME_MAX = 12;

  function storageKey(game) {
    return `arcade.leaderboard.${game}`;
  }

  function load(game) {
    try {
      const raw = localStorage.getItem(storageKey(game));
      if (!raw) return [];
      const data = JSON.parse(raw);
      return Array.isArray(data) ? data : [];
    } catch (e) {
      return [];
    }
  }

  function save(game, entries) {
    try {
      localStorage.setItem(storageKey(game), JSON.stringify(entries));
    } catch (e) {
      // ignore quota / privacy errors
    }
  }

  // For asteroids: higher score is better. For chess: lower move count is better.
  function comparator(game) {
    if (game === 'chess') return (a, b) => a.score - b.score;
    return (a, b) => b.score - a.score;
  }

  function qualifies(game, score) {
    const entries = load(game);
    if (entries.length < MAX_ENTRIES) return true;
    const cmp = comparator(game);
    const sorted = [...entries].sort(cmp);
    return cmp({ score }, sorted[MAX_ENTRIES - 1]) < 0;
  }

  function submit(game, name, score, extra) {
    const cleanName = (name || 'AAA').toString().slice(0, NAME_MAX).toUpperCase().replace(/[<>]/g, '');
    const entry = { name: cleanName || 'AAA', score, date: new Date().toISOString() };
    if (extra && typeof extra === 'object') Object.assign(entry, extra);
    const entries = load(game);
    entries.push(entry);
    entries.sort(comparator(game));
    const trimmed = entries.slice(0, MAX_ENTRIES);
    save(game, trimmed);
    return { entry, entries: trimmed, rank: trimmed.indexOf(entry) + 1 };
  }

  function formatValue(game, entry) {
    if (game === 'chess') {
      const side = entry.side ? ` (${entry.side === 'w' ? 'W' : 'B'})` : '';
      return `${entry.score} moves${side}`;
    }
    return entry.score.toLocaleString();
  }

  function render(game, container, highlightEntry) {
    if (!container) return;
    const entries = load(game).sort(comparator(game)).slice(0, MAX_ENTRIES);
    container.innerHTML = '';
    if (entries.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'leaderboard-empty';
      empty.textContent = 'No scores yet — be the first!';
      container.appendChild(empty);
      return;
    }
    const table = document.createElement('table');
    table.className = 'leaderboard-table';
    const header = document.createElement('tr');
    header.innerHTML = '<th>#</th><th>NAME</th><th>SCORE</th>';
    table.appendChild(header);
    entries.forEach((e, i) => {
      const row = document.createElement('tr');
      if (highlightEntry && e === highlightEntry) row.className = 'highlight';
      const rankCell = document.createElement('td');
      rankCell.textContent = String(i + 1);
      const nameCell = document.createElement('td');
      nameCell.textContent = e.name;
      const scoreCell = document.createElement('td');
      scoreCell.textContent = formatValue(game, e);
      row.appendChild(rankCell);
      row.appendChild(nameCell);
      row.appendChild(scoreCell);
      table.appendChild(row);
    });
    container.appendChild(table);
  }

  function clear(game) {
    save(game, []);
  }

  window.Leaderboard = { load, submit, render, qualifies, clear, MAX_ENTRIES };
})();
