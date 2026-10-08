#!/usr/bin/env node
// Local click-UI for tools/jules/jules.mjs. Zero deps. Binds to 127.0.0.1 only.
// Run: node tools/jules/ui.mjs   (JULES_API_KEY must be set in this shell)
import { execFile } from 'node:child_process';
import { createServer } from 'node:http';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const CLI = join(dirname(fileURLToPath(import.meta.url)), 'jules.mjs');
const PORT = Number(process.env.PORT ?? 4747);
const ALLOWED = new Set(['tasks', 'start', 'status', 'plan', 'approve', 'message', 'activities', 'mark-merged', 'forget']);

const PAGE = `<!doctype html><meta charset=utf-8><title>Jules</title>
<style>
body{font:14px system-ui;margin:20px;max-width:1100px;background:#fafafa;color:#111}
table{border-collapse:collapse;width:100%}td,th{padding:6px 8px;border-bottom:1px solid #ddd;text-align:left}
button{margin:1px;padding:3px 8px;cursor:pointer}.ready{background:#e8f7ec}.merged{color:#888}
pre{background:#111;color:#ddd;padding:10px;max-height:340px;overflow:auto;white-space:pre-wrap}
input{padding:3px;width:320px}small{color:#666}
</style>
<h2>Jules – token-price-analyzer</h2>
<small>Each Start uses one daily Jules task and opens a PR. Plan approval is required.</small>
<p><button id=r>Refresh</button> <label><input type=checkbox id=ap style="width:auto" autocomplete=off> auto-approve plan</label></p>
<table><thead><tr><th>#<th>Task<th>Status<th>Actions</thead><tbody id=t></tbody></table>
<h3>Output</h3><pre id=o>—</pre>
<script>
const o=document.getElementById('o');
const esc=(x)=>String(x).replace(/[&<>"]/g,(c)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
async function run(args){
  o.textContent='… '+args.join(' ');
  try{
    const r=await fetch('/run',{method:'POST',headers:{'X-Jules-UI':'1'},body:JSON.stringify({args})});
    const j=await r.json();o.textContent=j.out||'(no output)';return j.out||'';
  }catch(e){o.textContent='Request failed: '+e;return ''}
}
async function load(){
  const out=await run(['tasks','--json']);
  let rows;try{rows=JSON.parse(out)}catch{return}
  o.textContent='—';
  document.getElementById('t').innerHTML=rows.map((t)=>{
    const st=t.merged?'merged':t.started?(t.state||'started'):t.ready?'ready':'blocked by '+t.deps.join(',');
    const btn=(l,cmd,confirmMsg)=>'<button data-cmd="'+cmd+'" data-id="'+t.id+'"'+(confirmMsg?' data-confirm="'+esc(confirmMsg)+'"':'')+'>'+l+'</button>';
    let a='';
    if(!t.started&&t.ready)a+=btn('Start','start','Start task '+t.id+'? Uses 1 daily Jules task and opens a PR.');
    if(t.started){
      a+=btn('Status','status')+btn('Plan','plan')+btn('Approve','approve','Approve plan for '+t.id+'?')+btn('Message','message')+btn('Log','activities');
      if(t.prUrl)a+=' <a target=_blank href="'+esc(t.prUrl)+'">PR</a>';
      if(t.url)a+=' <a target=_blank href="'+esc(t.url)+'">Jules</a>';
      if(!t.merged)a+=btn('Merged','mark-merged','Mark '+t.id+' as merged?');
      a+=btn('Forget','forget','Forget local state of '+t.id+'?');
    }
    return '<tr class="'+(t.ready?'ready':t.merged?'merged':'')+'"><td>'+t.id+'<td>'+esc(t.title.replace(/^.*? — /,''))+'<td>'+esc(st)+'<td>'+a;
  }).join('');
}
document.getElementById('t').addEventListener('click',async(e)=>{
  const b=e.target.closest('button');if(!b)return;
  const{cmd,id,confirm:c}=b.dataset;
  if(c&&!confirm(c))return;
  const args=[cmd,id];
  if(cmd==='message'){const m=prompt('Message to Jules (task '+id+'):');if(!m)return;args.push(m)}
  if(cmd==='start'&&document.getElementById('ap').checked)args.push('--auto-approve');
  await run(args);
  if(['start','approve','mark-merged','forget'].includes(cmd)){const keep=o.textContent;await load();o.textContent=keep}
});
document.getElementById('r').addEventListener('click',load);
load();
</script>`;

createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }).end(PAGE);
    return;
  }
  if (req.method === 'POST' && req.url === '/run' && req.headers['x-jules-ui'] === '1') {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      let args;
      try { args = JSON.parse(body).args; } catch { args = null; }
      const ok = Array.isArray(args) && args.every((a) => typeof a === 'string') && ALLOWED.has(args[0]);
      if (!ok) { res.writeHead(400).end(JSON.stringify({ out: 'Bad request' })); return; }
      execFile(process.execPath, [CLI, ...args], { timeout: 60000, maxBuffer: 1 << 24 }, (err, stdout, stderr) => {
        res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ out: (stdout + stderr).trim() }));
      });
    });
    return;
  }
  res.writeHead(404).end();
}).listen(PORT, '127.0.0.1', () => {
  console.log(`Jules UI: http://127.0.0.1:${PORT}` + (process.env.JULES_API_KEY ? '' : '  (WARNING: JULES_API_KEY not set)'));
});
