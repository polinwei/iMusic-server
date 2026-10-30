// iMusic-server 前端(純原生 JavaScript,無任何框架)
'use strict';

const $ = (id) => document.getElementById(id);
const player = $('player');
const nowPlaying = $('nowPlaying');
const listEl = $('list');
const statusEl = $('status');

/** 目前清單(已依路徑排序)與正在播放的檔案路徑 */
let tracks = [];
let currentPath = null;

// ---------- 小工具 ----------

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.classList.toggle('error', isError);
}

function formatSize(bytes) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

const streamUrl = (path) => `/api/music/stream?path=${encodeURIComponent(path)}`;
const downloadUrl = (path) => `/api/music/download?path=${encodeURIComponent(path)}`;
const fileUrl = (path) => `/api/music/file?path=${encodeURIComponent(path)}`;

// ---------- 載入並顯示清單 ----------

async function loadList() {
  setStatus('載入中…');
  try {
    const res = await fetch('/api/music');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    tracks = await res.json();
    render();
    setStatus(`共 ${tracks.length} 首`);
  } catch (error) {
    setStatus(`載入失敗:${error.message}`, true);
  }
}

/** 依子資料夾分組後,逐一建立 DOM(使用 textContent,避免檔名造成 XSS) */
function render() {
  listEl.replaceChildren();

  if (tracks.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty';
    empty.textContent = 'Music 目錄中還沒有音樂,請先上傳或把檔案放進 Music 資料夾。';
    listEl.append(empty);
    return;
  }

  const groups = new Map();
  for (const track of tracks) {
    if (!groups.has(track.dir)) groups.set(track.dir, []);
    groups.get(track.dir).push(track);
  }

  for (const [dir, items] of groups) {
    const section = document.createElement('div');
    section.className = 'group';

    const title = document.createElement('h2');
    title.textContent = dir === '' ? '📁 Music(根目錄)' : `📁 ${dir}`;

    const ul = document.createElement('ul');
    for (const track of items) ul.append(createRow(track));

    section.append(title, ul);
    listEl.append(section);
  }
  highlight();
}

function createRow(track) {
  const li = document.createElement('li');
  li.className = 'track';
  li.dataset.path = track.path;

  // 點擊檔名 → 播放
  const nameBtn = document.createElement('button');
  nameBtn.type = 'button';
  nameBtn.className = 'name';
  nameBtn.textContent = track.name;
  nameBtn.title = track.name;
  nameBtn.addEventListener('click', () => playTrack(track));

  const size = document.createElement('span');
  size.className = 'size';
  size.textContent = formatSize(track.size);

  const download = document.createElement('a');
  download.href = downloadUrl(track.path);
  download.textContent = '下載';

  const del = document.createElement('button');
  del.type = 'button';
  del.className = 'del';
  del.textContent = '刪除';
  del.addEventListener('click', () => deleteTrack(track));

  li.append(nameBtn, size, download, del);
  return li;
}

function highlight() {
  for (const li of listEl.querySelectorAll('li.track')) {
    li.classList.toggle('playing', li.dataset.path === currentPath);
  }
}

// ---------- 播放 ----------

function playTrack(track) {
  currentPath = track.path;
  player.src = streamUrl(track.path);
  player.play().catch(() => {
    /* 瀏覽器可能因自動播放政策拒絕,使用者可手動按播放 */
  });
  nowPlaying.textContent = `♪ 目前播放:${track.name}`; // 第一行顯示目前播放名稱
  document.title = `${track.name} - iMusic-server`;
  highlight();
}

// 播完自動播放下一首
player.addEventListener('ended', () => {
  const index = tracks.findIndex((t) => t.path === currentPath);
  const next = tracks[index + 1];
  if (next) playTrack(next);
});

// ---------- 刪除 ----------

async function deleteTrack(track) {
  if (!confirm(`確定要刪除「${track.name}」嗎?此動作無法復原。`)) return;
  try {
    const res = await fetch(fileUrl(track.path), { method: 'DELETE' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    if (currentPath === track.path) {
      player.pause();
      player.removeAttribute('src');
      player.load();
      currentPath = null;
      nowPlaying.textContent = '♪ 目前播放:(尚未選擇)';
    }
    await loadList();
  } catch (error) {
    setStatus(`刪除失敗:${error.message}`, true);
  }
}

// ---------- 上傳 ----------

async function uploadFiles() {
  const files = [...$('uploadInput').files];
  if (files.length === 0) {
    setStatus('請先選擇要上傳的檔案', true);
    return;
  }
  const dir = $('uploadDir').value.trim().replace(/^[/\\]+|[/\\]+$/g, '');

  let done = 0;
  for (const file of files) {
    const path = dir === '' ? file.name : `${dir}/${file.name}`;
    setStatus(`上傳中(${done + 1}/${files.length}):${file.name}`);
    try {
      // 直接把檔案當作請求本體 PUT 給伺服器
      const res = await fetch(fileUrl(path), { method: 'PUT', body: file });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      done += 1;
    } catch (error) {
      setStatus(`「${file.name}」上傳失敗:${error.message}`, true);
      await loadList();
      return;
    }
  }
  $('uploadInput').value = '';
  await loadList();
  setStatus(`已上傳 ${done} 個檔案`);
}

// ---------- 初始化 ----------

$('refreshBtn').addEventListener('click', loadList);
$('uploadBtn').addEventListener('click', uploadFiles);
loadList();
