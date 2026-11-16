/* 인천 고입 길잡이 — 화면 로직 (빌드 없음, 바닐라 JS). assets/lock.js 가 자료를 푼 뒤 불러옵니다. */
(function () {
  "use strict";
  const CUT = (window.CUTOFFS && window.CUTOFFS.rows) || [];
  const PANO = window.PANORAMA || { pages: [], schools: [], categories: [] };
  const YEARS = ["2025", "2024", "2023", "2022"];
  const $ = (s, el) => (el || document).querySelector(s);
  const $$ = (s, el) => Array.from((el || document).querySelectorAll(s));
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
    del(k) { try { localStorage.removeItem(k); } catch (e) {} },
  };
  const view = $("#view");
  function toast(msg) { const t = $("#toast"); t.textContent = msg; t.classList.add("show"); clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove("show"), 1600); }

  // ---------- 테마 ----------
  const applyTheme = t => t ? document.documentElement.setAttribute("data-theme", t) : document.documentElement.removeAttribute("data-theme");
  applyTheme(store.get("hb.theme", null));
  $("#lockBtn").addEventListener("click", () => window.HB_LOCK && window.HB_LOCK());
  $("#themeBtn").addEventListener("click", () => {
    const cur = document.documentElement.getAttribute("data-theme") || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    const next = cur === "dark" ? "light" : "dark"; applyTheme(next); store.set("hb.theme", next);
  });

  // ---------- 데이터 연결 ----------
  const norm = s => String(s).replace(/\(협약형\)|\(현[^)]*\)|국립|\s/g, "").replace(/고등학교$/, "고");
  const CUT_ALIAS = { "인천에너지고": "계산공업고" };
  const schoolById = new Map(PANO.schools.map(s => [s.id, s]));
  function cutRowsFor(s) { const key = CUT_ALIAS[s.id] || s.id; return CUT.filter(r => norm(r.school) === key); }
  function schoolForCut(r) { const n = norm(r.school); for (const s of PANO.schools) if ((CUT_ALIAS[s.id] || s.id) === n) return s; return null; }
  const kindOfCut = r => { const s = schoolForCut(r); return s ? s.kind : "특성화고"; };
  const displaySchool = s => s.name.replace(/\s*\(현 /, " (현 ");

  // ---------- 책갈피 (이 기기에만 저장) ----------
  const MARK_KEY = "hb.bookmarks";
  let marks = store.get(MARK_KEY, []);
  const isMarked = id => marks.some(m => m.id === id);
  function toggleMark(item) {
    if (isMarked(item.id)) { marks = marks.filter(m => m.id !== item.id); toast("책갈피에서 뺐어요"); }
    else { marks.unshift({ ...item, memo: "", at: Date.now() }); toast("책갈피에 저장했어요"); }
    store.set(MARK_KEY, marks);
    $$(`[data-mark="${CSS.escape(item.id)}"]`).forEach(b => { b.setAttribute("aria-pressed", isMarked(item.id)); b.textContent = isMarked(item.id) ? "★" : "☆"; });
  }
  const starBtn = item => `<button class="star" type="button" data-mark="${esc(item.id)}" data-item='${esc(JSON.stringify(item))}' aria-pressed="${isMarked(item.id)}" aria-label="책갈피">${isMarked(item.id) ? "★" : "☆"}</button>`;
  document.addEventListener("click", e => { const b = e.target.closest("[data-mark]"); if (!b) return; e.preventDefault(); e.stopPropagation(); toggleMark(JSON.parse(b.dataset.item)); });

  // ---------- 공통 조각 ----------
  function cutText(y, adm) { if (!y) return "–"; if (y[adm + "Under"]) return "미달"; const v = y[adm]; return v == null ? "–" : v.toFixed(1); }
  function notesHtml(row) {
    const parts = YEARS.map(y => {
      const d = row.years[y]; if (!d) return "";
      const extra = [d.specialRaw && `특별 원문: ${d.specialRaw}`, d.generalRaw && `일반 원문: ${d.generalRaw}`].filter(Boolean);
      if (!d.note && !extra.length) return "";
      return `<b>${y}</b> ${esc([d.note, ...extra].filter(Boolean).join("\n"))}`;
    }).filter(Boolean);
    return parts.length ? `<details><summary>합격·불합격 사례 보기</summary><div class="notes">${parts.join("\n\n")}</div></details>` : "";
  }
  const genderBadge = g => `<span class="b t-${esc(g)}">${g === "공학" ? "남녀공학" : g === "남" ? "남학생" : "여학생"}</span>`;
  const quota = d => d.total ? `${d.cls}학급 · ${d.total}명 (특별 ${d.sp ?? "-"} / 일반 ${d.gen ?? "-"})` : "통합 모집";

  // ---------- 라우팅 ----------
  const routes = { schools: renderSchools, find: renderFind, book: renderBook, schedule: renderSchedule, marks: renderMarks, chat: renderChat };
  function route() {
    const q = $("#q").value.trim();
    if (q) { renderSearch(q); setTab(null); return; }
    const h = decodeURIComponent(location.hash.slice(1)) || "schools";
    if (h.startsWith("school-")) { renderSchool(h.slice(7)); setTab("schools"); }
    else if (h.startsWith("page-")) { renderPage(parseInt(h.slice(5), 10)); setTab("book"); }
    else { (routes[h] || renderSchools)(); setTab(routes[h] ? h : "schools"); }
  }
  function setTab(t) { $$(".tab").forEach(a => a.dataset.tab === t ? a.setAttribute("aria-current", "page") : a.removeAttribute("aria-current")); }
  function go(hash) { if (location.hash === "#" + hash) route(); else location.hash = hash; window.scrollTo(0, 0); }
  window.addEventListener("hashchange", () => {
    if (location.hash.startsWith("#q=")) { $("#q").value = decodeURIComponent(location.hash.slice(3)); history.replaceState(null, "", "#schools"); }
    else $("#q").value = "";
    route(); window.scrollTo(0, 0);
  });
  $$(".tab").forEach(a => a.addEventListener("click", () => { if ($("#q").value) { $("#q").value = ""; route(); } }));

  // ---------- 학교·학과 ----------
  let schoolFilter = store.get("hb.schoolFilter", { kind: "all", cat: "" });
  function renderSchools() {
    const kinds = [["all", "전체"], ["공학", "남녀공학"], ["여", "여학생"], ["남", "남학생"], ["협약형 특성화고", "협약형"], ["마이스터고", "마이스터고"]];
    const cats = PANO.categories.map(c => c.name);
    let list = PANO.schools.filter(s => {
      if (schoolFilter.kind === "all") return true;
      if (schoolFilter.kind === "협약형 특성화고" || schoolFilter.kind === "마이스터고") return s.kind === schoolFilter.kind;
      return s.gender === schoolFilter.kind && s.kind === "특성화고";
    });
    let catHtml = "";
    if (schoolFilter.cat) {
      const c = PANO.categories.find(c => c.name === schoolFilter.cat);
      catHtml = `<div class="panel"><h3>${esc(c.name)} 관련 학과 (${c.items.length})</h3><div class="list">` + c.items.map(([d, sc]) => {
        const s = PANO.schools.find(x => x.short === norm(sc));
        return `<a class="card" href="#school-${esc(s ? s.id : "")}"><div class="title" style="font-size:.98rem">${esc(d)}</div><div class="sub">${esc(sc)}</div></a>`;
      }).join("") + `</div><p class="hint">출처: 2027 고입 파노라마 13쪽</p></div>`;
    }
    view.innerHTML = `
      <div class="panel">
        <h2 style="margin-top:0">특성화고·마이스터고 ${PANO.schools.length}개교</h2>
        <div class="chips" id="kindChips">${kinds.map(([v, l]) => `<button class="chip" type="button" data-v="${v}" aria-pressed="${schoolFilter.kind === v}">${l}</button>`).join("")}</div>
        <div class="field" style="margin-top:12px"><label for="catSel">계열별 학과 보기</label>
          <select id="catSel"><option value="">계열 선택</option>${cats.map(c => `<option ${schoolFilter.cat === c ? "selected" : ""}>${esc(c)}</option>`).join("")}</select></div>
        <p class="hint">일반고·특목고·자사고 정보는 <a href="#book">파노라마 전체보기</a>(2~6쪽)나 위 검색창에서 찾을 수 있어요.</p>
      </div>
      ${catHtml}
      <div class="list">${list.map(schoolCard).join("")}</div>`;
    $("#kindChips").addEventListener("click", e => { const b = e.target.closest("button"); if (!b) return; schoolFilter.kind = b.dataset.v; store.set("hb.schoolFilter", schoolFilter); renderSchools(); });
    $("#catSel").addEventListener("change", e => { schoolFilter.cat = e.target.value; store.set("hb.schoolFilter", schoolFilter); renderSchools(); });
  }
  function schoolCard(s) {
    const item = { id: "school:" + s.id, type: "학교", title: displaySchool(s), sub: s.kind + " · " + s.loc, href: "#school-" + s.id };
    return `<a class="card" href="#school-${esc(s.id)}"><div class="card-top"><div class="card-main">
      <div class="badges"><span class="b b-kind">${esc(s.kind)}</span>${genderBadge(s.gender)}<span class="b b-kind">${esc(s.field)}</span></div>
      <div class="title">${esc(displaySchool(s))}</div>
      <div class="sub">${s.depts.map(d => esc(d.name)).join(" · ")}</div>
      <div class="meta">${esc(s.loc)}</div></div>${starBtn(item)}</div></a>`;
  }
  function renderSchool(id) {
    const s = schoolById.get(id);
    if (!s) { view.innerHTML = `<div class="empty">학교를 찾을 수 없어요. <a href="#schools">학교 목록으로</a></div>`; return; }
    const item = { id: "school:" + s.id, type: "학교", title: displaySchool(s), sub: s.kind + " · " + s.loc, href: "#school-" + s.id };
    const cuts = cutRowsFor(s);
    view.innerHTML = `
      <p><a href="#schools">← 학교 목록</a></p>
      <div class="panel"><div class="card-top"><div class="card-main">
        <div class="badges"><span class="b b-kind">${esc(s.kind)}</span>${genderBadge(s.gender)}<span class="b b-kind">${esc(s.field)}</span></div>
        <h2 style="margin:2px 0 4px">${esc(displaySchool(s))}</h2>
        <dl class="kv"><dt>위치</dt><dd>인천 ${esc(s.loc)}</dd><dt>전화</dt><dd>032-${esc(s.tel)}</dd><dt>원문</dt><dd><a href="#page-${s.page}">파노라마 ${s.page}쪽 보기</a></dd></dl>
      </div>${starBtn(item)}</div></div>
      <div class="panel"><h3>2027학년도 특별전형 선발 방법</h3><div class="box">${esc(s.selection)}</div></div>
      <h2>개설 학과 (${s.depts.length})</h2>
      <div class="list">${s.depts.map((d, i) => {
        const it = { id: `dept:${s.id}:${i}`, type: "학과", title: `${displaySchool(s).replace(/\s*\(현.*\)/, "")} ${d.name}`, sub: quota(d), href: "#school-" + s.id };
        return `<div class="card"><div class="card-top"><div class="card-main">
          <div class="title">${esc(d.name)}</div><div class="meta">${esc(quota(d))}${d.note ? " · " + esc(d.note) : ""}</div></div>${starBtn(it)}</div>
          <p style="margin:8px 0 0;font-size:.92rem">${esc(d.intro)}</p>
          <dl class="kv"><dt>자격증</dt><dd>${esc(d.cert)}</dd><dt>취업</dt><dd>${esc(d.job)}</dd>${d.univ ? `<dt>진학</dt><dd>${esc(d.univ)}</dd>` : ""}</dl></div>`;
      }).join("")}</div>
      <h2>지난 커트라인 (석차백분율, %)</h2>
      ${cuts.length ? `<div class="panel"><div class="tbl-wrap"><table><thead><tr><th>학과</th>${YEARS.map(y => `<th class="n">${y} 특</th><th class="n">${y} 일</th>`).join("")}</tr></thead><tbody>
        ${cuts.map(r => `<tr><td><span class="b t-${esc(r.type)}">${esc(r.type)}</span> ${esc(r.dept)}${notesHtml(r)}</td>${YEARS.map(y => `<td class="n">${cutText(r.years[y], "special")}</td><td class="n">${cutText(r.years[y], "general")}</td>`).join("")}</tr>`).join("")}
      </tbody></table></div><p class="hint">특=특별전형, 일=일반전형. 숫자가 작을수록 상위권이며, 커트라인은 그 해 합격한 가장 낮은 성적입니다. "미달"은 지원자 전원 합격.</p></div>`
        : `<div class="empty">이 학교의 커트라인 자료가 없어요.</div>`}`;
  }

  // ---------- 합격권 찾기 ----------
  const GROUPS = [
    { key: "safe", name: "안정권", cls: "p-safe", desc: "커트라인보다 10%p 이상 여유", test: m => m >= 10, col: "var(--safe)" },
    { key: "fit", name: "적정권", cls: "p-fit", desc: "3~10%p 여유", test: m => m >= 3 && m < 10, col: "var(--fit)" },
    { key: "reach", name: "소신권", cls: "p-reach", desc: "0~3%p 여유", test: m => m >= 0 && m < 3, col: "var(--reach)" },
    { key: "try", name: "도전권", cls: "p-try", desc: "커트라인보다 0~5%p 부족", test: m => m < 0 && m >= -5, col: "var(--try)" },
  ];
  let findState = store.get("hb.find", { score: "", gender: "남", adm: "special", basis: "2025", q: "", showTry: false });
  function cutValue(row, adm, basis) {
    if (basis === "avg2" || basis === "avg4") {
      const vs = (basis === "avg2" ? YEARS.slice(0, 2) : YEARS).map(y => row.years[y] && row.years[y][adm]).filter(v => v != null);
      return vs.length ? Math.round(vs.reduce((a, b) => a + b, 0) / vs.length * 10) / 10 : null;
    }
    const y = row.years[basis]; return y ? y[adm] : null;
  }
  const basisLabel = b => b === "avg2" ? "최근 2년 평균" : b === "avg4" ? "4년 평균" : b + " 커트라인";
  function renderFind() {
    const f = findState;
    view.innerHTML = `
      <div class="panel">
        <div class="grid">
          <div class="field"><label for="fScore">내 석차백분율 (%)</label><input id="fScore" type="number" inputmode="decimal" min="0" max="100" step="0.1" placeholder="예: 62.5" value="${esc(f.score)}"></div>
          <div class="field"><label>성별</label><div class="seg" id="fGender">${["남", "여"].map(v => `<button type="button" data-v="${v}" aria-pressed="${f.gender === v}">${v}</button>`).join("")}</div></div>
          <div class="field"><label>전형</label><div class="seg" id="fAdm"><button type="button" data-v="special" aria-pressed="${f.adm === "special"}">특별</button><button type="button" data-v="general" aria-pressed="${f.adm === "general"}">일반</button></div></div>
          <div class="field"><label for="fBasis">기준</label><select id="fBasis">${[["2025", "2025 커트라인"], ["2024", "2024 커트라인"], ["2023", "2023 커트라인"], ["2022", "2022 커트라인"], ["avg2", "최근 2년 평균"], ["avg4", "4년 평균"]].map(([v, l]) => `<option value="${v}" ${f.basis === v ? "selected" : ""}>${l}</option>`).join("")}</select></div>
        </div>
        <div class="row" style="margin-top:12px"><div class="grow"><input id="fQ" type="search" placeholder="학교·학과로 좁히기 (예: 조리)" value="${esc(f.q)}"></div>
          <label class="check"><input type="checkbox" id="fTry" ${f.showTry ? "checked" : ""}> 도전권도 보기</label></div>
        <p class="hint">석차백분율은 <b>숫자가 작을수록 상위권</b>입니다. 내 %가 커트라인보다 작거나 같으면 지원 가능권이에요. 출결·학과체험·가산점에 따라 결과가 달라질 수 있어요.</p>
      </div>
      <div id="fOut"></div>`;
    const upd = () => { store.set("hb.find", findState); drawFind(); };
    $("#fScore").addEventListener("input", e => { findState.score = e.target.value; upd(); });
    $("#fQ").addEventListener("input", e => { findState.q = e.target.value; upd(); });
    $("#fBasis").addEventListener("change", e => { findState.basis = e.target.value; upd(); });
    $("#fTry").addEventListener("change", e => { findState.showTry = e.target.checked; upd(); });
    [["#fGender", "gender"], ["#fAdm", "adm"]].forEach(([sel, key]) => $(sel).addEventListener("click", e => {
      const b = e.target.closest("button"); if (!b) return; findState[key] = b.dataset.v;
      $$(sel + " button").forEach(x => x.setAttribute("aria-pressed", x === b)); upd();
    }));
    drawFind();
  }
  function drawFind() {
    const out = $("#fOut"), f = findState, score = parseFloat(f.score);
    if (f.score === "" || isNaN(score)) { out.innerHTML = `<div class="empty">내 석차백분율을 입력하면 바로 결과가 나와요.</div>`; return; }
    if (score < 0 || score > 100) { out.innerHTML = `<div class="empty">석차백분율은 0~100 사이로 입력해 주세요.</div>`; return; }
    const items = CUT.filter(r => r.type === "공학" || r.type === f.gender).filter(r => !f.q || (r.school + r.dept).includes(f.q.trim()))
      .map(r => ({ r, cut: cutValue(r, f.adm, f.basis) })).filter(x => x.cut != null).map(x => ({ ...x, margin: Math.round((x.cut - score) * 10) / 10 }));
    const buckets = GROUPS.filter(g => g.key !== "try" || f.showTry).map(g => ({ ...g, list: items.filter(x => g.test(x.margin)).sort((a, b) => a.cut - b.cut) }));
    const total = buckets.filter(b => b.key !== "try").reduce((n, b) => n + b.list.length, 0);
    if (!buckets.some(b => b.list.length)) { out.innerHTML = `<div class="empty">${esc(score)}%로 지원 가능한 학과가 자료에 없어요. 기준을 바꾸거나 도전권을 켜 보세요.</div>`; return; }
    let html = `<div class="summary"><span class="pill" style="background:var(--surface-2);color:var(--text)">지원 가능 ${total}개 학과</span>${buckets.map(b => `<span class="pill ${b.cls}">${b.name} ${b.list.length}</span>`).join("")}</div>`;
    for (const b of buckets) {
      if (!b.list.length) continue;
      html += `<h3 class="group-h"><span class="pill ${b.cls}">${b.name}</span><small>${b.desc} · 상위권 학과부터</small></h3><div class="list">`;
      html += b.list.map(({ r, cut, margin }) => {
        const under = f.basis.length === 4 && r.years[f.basis] && r.years[f.basis][f.adm + "Under"];
        const s = schoolForCut(r);
        const it = { id: `cut:${r.id}`, type: "커트라인", title: `${r.school} ${r.dept}`, sub: `${basisLabel(f.basis)} ${under ? "미달" : cut.toFixed(1) + "%"}`, href: s ? "#school-" + s.id : "#find" };
        return `<article class="card"><div class="card-top"><div class="card-main">
          <div class="badges"><span class="b t-${esc(r.type)}">${esc(r.type)}</span><span class="b b-kind">${esc(kindOfCut(r))}</span></div>
          <div class="title">${s ? `<a href="#school-${esc(s.id)}" style="color:inherit">${esc(r.school.replace("(협약형)", ""))}</a>` : esc(r.school)}</div><div class="sub">${esc(r.dept)}</div></div>
          <div class="cut"><div class="v" style="color:${b.col}">${under ? "미달" : cut.toFixed(1) + "%"}</div><div class="u">${basisLabel(f.basis)}</div>
          <div class="m" style="color:${b.col}">${margin >= 0 ? "여유 " + margin.toFixed(1) : "부족 " + Math.abs(margin).toFixed(1)}%p</div></div>${starBtn(it)}</div>
          <div class="trend">${YEARS.map(y => `<span>${y.slice(2)} 특 <b>${cutText(r.years[y], "special")}</b> · 일 <b>${cutText(r.years[y], "general")}</b></span>`).join("")}</div>
          ${notesHtml(r)}</article>`;
      }).join("") + `</div>`;
    }
    out.innerHTML = html;
  }

  // ---------- 파노라마 전체보기 ----------
  function renderBook() {
    view.innerHTML = `<div class="panel"><h2 style="margin-top:0">2027 고입 파노라마 (20쪽)</h2>
      <p class="sub" style="margin-top:0">인천광역시교육청 진로진학지원단 마중물에서 만든 2027학년도 고입·대입 안내 자료예요. 쪽을 누르면 원문 그대로 볼 수 있어요.</p>
      <nav class="toc">${PANO.pages.map(p => `<a href="#page-${p.page}"><b>${p.page}</b><span>${esc(p.title)}</span>${isMarked("page:" + p.page) ? `<span style="margin-left:auto;color:#e0a800">★</span>` : ""}</a>`).join("")}</nav></div>`;
  }
  function renderPage(n) {
    const p = PANO.pages.find(x => x.page === n);
    if (!p) { renderBook(); return; }
    const item = { id: "page:" + n, type: "파노라마", title: `${n}쪽 · ${p.title}`, sub: "2027 고입 파노라마", href: "#page-" + n };
    const here = PANO.schools.filter(s => s.page === n);
    view.innerHTML = `
      <div class="pager"><a class="btn ghost" href="#book">목차</a>
        <div class="row" style="gap:6px">${n > 1 ? `<a class="btn ghost" href="#page-${n - 1}" aria-label="이전 쪽">‹ ${n - 1}</a>` : ""}${n < PANO.pages.length ? `<a class="btn ghost" href="#page-${n + 1}" aria-label="다음 쪽">${n + 1} ›</a>` : ""}</div></div>
      <div class="panel"><div class="card-top"><div class="card-main"><div class="meta">${n}쪽</div><h2 style="margin:2px 0 0">${esc(p.title)}</h2></div>${starBtn(item)}</div>
        ${here.length ? `<div class="chips" style="margin-top:10px">${here.map(s => `<a class="chip" href="#school-${esc(s.id)}">${esc(s.short)}</a>`).join("")}</div><p class="hint">학교 이름을 누르면 학과 정보를 글로 크게 볼 수 있어요.</p>` : ""}</div>
      <a id="pgLink" target="_blank" rel="noopener" title="새 창에서 크게 보기"><img class="pageimg" id="pgImg" alt="2027 고입 파노라마 ${n}쪽 ${esc(p.title)}" style="min-height:300px"></a>
      <p class="hint">이미지를 누르면 새 창에서 크게 볼 수 있어요. 휴대폰에서는 두 손가락으로 확대하세요.</p>
      ${here.length ? `<div class="panel"><h3>옮겨 적은 내용 확인표</h3>
        <p class="sub" style="margin-top:0">이 쪽은 그림으로 되어 있어 사람이 읽고 옮겨 적었어요. 위 원문과 한 줄씩 비교해 보고, 다른 곳이 있으면 알려 주세요.</p>
        <div class="tbl-wrap"><table><thead><tr><th>연번</th><th>학교</th><th>학과</th><th class="n">학급</th><th class="n">전체</th><th class="n">특별</th><th class="n">일반</th></tr></thead><tbody>
        ${here.map(s => s.depts.map((d, i) => `<tr><td>${i ? "" : esc(s.no)}</td><td>${i ? "" : `<a href="#school-${esc(s.id)}">${esc(s.name)}</a>`}</td><td>${esc(d.name)}</td><td class="n">${d.cls ?? "-"}</td><td class="n">${d.total ?? "-"}</td><td class="n">${d.sp ?? "-"}</td><td class="n">${d.gen ?? "-"}</td></tr>`).join("")).join("")}
        </tbody></table></div>
        <details><summary>선발 방법·위치·전화도 비교하기</summary><div class="notes">${here.map(s => `<b>${esc(s.name)}</b>\n${esc(s.selection)}\n위치: ${esc(s.loc)} · ☎ ${esc(s.tel)}`).join("\n\n")}</div></details>
        <p class="hint">"-"는 원문에 숫자가 없거나 통합 모집이라 학과별 숫자가 없는 경우예요.</p></div>` : ""}
      <details class="panel"><summary>이 쪽의 글자만 보기</summary><div class="box" style="margin-top:8px">${esc(p.text)}</div></details>`;
    if (window.HB_IMG) window.HB_IMG(n).then(url => { const i = $("#pgImg"), a = $("#pgLink"); if (i) { i.src = url; i.style.minHeight = ""; } if (a) a.href = url; }).catch(() => { const i = $("#pgImg"); if (i) i.alt = "이미지를 불러오지 못했어요"; });
  }

  // ---------- 일정·출결 ----------
  const SCHED = [
    ["마이스터고", "2026-10-19~2026-10-22", "2026-10-30", "2026-11-04"],
    ["특성화고 특별전형", "2026-11-23", "2026-11-25~2026-11-26", "2026-11-27"],
    ["특성화고 일반전형", "2026-11-30", "2026-12-01", "2026-12-02"],
    ["마이스터고 추가모집", "2026-12-02", "2026-12-03", "2026-12-04"],
    ["특성화고 추가모집", "2027-01-11", "2027-01-12", "2027-01-13"],
  ];
  function renderSchedule() {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const fmt = d => `${d.getMonth() + 1}.${d.getDate()}.(${"일월화수목금토"[d.getDay()]})`;
    let next = null;
    const cell = (txt, key) => {
      const [a, b] = txt.split("~").map(x => new Date(x + "T00:00:00")); const end = b || a;
      if (end >= today && (!next || a < next.a)) next = { a, end, key };
      return { a, end, html: fmt(a) + (b ? " ~ " + fmt(b) : ""), key };
    };
    const rows = SCHED.map((r, i) => [r[0], ...r.slice(1).map((c, j) => cell(c, i + "-" + j))]);
    const td = c => {
      const past = c.end < today, isNext = next && next.key === c.key;
      const dd = isNext ? Math.round((next.a - today) / 864e5) : 0;
      return `<td style="${past ? "color:var(--muted)" : ""}">${c.html}${isNext ? ` <span class="pill p-reach" style="padding:1px 7px">${dd <= 0 ? "진행 중" : "D-" + dd}</span>` : ""}</td>`;
    };
    view.innerHTML = `
      <div class="panel"><div class="card-top"><div class="card-main"><h2 style="margin-top:0">2027학년도 특성화고·마이스터고 입학전형 일정</h2></div>${starBtn({ id: "sched", type: "일정", title: "특성화고·마이스터고 입학전형 일정", sub: "2027학년도", href: "#schedule" })}</div>
        <div class="tbl-wrap"><table><thead><tr><th>구분</th><th>원서 접수</th><th>입학 전형</th><th>합격자 발표</th></tr></thead>
        <tbody>${rows.map(r => `<tr><td><b>${esc(r[0])}</b></td>${r.slice(1).map(td).join("")}</tr>`).join("")}</tbody></table></div>
        <p class="hint">중학교 석차연명부 작성 기준일: <b>2026. 11. 17.(화)</b> — 이날까지의 성적·출결이 반영돼요. 출처: 파노라마 13·20쪽</p>
        <h3 style="margin-top:18px">다른 고등학교 일정</h3>
        <ul class="timeline">
          <li><span class="when">8.24~8.26</span><span>과학고 원서 접수 (전형 11.20, 발표 11.27)</span></li>
          <li><span class="when">9.21~9.23</span><span>체육고 원서 접수 (전형 11.6, 발표 11.13)</span></li>
          <li><span class="when">9.28~10.2</span><span>예술고 원서 접수 (인천대중예술고 9.28~30, 인천예술고 9.30~10.2)</span></li>
          <li><span class="when">12.4~12.11</span><span>외고·국제고·자사고 원서 접수 (포스코고 12.4~8, 외고·국제고 12.7~9, 하늘고 12.8~11) · 발표 12.28~12.29</span></li>
          <li><span class="when">12.7~12.14</span><span>특수지 일반고(강화·옹진·영종) 특별전형 12.7 접수 / 일반전형 12.10 접수 · 발표 12.14</span></li>
          <li><span class="when">12.7~12.11</span><span>평준화지역 일반고(예술·IB중점과정 포함) 원서 접수 · 배정예정자 발표 1.6 · 배정학교 발표 1.15 · 예비소집 1.18</span></li>
          <li><span class="when">1.11~1.13</span><span>전·후기고 추가모집</span></li>
        </ul>
        <p class="hint">먼저 시행한 전형에 합격하면 이후 전형에 응시할 수 없어요. 자세한 내용은 <a href="#page-20">파노라마 20쪽</a>과 <a href="#page-2">2쪽</a>을 확인하세요.</p>
      </div>
      <div class="panel">
        <h2 style="margin-top:0">출석 점수 계산 (21점 만점)</h2>
        <p class="sub" style="margin-top:0">커트라인 사례의 "출결21", "출결10" 같은 표기가 이 점수예요. 1~3학년 전체 <b>미인정</b> 기록으로 계산해요.</p>
        <div class="grid">
          <div class="field"><label for="a1">미인정 결석 (일)</label><input id="a1" type="number" min="0" value="0" inputmode="numeric"></div>
          <div class="field"><label for="a2">미인정 지각 (회)</label><input id="a2" type="number" min="0" value="0" inputmode="numeric"></div>
          <div class="field"><label for="a3">미인정 조퇴 (회)</label><input id="a3" type="number" min="0" value="0" inputmode="numeric"></div>
          <div class="field"><label for="a4">미인정 결과 (회)</label><input id="a4" type="number" min="0" value="0" inputmode="numeric"></div>
        </div>
        <div class="row" style="margin-top:14px;align-items:stretch">
          <div class="stat"><div class="k">환산 결석일수</div><div class="v" id="aDays">0일</div></div>
          <div class="stat"><div class="k">출석 점수</div><div class="v" id="aScore">21점</div></div>
          <div class="stat"><div class="k">만점 대비</div><div class="v" id="aLoss">−0점</div></div>
        </div>
        <p class="hint">미인정 지각·조퇴·결과 합계 3회 = 결석 1일. 미인정 결석 2일마다 1점 감점(1~2일 20점, 3~4일 19점 … 21일 이상 10점). 학교별 반영 방식은 요강을 확인하세요.</p>
        <h3 style="margin-top:16px">고입 전형용 중학교 성적 산출 (300점)</h3>
        <div class="tbl-wrap"><table><thead><tr><th>영역</th><th class="n">비율</th><th class="n">점수</th><th>세부 내용</th></tr></thead><tbody>
          <tr><td>교과 성적</td><td class="n">80%</td><td class="n">240</td><td>1·2학년 40%(80점) + 3학년 60%(120점) + 기본점수 40점. 자유학기 성적 미반영</td></tr>
          <tr><td>출석</td><td class="n">7%</td><td class="n">21</td><td>위 계산기 참고</td></tr>
          <tr><td>행동발달</td><td class="n">3%</td><td class="n">9</td><td>학년별 기본 2점 + 교내 표창 1점</td></tr>
          <tr><td>자율·동아리·진로</td><td class="n">5%</td><td class="n">15</td><td>학년별 기본 2점 + 영역별 가산 1점</td></tr>
          <tr><td>봉사</td><td class="n">5%</td><td class="n">15</td><td>20시간 이상 4점 / 11~20시간 3점 / 11시간 미만 2점 + 봉사 교내 표창 1점</td></tr>
        </tbody></table></div>
      </div>
      <div class="panel links"><h2 style="margin-top:0">참고 사이트</h2>
        <a href="https://www.hifive.go.kr/" target="_blank" rel="noopener">특성화고·마이스터고 포털 하이파이브 (Hi-Five)<small>교육부 운영 · 특성화고·마이스터고 포털 운영지원센터 · 전국 직업계고 학교·학과·입학 정보 · ☎ 1544-1253</small></a>
        <a href="https://xn--989a3bt57hyrbu9dkzf.kr/v2026/" target="_blank" rel="noopener">인천 특성화고·마이스터고 정보포털 (인천직업계고.kr)<small>인천 학교별 학과 소개와 입학 안내 · ☎ 032-420-8465</small></a>
        <a href="https://www.ice.go.kr/ice/na/ntt/selectNttList.do?mi=10889&amp;bbsId=1618" target="_blank" rel="noopener">인천광역시교육청 고입자료실<small>입학전형 기본계획·실시계획 공고</small></a>
        <a href="https://www.ice.go.kr/jci" target="_blank" rel="noopener">인천 직업계고 취업지원센터<small>☎ 032-550-1722, 1728~9</small></a>
        <a href="https://cyberjinro.ice.go.kr/" target="_blank" rel="noopener">인천사이버진로교육원<small>진로진학정보 → 고입정보, 마중물 진학상담 신청</small></a>
        <a href="https://hischool.go.kr/" target="_blank" rel="noopener">고입정보포털 하이스쿨<small>전국 고등학교 정보 검색</small></a>
      </div>`;
    const calc = () => {
      const n = id => Math.max(0, parseInt($(id).value, 10) || 0);
      const days = n("#a1") + Math.floor((n("#a2") + n("#a3") + n("#a4")) / 3);
      const sc = days >= 21 ? 10 : 21 - Math.ceil(days / 2);
      $("#aDays").textContent = days + "일"; $("#aScore").textContent = sc + "점"; $("#aLoss").textContent = "−" + (21 - sc) + "점";
    };
    ["#a1", "#a2", "#a3", "#a4"].forEach(s => $(s).addEventListener("input", calc));
  }

  // ---------- 책갈피 ----------
  function renderMarks() {
    view.innerHTML = `<div class="panel"><h2 style="margin-top:0">★ 책갈피</h2>
      <p class="sub" style="margin:0">학교, 학과, 커트라인, 파노라마 쪽, 검색어 옆의 ☆를 누르면 여기에 모여요. <b>이 기기(브라우저)에만 저장</b>되고 다른 사람이나 서버로 보내지 않아요. 브라우저 기록을 지우면 함께 지워져요.</p></div>
      ${marks.length ? `<div class="list">${marks.map((m, i) => `<div class="card"><div class="card-top"><div class="card-main">
        <div class="badges"><span class="b b-kind">${esc(m.type)}</span></div>
        <a class="title" href="${esc(m.href)}" style="color:inherit;display:block">${esc(m.title)}</a><div class="meta">${esc(m.sub || "")}</div></div>
        <button class="star" type="button" data-del="${i}" aria-label="책갈피 지우기" title="지우기">✕</button></div>
        <textarea data-memo="${i}" rows="1" placeholder="메모 (이 기기에만 저장)" style="margin-top:8px;font-size:.9rem">${esc(m.memo || "")}</textarea></div>`).join("")}</div>`
        : `<div class="empty">아직 저장한 책갈피가 없어요.<br>관심 있는 학교나 학과 옆의 ☆를 눌러 보세요.</div>`}`;
    view.onclick = e => { const b = e.target.closest("[data-del]"); if (!b) return; marks.splice(+b.dataset.del, 1); store.set(MARK_KEY, marks); renderMarks(); };
    view.oninput = e => { const t = e.target.closest("[data-memo]"); if (!t) return; marks[+t.dataset.memo].memo = t.value; store.set(MARK_KEY, marks); };
  }

  // ---------- 전체 검색 ----------
  function hl(text, toks) {
    let h = esc(text);
    toks.forEach(t => { if (!t) return; const re = new RegExp(esc(t).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"); h = h.replace(re, m => `<mark>${m}</mark>`); });
    return h;
  }
  function snippets(text, toks, max) {
    const out = [], low = text.toLowerCase(); let from = 0;
    while (out.length < max) {
      let best = -1; toks.forEach(t => { const i = low.indexOf(t.toLowerCase(), from); if (i >= 0 && (best < 0 || i < best)) best = i; });
      if (best < 0) break;
      const s = Math.max(0, best - 50), e = Math.min(text.length, best + 110);
      out.push((s > 0 ? "…" : "") + text.slice(s, e).replace(/\s+/g, " ") + (e < text.length ? "…" : "")); from = e;
    }
    return out;
  }
  const deptText = d => [d.name, d.intro, d.cert, d.job, d.univ, d.note].join(" ");
  // 같은 뜻의 다른 표현도 함께 찾기
  const SYN = { "미술중점": ["예술중점"], "예술중점": ["미술중점"], "공고": ["공업고"], "여상": ["여자상업고"], "마이스터": ["마이스터고"], "커트": ["커트라인"], "컷": ["커트라인"], "출결": ["출석"], "출석": ["출결"], "남녀공학": ["공학"], "애니": ["애니메이션"] };
  const squash = t => String(t || "").toLowerCase().replace(/\s+/g, "");
  function renderSearch(q) {
    const toks = q.toLowerCase().split(/\s+/).filter(Boolean);
    const alts = toks.map(k => [k, ...(SYN[k] || [])].map(squash));
    const has = t => { const l = squash(t); return alts.every(a => a.some(k => l.includes(k))); };
    toks.push(...toks.flatMap(k => SYN[k] || []));
    const sch = PANO.schools.map(s => {
      const whole = [s.name, s.kind, s.gender, s.field, s.loc, s.selection, ...s.depts.map(deptText)].join(" ");
      if (!has(whole)) return null;
      const ds = s.depts.filter(d => toks.some(k => deptText(d).toLowerCase().includes(k)));
      return { s, ds, sel: toks.some(k => s.selection.toLowerCase().includes(k)) };
    }).filter(Boolean);
    const cuts = CUT.filter(r => has([r.school, r.dept, r.type, ...YEARS.map(y => r.years[y].note)].join(" ")));
    const pages = PANO.pages.filter(p => !(p.page >= 7 && p.page <= 12) && has(p.title + " " + p.text));
    const item = { id: "search:" + q, type: "검색어", title: q, sub: "검색 결과 다시 보기", href: "#q=" + encodeURIComponent(q) };
    const total = sch.length + cuts.length + pages.length;
    view.innerHTML = `<div class="panel"><div class="card-top"><div class="card-main"><h2 style="margin:0">"${esc(q)}" 검색 결과 ${total}건</h2>
      <div class="meta">학교·학과 ${sch.length} · 커트라인 ${cuts.length} · 파노라마 ${pages.length}쪽</div></div>${starBtn(item)}</div>
      <p class="hint">띄어쓰기로 여러 단어를 넣으면 모두 포함한 결과만 보여요. 원하는 결과가 없으면 <a href="#chat">AI 상담</a>에 물어보세요.</p></div>
      ${sch.length ? `<h3 class="group-h">학교·학과</h3><div class="list">${sch.map(({ s, ds, sel }) => `<a class="card" href="#school-${esc(s.id)}">
        <div class="badges"><span class="b b-kind">${esc(s.kind)}</span>${genderBadge(s.gender)}</div>
        <div class="title">${hl(displaySchool(s), toks)}</div>
        ${ds.length ? `<div class="snip">${ds.map(d => `<b>${hl(d.name, toks)}</b> — ${hl(snippets(deptText(d), toks, 1)[0] || d.intro, toks)}`).join("<br>")}</div>` : ""}
        ${sel ? `<div class="snip"><b>선발 방법</b> — ${hl(snippets(s.selection, toks, 1)[0] || "", toks)}</div>` : ""}</a>`).join("")}</div>` : ""}
      ${pages.length ? `<h3 class="group-h">2027 고입 파노라마</h3><div class="list">${pages.map(p => `<a class="card" href="#page-${p.page}">
        <div class="meta">${p.page}쪽</div><div class="title" style="font-size:.98rem">${hl(p.title, toks)}</div>
        ${snippets(p.text, toks, 2).map(sn => `<div class="snip">${hl(sn, toks)}</div>`).join("")}</a>`).join("")}</div>` : ""}
      ${cuts.length ? `<h3 class="group-h">커트라인·합격 사례</h3><div class="list">${cuts.slice(0, 60).map(r => { const s = schoolForCut(r); return `<div class="card">
        <div class="title" style="font-size:.98rem">${s ? `<a href="#school-${esc(s.id)}" style="color:inherit">${hl(r.school.replace("(협약형)", "") + " " + r.dept, toks)}</a>` : hl(r.school + " " + r.dept, toks)}</div>
        <div class="trend">${YEARS.map(y => `<span>${y.slice(2)} 특 <b>${cutText(r.years[y], "special")}</b> · 일 <b>${cutText(r.years[y], "general")}</b></span>`).join("")}</div>
        ${YEARS.map(y => r.years[y].note && toks.some(k => r.years[y].note.toLowerCase().includes(k)) ? `<div class="snip"><b>${y}</b> ${hl(r.years[y].note.replace(/\n/g, " / "), toks)}</div>` : "").join("")}</div>`; }).join("")}</div>` : ""}
      ${total ? "" : `<div class="empty">"${esc(q)}"와 일치하는 내용이 없어요. 다른 단어로 찾아보거나 <a href="#chat">AI 상담</a>을 이용해 보세요.</div>`}`;
  }
  let qTimer;
  $("#q").addEventListener("input", () => { clearTimeout(qTimer); qTimer = setTimeout(route, 150); });
  $("#q").addEventListener("keydown", e => { if (e.key === "Escape") { e.target.value = ""; route(); } });

  // ---------- AI 상담 (Gemini) ----------
  const KEY = "hb.gemini.key", MODEL = "hb.gemini.model";
  let chat = [];
  const inArtifact = /claude\.ai|claudeusercontent/.test(location.hostname);
  function buildChunks() {
    const chunks = [];
    const cutLine = r => `${r.school} ${r.dept}(${r.type}) 커트라인 ` + YEARS.map(y => `${y} 특별 ${cutText(r.years[y], "special")} 일반 ${cutText(r.years[y], "general")}` + (r.years[y].note ? ` [사례: ${r.years[y].note.replace(/\n/g, "; ")}]` : "")).join(" / ");
    PANO.schools.forEach(s => {
      const t = [`[학교] ${s.name} — ${s.kind}, ${s.gender === "공학" ? "남녀공학" : s.gender + "학생만"}, ${s.field}계열, 위치 인천 ${s.loc} (파노라마 ${s.page}쪽)`, `특별전형 선발방법: ${s.selection}`,
        ...s.depts.map(d => `학과 ${d.name}: ${quota(d)}. ${d.note || ""} ${d.intro} 자격증: ${d.cert}. 취업: ${d.job}. 진학: ${d.univ}`), ...cutRowsFor(s).map(cutLine)].join("\n");
      chunks.push({ src: `${s.short} (파노라마 ${s.page}쪽)`, text: t });
    });
    PANO.pages.filter(p => !(p.page >= 7 && p.page <= 12)).forEach(p => {
      const t = p.text; for (let i = 0; i < t.length; i += 1400) chunks.push({ src: `파노라마 ${p.page}쪽 ${p.title}`, text: `[파노라마 ${p.page}쪽: ${p.title}]\n` + t.slice(i, i + 1500), page: p.page });
    });
    chunks.push({ src: "입학전형 일정", always: true, text: "[2027학년도 입학전형 일정]\n" + SCHED.map(r => `${r[0]}: 원서접수 ${r[1]}, 입학전형 ${r[2]}, 합격자발표 ${r[3]}`).join("\n") +
      "\n중학교 석차연명부 작성 기준일 2026-11-17. 평준화지역 일반고(후기고, 예술·IB중점과정 포함) 원서접수 2026-12-07~12-11, 배정예정자 발표 2027-01-06, 배정학교 발표 2027-01-15. 외고·국제고·자사고 원서접수 2026-12-04~12-11. 특수지 일반고 특별전형 원서 12-07, 일반전형 원서 12-10, 발표 12-14. 전·후기고 추가모집 2027-01-11~01-13. 마이스터고·특성화고는 전기고이며 전기고는 1개 학교만 지원할 수 있다. 먼저 시행한 고입전형에 합격한 자는 그 이후의 고입전형에 응시할 수 없으며, 전·후기 학교 모집에 합격한 사실이 없는 자에 한해 추가모집 1개 학교에 지원할 수 있다." });
    chunks.push({ src: "출결·성적 산출", always: true, text: "[고입 성적 산출 300점] 교과 240(1·2학년 80, 3학년 120, 기본 40), 출석 21, 행동발달 9, 자율·동아리·진로 15, 봉사 15. 출석: 미인정 지각·조퇴·결과 3회=결석1일, 미인정결석 2일마다 1점 감점(1~2일 20점 … 21일 이상 10점). 석차백분율은 숫자가 작을수록 상위권이며 커트라인은 그 해 합격한 가장 낮은 성적(가장 큰 %)이다. '미달'은 지원자 전원 합격." });
    CUT.filter(r => !schoolForCut(r)).forEach(r => chunks.push({ src: "커트라인", text: cutLine(r) }));
    return chunks;
  }
  let CHUNKS = null;
  const grams = s => { const t = s.replace(/\s+/g, ""); const g = new Set(); for (let i = 0; i < t.length - 1; i++) g.add(t.slice(i, i + 2)); return g; };
  function retrieve(q, history) {
    CHUNKS = CHUNKS || buildChunks();
    const qq = (history.slice(-2).map(m => m.text).join(" ") + " " + q);
    const qg = grams(qq);
    const scored = CHUNKS.map(c => {
      let sc = 0; const cg = c.text.replace(/\s+/g, "");
      qg.forEach(g => { if (cg.includes(g)) sc++; });
      PANO.schools.forEach(s => { const nm = s.short.replace(/고$/, ""); if (qq.includes(nm) && c.text.includes(s.short)) sc += 40; });
      return { c, sc: sc / Math.sqrt(1 + c.text.length / 800) };
    }).sort((a, b) => b.sc - a.sc);
    const picked = CHUNKS.filter(c => c.always || c.page === 2 || c.page === 20);
    let size = picked.reduce((n, c) => n + c.text.length, 0);
    for (const { c } of scored) { if (picked.includes(c)) continue; if (size + c.text.length > 26000) break; picked.push(c); size += c.text.length; }
    return picked;
  }
  const SYS = `당신은 인천 지역 중학교 3학년 학생과 학부모를 돕는 고입 진학 상담 도우미입니다.
규칙:
1. 반드시 아래 [자료]에 있는 내용만 근거로 답하세요. 자료에 없는 내용은 추측하지 말고 "자료에서 확인되지 않는다"고 말한 뒤 학교나 교육청에 확인하라고 안내하세요.
2. 전형 일정(전기고/후기고 순서, 합격 시 이후 전형 응시 제한, 추가모집)과 지난 커트라인(석차백분율은 숫자가 작을수록 상위권, 커트라인보다 내 %가 작거나 같으면 가능권)을 함께 고려해 단계별로 설명하세요.
3. 근거가 된 자료(예: 파노라마 2쪽, 인천금융고 커트라인)를 답 끝에 짧게 밝히세요.
4. 커트라인은 비공식 사례 자료이며 해마다 달라지므로 합격을 단정하지 마세요.
5. 이름, 학교명, 연락처 같은 개인정보를 묻거나 요구하지 마세요.
6. 한국어로, 중학생이 이해하기 쉽게, 짧은 문단과 목록으로 답하세요.
7. 마지막 줄에 "※ 참고용 답변이며, 최종 결정과 책임은 본인에게 있습니다."를 붙이세요.
오늘 날짜: ${new Date().toISOString().slice(0, 10)}`;
  function md(t) {
    const lines = esc(t).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").split(/\n/);
    let html = "", inList = false;
    lines.forEach(l => {
      const m = l.match(/^\s*(?:[-*•]|\d+\.)\s+(.*)/);
      if (m) { if (!inList) { html += "<ul>"; inList = true; } html += `<li>${m[1]}</li>`; return; }
      if (inList) { html += "</ul>"; inList = false; }
      if (l.trim()) html += `<p>${l.replace(/^#+\s*/, "")}</p>`;
    });
    return html + (inList ? "</ul>" : "");
  }
  function renderChat() {
    const key = store.get(KEY, ""), model = store.get(MODEL, "gemini-2.5-flash");
    view.innerHTML = `
      <div class="panel"><h2 style="margin-top:0">AI 진학 상담 (Gemini)</h2>
        <p class="sub" style="margin-top:0">파노라마 전체 내용, 지난 커트라인, 전형 일정을 근거로 답해요. 예: "인천금융고 웹툰애니메이션과 실기전형에 떨어지면 인천예일고 미술중점에 지원할 수 있나요?"</p>
        ${inArtifact ? `<div class="notice">이 미리보기 화면에서는 외부 AI 연결이 막혀 있어요. GitHub 주소로 접속하면 AI 상담을 쓸 수 있어요.</div>` : ""}
        <details ${key ? "" : "open"}><summary>${key ? "Gemini 연결됨 · 설정 바꾸기" : "① 내 구글 계정으로 Gemini 연결하기"}</summary>
          <ol style="font-size:.9rem;padding-left:1.2em;margin:8px 0">
            <li><a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener">Google AI Studio</a>에 <b>본인 구글 계정으로 로그인</b>하세요.</li>
            <li>"API 키 만들기(Create API key)"를 눌러 무료 키를 복사하세요.</li>
            <li>아래 칸에 붙여넣고 저장하면 끝이에요.</li></ol>
          <div class="grid2"><div class="field"><label for="gKey">Gemini API 키</label><input id="gKey" type="password" autocomplete="off" placeholder="AIza로 시작하는 키" value="${esc(key)}"></div>
            <div class="field"><label for="gModel">모델</label><input id="gModel" list="gModels" value="${esc(model)}"><datalist id="gModels"><option value="gemini-2.5-flash"><option value="gemini-2.5-pro"><option value="gemini-flash-latest"></datalist></div></div>
          <div class="row" style="margin-top:10px"><button class="btn" id="gSave" type="button">저장</button><button class="btn ghost" id="gForget" type="button">키 지우기</button></div>
          <p class="hint">키는 <b>이 기기 브라우저에만</b> 저장돼요. 질문과 관련 자료는 본인 계정의 Google Gemini로 직접 전송되며, 이 앱 운영자에게는 아무것도 전송되지 않아요. 공용 컴퓨터에서는 사용 후 "키 지우기"를 누르세요.</p>
        </details>
      </div>
      <div class="notice">질문에 <b>이름, 학교명, 반, 연락처 등 개인정보를 쓰지 마세요.</b> AI 답변은 틀릴 수 있으니 중요한 내용은 원문 자료와 선생님께 꼭 확인하세요.</div>
      <div class="chatlog" id="log" aria-live="polite">${chat.map(m => `<div class="msg ${m.role === "user" ? "me" : "bot"}">${m.role === "user" ? esc(m.text) : md(m.text) + (m.src ? `<div class="src">참고: ${esc(m.src)}</div>` : "")}</div>`).join("") || `<div class="msg bot"><p>안녕하세요! 고입 진학에 대해 궁금한 점을 물어보세요.</p><p class="meta">예) 내신 70%인 여학생이 지원할 만한 디자인 학과는?<br>예) 특성화고 특별전형에 떨어지면 일반전형에 다시 지원할 수 있나요?</p></div>`}</div>
      <form class="composer" id="ask"><textarea id="askIn" rows="2" placeholder="질문을 입력하세요" ${key ? "" : "disabled"}></textarea><button class="btn" type="submit" id="askBtn" ${key ? "" : "disabled"}>보내기</button></form>
      ${chat.length ? `<p class="hint"><a href="#" id="clearChat">대화 지우기</a> · 대화 내용은 저장되지 않아 새로고침하면 사라져요.</p>` : `<p class="hint">대화 내용은 저장되지 않아 새로고침하면 사라져요.</p>`}`;
    $("#gSave").addEventListener("click", () => { store.set(KEY, $("#gKey").value.trim()); store.set(MODEL, $("#gModel").value.trim() || "gemini-2.5-flash"); toast("저장했어요"); renderChat(); });
    $("#gForget").addEventListener("click", () => { store.del(KEY); toast("키를 지웠어요"); renderChat(); });
    const cl = $("#clearChat"); if (cl) cl.addEventListener("click", e => { e.preventDefault(); chat = []; renderChat(); });
    $("#ask").addEventListener("submit", e => { e.preventDefault(); ask(); });
    $("#askIn").addEventListener("keydown", e => { if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); ask(); } });
    const log = $("#log"); log.lastElementChild && log.lastElementChild.scrollIntoView({ block: "nearest" });
  }
  async function ask() {
    const q = $("#askIn").value.trim(); if (!q) return;
    const key = store.get(KEY, ""), model = store.get(MODEL, "gemini-2.5-flash");
    if (!key) { toast("먼저 Gemini 키를 저장하세요"); return; }
    const ctx = retrieve(q, chat);
    chat.push({ role: "user", text: q }); renderChat();
    const log = $("#log"); const wait = document.createElement("div"); wait.className = "msg bot"; wait.textContent = "자료를 찾아 답을 쓰는 중…"; log.appendChild(wait); wait.scrollIntoView({ block: "nearest" });
    $("#askBtn").disabled = true;
    const contents = chat.slice(-8).map(m => ({ role: m.role === "user" ? "user" : "model", parts: [{ text: m.text }] }));
    contents[contents.length - 1].parts[0].text = `[자료]\n${ctx.map(c => c.text).join("\n\n")}\n\n[질문]\n${q}`;
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
        method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({ systemInstruction: { parts: [{ text: SYS }] }, contents, generationConfig: { temperature: 0.3 } }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data.error && data.error.message) || ("HTTP " + res.status));
      const text = (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts || []).map(p => p.text || "").join("").trim();
      chat.push({ role: "model", text: text || "답변을 받지 못했어요. 질문을 바꿔서 다시 시도해 주세요.", src: [...new Set(ctx.filter(c => !c.always).slice(0, 6).map(c => c.src))].join(", ") });
    } catch (err) {
      const m = String(err.message || err);
      const hint = /API key|API_KEY|permission|403|400/i.test(m) ? "키가 올바른지 확인해 주세요." : /quota|429/i.test(m) ? "무료 사용량을 넘었어요. 잠시 후 다시 시도하세요." : /fetch|network/i.test(m) ? "인터넷 연결을 확인해 주세요." : "";
      chat.push({ role: "model", text: `연결에 실패했어요. ${hint}\n(${m})`, err: true });
    }
    renderChat();
    const ta = $("#askIn"); ta && ta.focus();
  }

  // ---------- 시작 ----------
  if (location.hash.startsWith("#q=")) { $("#q").value = decodeURIComponent(location.hash.slice(3)); history.replaceState(null, "", "#schools"); }
  route();
})();
