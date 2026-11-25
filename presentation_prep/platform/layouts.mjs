// Slide layouts of the platform lecture. Each takes the slide's JSON and returns the HTML of its content.
export const e=s=>String(s??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
// Inline markup in slide text: `code` and **bold** only.
const md=s=>e(s).replace(/`([^`]+)`/g,'<code>$1</code>').replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>');
const band=t=>t?`<div class="takeaway">${md(t)}</div>`:'';
const lead=t=>t?`<p class="lead">${md(t)}</p>`:'';
const table=s=>`<table class="pl-table"><thead><tr>${s.table[0].map(x=>`<th>${md(x)}</th>`).join('')}</tr></thead><tbody>${s.table.slice(1).map(r=>`<tr>${r.map(x=>`<td>${md(x)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
const cards=s=>`<div class="pl-cards pl-n${s.rows.length}">${s.rows.map(r=>`<article><h3>${md(r[0])}</h3><p>${md(r[1])}</p></article>`).join('')}</div>`;
const flow=s=>`<div class="pl-flow">${s.rows.map((r,i)=>`<article><span>${String(i+1).padStart(2,'0')}</span><h3>${md(r[0])}</h3><p>${md(r[1])}</p></article>`).join('<b aria-hidden="true">→</b>')}</div>`;
const code=s=>`<div class="pl-code"><pre><code>${e(s.code)}</code></pre><aside>${s.rows.map(r=>`<h3>${md(r[0])}</h3><p>${md(r[1])}</p>`).join('')}</aside></div>`;
const figure=s=>`<div class="pl-figwrap"><aside>${(s.rows||[]).map(r=>`<h3>${md(r[0])}</h3><p>${md(r[1])}</p>`).join('')}</aside><div class="pl-figure">${s.html}</div></div>`;
const platform=s=>{const [head,...rows]=s.grid;return `<div class="pl-grid"><div></div>${head.map(h=>`<div class="pl-head">${md(h)}</div>`).join('')}${rows.map(([plane,dbx,yours])=>`<div class="pl-plane">${md(plane)}</div><div class="pl-dbx ${plane.includes('Storage')?'pl-store':''}">${md(dbx)}</div><div class="pl-yours">${md(yours)}</div>`).join('')}</div><p class="pl-cloud">${md(s.cloud)}</p>`;};
export function layout(id,s){
 if(s.kind==='cover')return `<div class="cover-copy"><p class="eyebrow">${e(s.eyebrow)}</p><h1>${md(s.title)}</h1><p class="cover-sub">${md(s.subtitle)}</p><p class="cover-date">${e(s.date)}</p><p>LLMOps with Databricks</p></div>`;
 if(s.kind==='divider')return `<div class="section-heading pl-divider"><div>${s.part?`<span class="section-number">${e(s.part)}</span>`:''}<h1>${e(s.title)}</h1>${s.subtitle?`<p>${e(s.subtitle)}</p>`:''}</div></div>`;
 if(id==='agenda')return `<div class="agenda-list">${s.rows.map(r=>`<article><span>${r[0]}</span><div><h3>${e(r[1])}</h3><p>${e(r[2])}</p></div></article>`).join('')}</div>`;
 const body={table,cards,flow,code,platform,figure}[id];
 if(!body)throw new Error(`unknown layout ${id} on "${s.title}"`);
 return lead(s.lead)+body(s)+band(s.bottom);
}
