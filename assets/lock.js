/* 잠금 화면: 관리자 키로 secure/ 의 암호화 자료를 브라우저 안에서 풀어 앱을 시작합니다.
   키나 풀린 자료는 어디로도 전송되지 않습니다. */
(function () {
  "use strict";
  const view = document.getElementById("view");
  const enc = new TextEncoder();
  const b64 = { to: buf => btoa(String.fromCharCode(...new Uint8Array(buf))), from: s => Uint8Array.from(atob(s), c => c.charCodeAt(0)) };
  const SKEY = "hb.unlock";
  let KEY = null, meta = null;
  const imgCache = new Map();

  function getSaved() { try { return sessionStorage.getItem(SKEY) || localStorage.getItem(SKEY); } catch (e) { return null; } }
  function save(raw, remember) { try { sessionStorage.setItem(SKEY, raw); if (remember) localStorage.setItem(SKEY, raw); } catch (e) {} }
  function forget() { try { sessionStorage.removeItem(SKEY); localStorage.removeItem(SKEY); } catch (e) {} }

  async function derive(pass) {
    const base = await crypto.subtle.importKey("raw", enc.encode(pass), "PBKDF2", false, ["deriveKey"]);
    return crypto.subtle.deriveKey({ name: "PBKDF2", hash: "SHA-256", salt: hexToBytes(meta.salt), iterations: meta.iter }, base, { name: "AES-GCM", length: 256 }, true, ["decrypt"]);
  }
  const hexToBytes = h => new Uint8Array(h.match(/../g).map(x => parseInt(x, 16)));
  async function open(path) {
    const res = await fetch(path, { cache: "no-cache" });
    if (!res.ok) throw new Error("파일을 불러오지 못했어요 (" + res.status + ")");
    const buf = new Uint8Array(await res.arrayBuffer());
    return crypto.subtle.decrypt({ name: "AES-GCM", iv: buf.slice(0, 12) }, KEY, buf.slice(12));
  }

  // 원문 이미지: 필요할 때 풀어서 이 기기 메모리에서만 보여 줌
  window.HB_IMG = function (n, book) {
    const nn = String(n).padStart(2, "0"), path = book === "dv" ? `secure/dv/d-${nn}.enc` : `secure/img/p-${nn}.enc`;
    if (!imgCache.has(path)) imgCache.set(path, open(path).then(b => URL.createObjectURL(new Blob([b], { type: "image/jpeg" }))));
    return imgCache.get(path);
  };
  window.HB_LOCK = function () { forget(); location.reload(); };

  async function start() {
    const data = JSON.parse(new TextDecoder().decode(await open("secure/data.enc")));
    window.CUTOFFS = data.cutoffs; window.PANORAMA = data.panorama;
    document.body.classList.remove("locked");
    const s = document.createElement("script"); s.src = "assets/app.js"; document.body.appendChild(s);
  }

  function showLock(msg) {
    document.body.classList.add("locked");
    view.innerHTML = `
      <div class="panel" style="max-width:440px;margin:24px auto">
        <h2 style="margin-top:0">🔒 관리자 키를 입력하세요</h2>
        <p class="sub" style="margin-top:0">이 앱의 자료는 암호화되어 있어 키가 있어야 볼 수 있어요. 키는 담당 선생님께 받으세요.</p>
        <form id="unlock">
          <div class="field"><label for="pass">관리자 키</label><input id="pass" type="password" autocomplete="current-password" required></div>
          <label class="check" style="margin-top:10px"><input type="checkbox" id="remember"> 이 기기에서 계속 열어 두기 (개인 기기에서만)</label>
          <p id="lockMsg" class="hint" role="alert" style="color:var(--try)">${msg || ""}</p>
          <button class="btn" type="submit" id="unlockBtn" style="width:100%;margin-top:6px">열기</button>
        </form>
        <p class="hint">키는 이 기기 안에서만 확인하며 어디로도 전송되지 않아요. 체크하지 않으면 브라우저 탭을 닫을 때 다시 잠겨요.</p>
      </div>`;
    document.getElementById("pass").focus();
    document.getElementById("unlock").addEventListener("submit", async e => {
      e.preventDefault();
      const btn = document.getElementById("unlockBtn"), m = document.getElementById("lockMsg");
      btn.disabled = true; btn.textContent = "확인하는 중…"; m.textContent = "";
      try {
        KEY = await derive(document.getElementById("pass").value);
        await start();
        save(b64.to(await crypto.subtle.exportKey("raw", KEY)), document.getElementById("remember").checked);
      } catch (err) {
        KEY = null; btn.disabled = false; btn.textContent = "열기";
        m.textContent = err && err.name === "OperationError" ? "키가 맞지 않아요. 다시 확인해 주세요." : (err.message || "열지 못했어요.");
      }
    });
  }

  (async function init() {
    if (!window.crypto || !crypto.subtle) { view.innerHTML = `<div class="empty">이 브라우저에서는 암호화된 자료를 열 수 없어요. 최신 크롬·사파리·엣지에서 https 주소로 열어 주세요.</div>`; return; }
    try { meta = await (await fetch("secure/meta.json", { cache: "no-cache" })).json(); }
    catch (e) { view.innerHTML = `<div class="empty">자료 정보를 불러오지 못했어요. 인터넷 연결을 확인해 주세요.</div>`; return; }
    const saved = getSaved();
    if (saved) {
      try { KEY = await crypto.subtle.importKey("raw", b64.from(saved), { name: "AES-GCM" }, true, ["decrypt"]); await start(); return; }
      catch (e) { forget(); KEY = null; }
    }
    showLock();
  })();
})();
