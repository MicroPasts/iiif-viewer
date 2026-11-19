const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["./scene-viewer-C7kUAPzC.js","./three-Bu8GMMZS.js","./openseadragon-Cnqn1pB0.js"])))=>i.map(i=>d[i]);
import{r as q,g as P}from"./openseadragon-Cnqn1pB0.js";(function(){const t=document.createElement("link").relList;if(t&&t.supports&&t.supports("modulepreload"))return;for(const r of document.querySelectorAll('link[rel="modulepreload"]'))s(r);new MutationObserver(r=>{for(const n of r)if(n.type==="childList")for(const i of n.addedNodes)i.tagName==="LINK"&&i.rel==="modulepreload"&&s(i)}).observe(document,{childList:!0,subtree:!0});function e(r){const n={};return r.integrity&&(n.integrity=r.integrity),r.referrerPolicy&&(n.referrerPolicy=r.referrerPolicy),r.crossOrigin==="use-credentials"?n.credentials="include":r.crossOrigin==="anonymous"?n.credentials="omit":n.credentials="same-origin",n}function s(r){if(r.ep)return;r.ep=!0;const n=e(r);fetch(r.href,n)}})();const C="modulepreload",R=function(a,t){return new URL(a,t).href},E={},j=function(t,e,s){let r=Promise.resolve();if(e&&e.length>0){let i=function(o){return Promise.all(o.map(h=>Promise.resolve(h).then(p=>({status:"fulfilled",value:p}),p=>({status:"rejected",reason:p}))))};const c=document.getElementsByTagName("link"),u=document.querySelector("meta[property=csp-nonce]"),l=(u==null?void 0:u.nonce)||(u==null?void 0:u.getAttribute("nonce"));r=i(e.map(o=>{if(o=R(o,s),o in E)return;E[o]=!0;const h=o.endsWith(".css"),p=h?'[rel="stylesheet"]':"";if(!!s)for(let g=c.length-1;g>=0;g--){const v=c[g];if(v.href===o&&(!h||v.rel==="stylesheet"))return}else if(document.querySelector(`link[href="${o}"]${p}`))return;const f=document.createElement("link");if(f.rel=h?"stylesheet":C,h||(f.as="script"),f.crossOrigin="",f.href=o,l&&f.setAttribute("nonce",l),document.head.appendChild(f),h)return new Promise((g,v)=>{f.addEventListener("load",g),f.addEventListener("error",()=>v(new Error(`Unable to preload CSS for ${o}`)))})}))}function n(i){const c=new Event("vite:preloadError",{cancelable:!0});if(c.payload=i,window.dispatchEvent(c),!c.defaultPrevented)throw i}return r.then(i=>{for(const c of i||[])c.status==="rejected"&&n(c.reason);return t().catch(n)})};var B=q();const V=P(B);function b(a,t="en"){if(!a)return"";if(typeof a=="string")return a;if(typeof a=="number")return String(a);if(Array.isArray(a)){const e=a.find(s=>s&&typeof s=="object"&&s["@language"]===t);return e?b(e["@value"],t):a.map(s=>b(s,t)).filter(Boolean).join("; ")}if(typeof a=="object"){if(a["@value"])return String(a["@value"]);const e=Object.keys(a);if(e.length===0)return"";const s=e.includes(t)?t:e.includes("none")?"none":e[0],r=a[s];return Array.isArray(r)?r.join("; "):String(r)}return String(a)}function O(a){const e=(Array.isArray(a.thumbnail)?a.thumbnail:a.thumbnail?[a.thumbnail]:[])[0];return e?typeof e=="string"?e:e.id||e["@id"]||null:null}function N(a,t){let e=null,s=null,r=a.width||null,n=a.height||null;if(t){const u=a.items||[];for(const l of u){const o=(l.items||[]).find(h=>h.motivation==="painting"||Array.isArray(h.motivation)&&h.motivation.includes("painting"));if(o&&o.body){const h=Array.isArray(o.body)?o.body[0]:o.body,p=h.type==="SpecificResource"&&h.source?h.source:h;s=p.id||null,r=r||p.width||null,n=n||p.height||null;const f=(Array.isArray(p.service)?p.service:p.service?[p.service]:[]).find(g=>String(g.type||g["@type"]||"").includes("ImageService")||String(g.profile||"").includes("iiif.io/api/image"));f&&(e=(f.id||f["@id"]||"").replace(/\/$/,""));break}}}else{const l=(a.images||[])[0];if(l&&l.resource){const o=l.resource;s=o["@id"]||o.id||null,r=r||o.width||null,n=n||o.height||null;const p=(Array.isArray(o.service)?o.service:o.service?[o.service]:[])[0];p&&(e=(p["@id"]||p.id||"").replace(/\/$/,""))}}const c=O(a)||(e?`${e}/full/!200,200/0/default.jpg`:s);return{serviceUrl:e,infoJsonUrl:e?`${e}/info.json`:null,staticUrl:s,thumbnail:c,width:r,height:n}}function _(a){let t=null,e="model/gltf-binary",s=[];for(const r of a.items||[]){const n=r.items||[];for(const i of n){if(!(i.motivation==="painting"||Array.isArray(i.motivation)&&i.motivation.includes("painting"))||!i.body)continue;const u=Array.isArray(i.body)?i.body:[i.body];for(const l of u)if(l.type==="SpecificResource"&&l.source){const o=Array.isArray(l.source)?l.source[0]:l.source;if((o==null?void 0:o.type)==="Model"||/\.(glb|gltf)(\?|$)/i.test((o==null?void 0:o.id)||"")){t=o.id||null,e=o.format||e,s=Array.isArray(l.transform)?l.transform:[];break}}else if(l.type==="Model"||/\.(glb|gltf)(\?|$)/i.test(l.id||"")){t=l.id||null,e=l.format||e,s=Array.isArray(l.transform)?l.transform:[];break}if(t)break}if(t)break}return{modelUrl:t,format:e,transforms:s,thumbnail:O(a)}}function T(a,t){const e=[];return t?[...a.annotations||[]].forEach(r=>{(r.items||[]).forEach(n=>{var u;const c=(Array.isArray(n.body)?n.body:n.body?[n.body]:[]).map(l=>typeof l=="string"?l:b(l.value||l.label||"")).filter(Boolean).join(" ");if(c){const l=typeof n.target=="string"?n.target:((u=n.target)==null?void 0:u.id)||"",o=l.match(/#xywh=([0-9,.-]+)/);e.push({id:n.id||"",motivation:Array.isArray(n.motivation)?n.motivation.join(", "):n.motivation||"commenting",text:c,target:l,xywh:o?o[1].split(",").map(Number):null})}})}):(a.otherContent||[]).forEach(s=>{(s.resources||[]).forEach(r=>{var i;const n=((i=r.resource)==null?void 0:i.chars)||"";n&&e.push({id:r["@id"]||"",motivation:r.motivation||"sc:painting",text:n,target:r.on||"",xywh:null})})}),e}function D(a){var A,L,$;if(!a||typeof a!="object")throw new Error("Invalid IIIF Manifest JSON.");const t=JSON.stringify(a["@context"]||""),e=t.includes("/presentation/4/"),s=e||t.includes("/presentation/3/")||a.type==="Manifest"||Array.isArray(a.items),r=a.id||a["@id"]||"",n=b(a.label)||"Untitled IIIF Manifest",i=b(a.summary||a.description||""),c=b(((A=a.requiredStatement)==null?void 0:A.value)||a.attribution||""),u=typeof a.rights=="string"?a.rights:typeof a.license=="string"?a.license:b(a.license||""),l=(a.metadata||[]).map(d=>({label:b(d.label),value:b(d.value)})),o=(Array.isArray(a.seeAlso)?a.seeAlso:a.seeAlso?[a.seeAlso]:[]).map(d=>({id:d.id||d["@id"]||"",label:b(d.label)||d.format||"Related Resource",format:d.format||""})).filter(d=>d.id),h=(Array.isArray(a.homepage)?a.homepage:a.homepage?[a.homepage]:[]).map(d=>({id:d.id||d["@id"]||"",label:b(d.label)||"Record Homepage"})).filter(d=>d.id),w=(s?a.items||[]:(($=(L=a.sequences)==null?void 0:L[0])==null?void 0:$.canvases)||[]).map((d,y)=>{const k=d.id||d["@id"]||`canvas-${y}`;if(d.type==="Scene"){const x=_(d);return{index:y,kind:"scene",id:k,label:b(d.label)||`3D Scene ${y+1}`,image:{serviceUrl:null,infoJsonUrl:null,staticUrl:null,thumbnail:x.thumbnail,width:null,height:null},scene:x,annotations:T(d,s),metadata:(d.metadata||[]).map(U=>({label:b(U.label),value:b(U.value)}))}}const S=N(d,s);return{index:y,kind:"canvas",id:k,label:b(d.label)||`Canvas ${y+1}`,image:S,scene:null,annotations:T(d,s),metadata:(d.metadata||[]).map(x=>({label:b(x.label),value:b(x.value)}))}}),f=new Map(w.map(d=>[d.id.split("#")[0],d.index])),g=(a.structures||[]).filter(d=>!(d.behavior||[]).includes("top")).map(d=>{var S;const k=((S=(s?(d.items||[]).map(x=>typeof x=="string"?x:x.id||""):d.canvases||[])[0])==null?void 0:S.split("#")[0])||"",M=f.has(k)?f.get(k):null;return{id:d.id||d["@id"]||"",label:b(d.label)||"Section",canvasIndex:M}}).filter(d=>d.canvasIndex!==null),v=w.some(d=>d.kind==="scene");return{version:e||v?"4.0":s?"3.0":"2.1",id:r,label:n,summary:i,attribution:c,rights:u,metadata:l,seeAlso:o,homepage:h,canvases:w,structures:g}}function m(a){return String(a??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}function I(a){if(!a)return"";const t=document.createElement("template");t.innerHTML=String(a);const e=new Set(["A","B","STRONG","I","EM","U","P","BR","SPAN","UL","OL","LI","SUB","SUP"]),s=r=>{const n=Array.from(r.childNodes);for(const i of n)if(i.nodeType===Node.ELEMENT_NODE){if(!e.has(i.tagName)){s(i),i.replaceWith(...i.childNodes);continue}for(const c of Array.from(i.attributes))if(i.tagName==="A"&&c.name.toLowerCase()==="href"){const u=c.value.trim();/^(https?:|mailto:|\/|#)/i.test(u)||i.removeAttribute(c.name)}else i.removeAttribute(c.name);i.tagName==="A"&&i.hasAttribute("href")&&(i.setAttribute("target","_blank"),i.setAttribute("rel","noopener noreferrer"),i.className="text-cyan-700 dark:text-cyan-400 hover:underline"),s(i)}};return s(t.content),t.innerHTML}function z({showUrlInput:a,currentUrl:t,height:e}){const s=a?`
      <form data-el="url-form" class="flex items-center gap-1.5 flex-1 max-w-md mx-2">
        <input
          type="url"
          data-el="url-input"
          value="${m(t)}"
          placeholder="https://media.getty.edu/iiif/manifest/3/..."
          class="w-full px-2.5 py-1 text-xs rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-hidden focus:ring-1 focus:ring-purple-500"
        />
        <button type="submit" class="px-2.5 py-1 text-xs font-medium rounded bg-purple-600 hover:bg-purple-500 text-white transition shrink-0">
          Load
        </button>
      </form>
    `:"";return`
    <div data-el="viewer-root" style="height: ${m(e)}; min-height: 540px;" class="w-full rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 shadow-lg flex flex-col overflow-hidden text-slate-800 dark:text-slate-200">
      <!-- Top Bar -->
      <div class="shrink-0 flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/90">
        <div class="flex items-center gap-2 min-w-0">
          <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-xs font-semibold bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/30 shrink-0">
            IIIF Viewer
          </span>
          <span data-el="version-badge" class="hidden px-1.5 py-0.5 rounded text-[10px] font-mono bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 shrink-0"></span>
          <span data-el="manifest-title" class="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[220px] hidden md:inline"></span>
        </div>

        ${s}

        <div class="flex items-center gap-1.5">
          <!-- Zoom Controls (2D Canvas) -->
          <div data-el="zoom-controls" class="inline-flex rounded-md bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 divide-x divide-slate-200 dark:divide-slate-700">
            <button type="button" data-action="zoom-in" title="Zoom In" class="px-2 py-1 text-xs hover:bg-slate-100 dark:hover:bg-slate-800 transition">+</button>
            <button type="button" data-action="zoom-out" title="Zoom Out" class="px-2 py-1 text-xs hover:bg-slate-100 dark:hover:bg-slate-800 transition">&minus;</button>
            <button type="button" data-action="zoom-home" title="Reset View" class="px-2 py-1 text-xs hover:bg-slate-100 dark:hover:bg-slate-800 transition">Reset</button>
            <button type="button" data-action="rotate" title="Rotate 90°" class="px-2 py-1 text-xs hover:bg-slate-100 dark:hover:bg-slate-800 transition">&#8635;</button>
          </div>

          <button type="button" data-action="toggle-sidebar" title="Toggle Info Panel" aria-expanded="false" class="px-2.5 py-1 text-xs font-medium rounded bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-300 dark:border-slate-700 transition">
            Info
          </button>

          <button type="button" data-action="toggle-fullscreen" title="Toggle Fullscreen" aria-label="Toggle Fullscreen" class="p-1.5 rounded text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-300 dark:border-slate-700 transition">
            <svg data-icon="enter-fullscreen" class="w-4 h-4 block" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
            </svg>
            <svg data-icon="exit-fullscreen" class="w-4 h-4 hidden" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 9V4H4m0 0l5 5M15 9V4h5m0 0l-5 5M9 15v5H4m0 0l5-5m6 0v5h5m0 0l-5-5" />
            </svg>
          </button>

          <button type="button" data-action="toggle-theme" title="Toggle Light/Dark Mode" class="p-1.5 rounded text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-300 dark:border-slate-700 transition">
            <svg class="w-4 h-4 hidden dark:block text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
            <svg class="w-4 h-4 block dark:hidden text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
            </svg>
          </button>
        </div>
      </div>

      <!-- Main Workspace -->
      <div class="relative flex-1 min-h-0 flex overflow-hidden">
        <!-- Deep Zoom 2D & 3D Viewport -->
        <div class="relative flex-1 min-w-0 bg-slate-100 dark:bg-slate-950 flex flex-col">
          <div data-el="osd-container" class="w-full h-full"></div>
          <div data-el="scene-container" class="hidden w-full h-full overflow-hidden"></div>

          <!-- Loading Overlay -->
          <div data-el="loading-box" class="hidden absolute inset-0 z-20 flex items-center justify-center bg-white/85 dark:bg-slate-950/85 backdrop-blur-xs text-sm font-medium text-slate-600 dark:text-slate-300">
            Loading IIIF Manifest...
          </div>

          <!-- Error Box -->
          <div data-el="error-box" class="hidden absolute top-4 left-4 right-4 z-20 p-3 rounded-lg bg-red-50 dark:bg-red-950/80 border border-red-300 dark:border-red-800 text-xs text-red-700 dark:text-red-200"></div>

          <!-- Empty State -->
          <div data-el="empty-state" class="absolute inset-0 flex flex-col items-center justify-center text-center p-6 text-sm text-slate-500 dark:text-slate-400">
            <p class="font-medium">No IIIF Manifest loaded</p>
            <p class="text-xs mt-1">Enter a IIIF Presentation 2.0, 3.0, or 4.0 manifest URL above or call <code class="px-1 py-0.5 rounded bg-slate-200 dark:bg-slate-800">loadManifest()</code>.</p>
          </div>

          <!-- Prev / Next Canvas Floating Controls -->
          <div data-el="pager-controls" class="hidden absolute bottom-3 left-1/2 -translate-x-1/2 z-10 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/90 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-700 shadow-md backdrop-blur-xs text-xs">
            <button type="button" data-action="prev-canvas" class="font-semibold hover:text-purple-600 dark:hover:text-purple-400 px-1">&larr; Prev</button>
            <span data-el="canvas-counter" class="font-mono text-[11px] text-slate-500 dark:text-slate-400">1 / 1</span>
            <button type="button" data-action="next-canvas" class="font-semibold hover:text-purple-600 dark:hover:text-purple-400 px-1">Next &rarr;</button>
          </div>
        </div>

        <!-- Right Metadata / Index / Annotations Sidebar (Overlay drawer on < md, docked on md+) -->
        <aside data-el="sidebar" class="absolute inset-y-0 right-0 z-30 w-80 max-w-[85vw] md:static md:z-auto md:max-w-none shrink-0 border-l border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/95 shadow-2xl md:shadow-none flex flex-col overflow-hidden">
          <div class="shrink-0 flex items-center border-b border-slate-200 dark:border-slate-800 text-xs font-medium">
            <button type="button" data-tab="metadata" class="flex-1 py-2.5 text-center border-b-2 transition">Metadata</button>
            <button type="button" data-tab="structures" class="flex-1 py-2.5 text-center border-b-2 transition">Index</button>
            <button type="button" data-tab="annotations" class="flex-1 py-2.5 text-center border-b-2 transition">Notes</button>
            <button type="button" data-action="toggle-sidebar" title="Close Info Panel" aria-label="Close Info Panel" class="md:hidden px-3 py-2.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition">&times;</button>
          </div>
          <div data-el="sidebar-content" class="iiif-scroll flex-1 overflow-y-auto p-4 text-xs space-y-4"></div>
        </aside>
      </div>

      <!-- Bottom Thumbnail Strip (shown for multi-canvas / 2D+3D manifests) -->
      <div data-el="filmstrip" class="hidden iiif-scroll shrink-0 h-24 px-3 py-2 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex items-center gap-2.5 overflow-x-auto"></div>
    </div>
  `}function H(a,t){const e=a.metadata.map(n=>`
      <div class="border-b border-slate-100 dark:border-slate-800/80 pb-2">
        <dt class="text-[10px] font-semibold uppercase tracking-wider text-slate-400">${m(n.label)}</dt>
        <dd class="text-slate-800 dark:text-slate-200 mt-0.5 break-words whitespace-pre-line [&_p]:mb-1.5 [&_p:last-child]:mb-0 [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4">${I(n.value)}</dd>
      </div>`).join(""),s=[...a.homepage||[],...a.seeAlso||[]],r=s.length?`<div class="space-y-1.5">
        <span class="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">Related Endpoints</span>
        <div class="flex flex-col gap-1">
          ${s.map(n=>`
              <a href="${m(n.id)}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center justify-between gap-2 px-2.5 py-1.5 rounded bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-cyan-700 dark:text-cyan-400 hover:border-cyan-500/50 transition">
                <span class="truncate font-medium">${m(n.label)}</span>
                <span class="text-[10px] font-mono text-slate-400 shrink-0">&nearr;</span>
              </a>`).join("")}
        </div>
      </div>`:"";return`
    <div class="space-y-3">
      <div>
        <h4 class="text-sm font-bold text-slate-900 dark:text-white">${m(a.label)}</h4>
        ${a.summary?`<div class="text-slate-600 dark:text-slate-400 mt-1 leading-relaxed [&_p]:mb-1.5 [&_p:last-child]:mb-0">${I(a.summary)}</div>`:""}
      </div>

      ${t?`<div class="p-2.5 rounded-lg bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800/50">
              <div class="flex items-center justify-between gap-2">
                <span class="text-[10px] font-semibold uppercase tracking-wider text-purple-700 dark:text-purple-400">
                  ${t.kind==="scene"?"Current 3D Scene":"Current Canvas"}
                </span>
                ${t.kind==="scene"?'<span class="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-amber-500/20 text-amber-700 dark:text-amber-300">GLB / 3D</span>':""}
              </div>
              <span class="font-medium text-slate-900 dark:text-slate-100 block mt-0.5">${m(t.label)}</span>
              ${t.image.width&&t.image.height?`<span class="block text-[10px] font-mono text-slate-500 mt-0.5">${t.image.width} &times; ${t.image.height} px</span>`:""}
            </div>`:""}

      ${e?`<dl class="space-y-2.5">${e}</dl>`:""}

      ${r}

      ${a.attribution?`<div class="p-2.5 rounded bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-[11px] text-slate-600 dark:text-slate-400">
              <strong class="block text-slate-700 dark:text-slate-300 mb-0.5">Attribution</strong>
              <div>${I(a.attribution)}</div>
            </div>`:""}

      ${a.rights?`<div>
              <span class="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">Rights / License</span>
              <a href="${m(a.rights)}" target="_blank" rel="noopener noreferrer" class="text-cyan-700 dark:text-cyan-400 hover:underline break-all">${m(a.rights)}</a>
            </div>`:""}
    </div>
  `}function W(a,t){return a.length?`
    <div class="space-y-1">
      ${a.map(e=>{const s=e.canvasIndex===t;return`
            <button
              type="button"
              data-canvas-index="${e.canvasIndex}"
              class="w-full text-left px-2.5 py-2 rounded-md transition flex items-center justify-between gap-2 ${s?"bg-purple-600 text-white font-semibold":"hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"}"
            >
              <span class="truncate">${m(e.label)}</span>
              <span class="text-[10px] font-mono opacity-75 shrink-0">p.${e.canvasIndex+1}</span>
            </button>`}).join("")}
    </div>
  `:'<p class="text-slate-500 dark:text-slate-400 italic">This manifest does not define structural ranges or a table of contents.</p>'}function J(a){const t=(a==null?void 0:a.annotations)||[];return t.length?`
    <div class="space-y-2.5">
      ${t.map(e=>`
          <div class="p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1">
            <div class="flex items-center justify-between gap-2">
              <span class="inline-block px-1.5 py-0.5 rounded text-[10px] font-mono bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20">
                ${m(e.motivation)}
              </span>
              ${e.xywh?`<span class="text-[10px] font-mono text-slate-400">xywh: ${e.xywh.join(",")}</span>`:""}
            </div>
            <div class="text-slate-800 dark:text-slate-200 leading-relaxed [&_p]:mb-1.5 [&_p:last-child]:mb-0">${I(e.text)}</div>
          </div>`).join("")}
    </div>
  `:'<p class="text-slate-500 dark:text-slate-400 italic">No transcriptions or annotations attached to this canvas.</p>'}class K{constructor(t,e={}){if(this.container=typeof t=="string"?document.querySelector(t):t,!this.container)throw new Error("IIIFViewer: Target container element not found.");const s=typeof window<"u"?window.innerWidth>=768:!0;this.options={manifestUrl:e.manifestUrl||e.url||"",manifest:e.manifest||e.data||null,proxyUrl:e.proxyUrl||"",assetProxyUrl:e.assetProxyUrl||"",proxyRoutes:e.proxyRoutes||null,dracoDecoderPath:e.dracoDecoderPath||void 0,theme:e.theme||"dark",showUrlInput:e.showUrlInput??!0,showSidebar:e.showSidebar??s,height:e.height||"680px",initialCanvas:e.initialCanvas||0,fetchOptions:e.fetchOptions||{},onSelectScene:e.onSelectScene||null},this.state={theme:this.options.theme,currentUrl:this.options.manifestUrl,manifest:null,canvasIndex:this.options.initialCanvas,activeTab:"metadata",sidebarOpen:!!this.options.showSidebar,isFullscreen:!1},this.osd=null,this.activeModelViewer=null,this._onFullscreenChange=this.handleFullscreenChange.bind(this),this._onKeyDown=this.handleKeyDown.bind(this),this.mount(),this.options.manifest?this.setManifest(this.options.manifest):this.options.manifestUrl&&this.loadManifest(this.options.manifestUrl)}resolveUrl(t,e="asset"){if(!t||t.startsWith("blob:")||t.startsWith("data:"))return t;const s=this.options.proxyRoutes;if(typeof s=="function"){const r=s(t,e);if(r)return r}else if(Array.isArray(s)){for(const r of s)if(r&&!(r.types&&!r.types.includes(e))){if(typeof r.match=="string"&&t.startsWith(r.match))return`${r.replace}${t.slice(r.match.length)}`;if(r.match instanceof RegExp&&r.match.test(t))return t.replace(r.match,r.replace)}}else if(s&&typeof s=="object"){for(const[r,n]of Object.entries(s))if(t.startsWith(r))return`${n}${t.slice(r.length)}`}return e==="manifest"&&this.options.proxyUrl?`${this.options.proxyUrl}${encodeURIComponent(t)}`:e!=="manifest"&&this.options.assetProxyUrl?`${this.options.assetProxyUrl}${encodeURIComponent(t)}`:t}setProxyRoutes(t){this.options.proxyRoutes=t,this.state.manifest&&(this.renderFilmstrip(),this.goToCanvas(this.state.canvasIndex))}mount(){this.wrapper=document.createElement("div"),this.wrapper.className=this.state.theme==="dark"?"dark":"",this.wrapper.innerHTML=z({showUrlInput:this.options.showUrlInput,currentUrl:this.state.currentUrl,height:this.options.height}),this.container.innerHTML="",this.container.appendChild(this.wrapper),this.syncSidebarUI(),this.initOpenSeadragon(),this.bindEvents(),this.updateTabStyles()}syncSidebarUI(){const t=this.wrapper.querySelector('[data-el="sidebar"]');t==null||t.classList.toggle("hidden",!this.state.sidebarOpen);const e=this.wrapper.querySelector('button[data-action="toggle-sidebar"]');e&&(e.setAttribute("aria-expanded",String(this.state.sidebarOpen)),e.classList.toggle("bg-purple-600",this.state.sidebarOpen),e.classList.toggle("dark:bg-purple-600",this.state.sidebarOpen),e.classList.toggle("text-white",this.state.sidebarOpen),e.classList.toggle("border-purple-600",this.state.sidebarOpen))}initOpenSeadragon(){const t=this.wrapper.querySelector('[data-el="osd-container"]');this.osd=V({element:t,showNavigationControl:!1,crossOriginPolicy:"Anonymous",animationTime:.4,blendTime:.1,maxZoomPixelRatio:2.5,visibilityRatio:.8,constrainDuringPan:!0})}bindEvents(){this.wrapper.addEventListener("click",e=>{var i,c,u,l,o;const s=e.target.closest("[data-action]");if(s){const h=s.dataset.action;if(h==="toggle-theme"&&this.toggleTheme(),h==="toggle-sidebar"&&this.toggleSidebar(),h==="toggle-fullscreen"&&this.toggleFullscreen(),h==="zoom-in"&&((i=this.osd)==null||i.viewport.zoomBy(1.4)),h==="zoom-out"&&((c=this.osd)==null||c.viewport.zoomBy(.7)),h==="zoom-home"&&((u=this.osd)==null||u.viewport.goHome()),h==="rotate"){const p=((l=this.osd)==null?void 0:l.viewport.getRotation())||0;(o=this.osd)==null||o.viewport.setRotation((p+90)%360)}h==="prev-canvas"&&this.goToCanvas(this.state.canvasIndex-1),h==="next-canvas"&&this.goToCanvas(this.state.canvasIndex+1);return}const r=e.target.closest("[data-tab]");if(r){this.state.activeTab=r.dataset.tab,this.updateTabStyles(),this.renderSidebarContent();return}const n=e.target.closest("[data-canvas-index]");n&&this.goToCanvas(parseInt(n.dataset.canvasIndex,10))});const t=this.wrapper.querySelector('[data-el="url-form"]');t&&t.addEventListener("submit",e=>{e.preventDefault();const s=this.wrapper.querySelector('[data-el="url-input"]');s!=null&&s.value.trim()&&this.loadManifest(s.value.trim())}),document.addEventListener("fullscreenchange",this._onFullscreenChange),document.addEventListener("keydown",this._onKeyDown)}async enterFullscreen(){if(!this.state.isFullscreen){if(this.wrapper.requestFullscreen&&document.fullscreenEnabled)try{await this.wrapper.requestFullscreen();return}catch{}this.applyFullscreenStyles(!0)}}async exitFullscreen(){if(this.state.isFullscreen){if(document.fullscreenElement===this.wrapper&&document.exitFullscreen)try{await document.exitFullscreen();return}catch{}this.applyFullscreenStyles(!1)}}toggleFullscreen(){this.state.isFullscreen?this.exitFullscreen():this.enterFullscreen()}handleFullscreenChange(){const t=document.fullscreenElement===this.wrapper;this.applyFullscreenStyles(t)}handleKeyDown(t){t.key==="Escape"&&this.state.isFullscreen&&!document.fullscreenElement&&this.exitFullscreen()}applyFullscreenStyles(t){this.state.isFullscreen=t;const e=this.wrapper.querySelector('[data-el="viewer-root"]'),s=this.wrapper.querySelector('[data-icon="enter-fullscreen"]'),r=this.wrapper.querySelector('[data-icon="exit-fullscreen"]');e&&(t?(this.wrapper.classList.add("fixed","inset-0","z-50"),e.style.height="100vh",e.classList.remove("rounded-xl","border")):(this.wrapper.classList.remove("fixed","inset-0","z-50"),e.style.height=this.options.height,e.classList.add("rounded-xl","border"))),s==null||s.classList.toggle("hidden",t),r==null||r.classList.toggle("hidden",!t),requestAnimationFrame(()=>{var n,i,c,u,l,o;(i=(n=this.osd)==null?void 0:n.viewport)==null||i.resize(),(u=(c=this.osd)==null?void 0:c.viewport)==null||u.applyConstraints(),(o=(l=this.activeModelViewer)==null?void 0:l.handleResize)==null||o.call(l)})}setTheme(t){var e,s;this.state.theme=t==="light"?"light":"dark",this.wrapper.classList.toggle("dark",this.state.theme==="dark"),(s=(e=this.activeModelViewer)==null?void 0:e.setTheme)==null||s.call(e,this.state.theme)}toggleTheme(){this.setTheme(this.state.theme==="dark"?"light":"dark")}toggleSidebar(){this.state.sidebarOpen=!this.state.sidebarOpen,this.syncSidebarUI(),requestAnimationFrame(()=>{var t,e,s,r,n,i;(e=(t=this.osd)==null?void 0:t.viewport)==null||e.resize(),(r=(s=this.osd)==null?void 0:s.viewport)==null||r.applyConstraints(),(i=(n=this.activeModelViewer)==null?void 0:n.handleResize)==null||i.call(n)})}async loadManifest(t){this.state.currentUrl=t;const e=this.wrapper.querySelector('[data-el="url-input"]');e&&(e.value=t),this.setLoading(!0),this.setError(null);try{const s={...this.options.fetchOptions};this.options.fetchOptions.headers&&(s.headers=this.options.fetchOptions.headers);const r=this.resolveUrl(t,"manifest"),n=await fetch(r,s);if(!n.ok)throw new Error(`HTTP ${n.status}: ${n.statusText}`);const i=await n.json();this.setManifest(i)}catch(s){const r=s instanceof TypeError&&/fetch|network/i.test(s.message);this.setError(r?`Network or CORS error fetching manifest from ${t}. Ensure the server allows cross-origin requests or configure proxyUrl / proxyRoutes.`:s.message||"Failed to load IIIF Manifest.")}finally{this.setLoading(!1)}}setManifest(t){var e;try{const s=typeof t=="string"?JSON.parse(t):t,r=D(s);if(!r.canvases.length)throw new Error("Manifest contains no displayable canvases or 3D scenes.");this.state.manifest=r,this.state.canvasIndex=Math.min(this.options.initialCanvas,r.canvases.length-1),this.setError(null),(e=this.wrapper.querySelector('[data-el="empty-state"]'))==null||e.classList.add("hidden");const n=this.wrapper.querySelector('[data-el="version-badge"]');n&&(n.textContent=`v${r.version}`,n.classList.remove("hidden"));const i=this.wrapper.querySelector('[data-el="manifest-title"]');i&&(i.textContent=r.label),this.renderFilmstrip(),this.goToCanvas(this.state.canvasIndex)}catch(s){this.setError(s.message)}}goToCanvas(t){var l;const e=this.state.manifest;if(!e||t<0||t>=e.canvases.length)return;this.state.canvasIndex=t;const s=e.canvases[t],r=this.wrapper.querySelector('[data-el="osd-container"]'),n=this.wrapper.querySelector('[data-el="scene-container"]'),i=this.wrapper.querySelector('[data-el="zoom-controls"]');s.kind==="scene"&&((l=s.scene)!=null&&l.modelUrl)?(r==null||r.classList.add("hidden"),i==null||i.classList.add("hidden"),n==null||n.classList.remove("hidden"),this.mountSceneViewer(n,s)):(this.destroySceneViewer(),n==null||n.classList.add("hidden"),r==null||r.classList.remove("hidden"),i==null||i.classList.remove("hidden"),s.image.infoJsonUrl?this.osd.open(this.resolveUrl(s.image.infoJsonUrl,"image")):s.image.staticUrl&&this.osd.open({type:"image",url:this.resolveUrl(s.image.staticUrl,"image")}));const c=this.wrapper.querySelector('[data-el="pager-controls"]'),u=this.wrapper.querySelector('[data-el="canvas-counter"]');c&&u&&(c.classList.toggle("hidden",e.canvases.length<=1),u.textContent=`${t+1} / ${e.canvases.length}`),this.highlightActiveThumbnail(),this.renderSidebarContent()}async mountSceneViewer(t,e){if(this.destroySceneViewer(),!t)return;const s=this.resolveUrl(e.scene.modelUrl,"model");if(typeof this.options.onSelectScene=="function"){this.activeModelViewer=this.options.onSelectScene(t,{...e.scene,modelUrl:s},{theme:this.state.theme,title:e.label});return}const{BuiltInSceneViewer:r}=await j(async()=>{const{BuiltInSceneViewer:n}=await import("./scene-viewer-C7kUAPzC.js");return{BuiltInSceneViewer:n}},__vite__mapDeps([0,1,2]),import.meta.url);this.state.canvasIndex===e.index&&(this.activeModelViewer=new r(t,e.scene,{theme:this.state.theme,title:e.label,resolvedModelUrl:s,dracoDecoderPath:this.options.dracoDecoderPath}))}destroySceneViewer(){var e,s;(s=(e=this.activeModelViewer)==null?void 0:e.destroy)==null||s.call(e),this.activeModelViewer=null;const t=this.wrapper.querySelector('[data-el="scene-container"]');t&&(t.innerHTML="")}destroy(){var t;document.removeEventListener("fullscreenchange",this._onFullscreenChange),document.removeEventListener("keydown",this._onKeyDown),this.state.isFullscreen&&this.exitFullscreen(),this.destroySceneViewer(),(t=this.osd)==null||t.destroy(),this.container.innerHTML=""}updateTabStyles(){this.wrapper.querySelectorAll("[data-tab]").forEach(t=>{const e=t.dataset.tab===this.state.activeTab;t.className=e?"flex-1 py-2.5 text-center border-b-2 border-purple-600 text-purple-700 dark:text-purple-400 font-semibold transition":"flex-1 py-2.5 text-center border-b-2 border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition"})}renderSidebarContent(){const t=this.wrapper.querySelector('[data-el="sidebar-content"]'),e=this.state.manifest;if(!t||!e)return;const s=e.canvases[this.state.canvasIndex];this.state.activeTab==="metadata"?t.innerHTML=H(e,s):this.state.activeTab==="structures"?t.innerHTML=W(e.structures,this.state.canvasIndex):this.state.activeTab==="annotations"&&(t.innerHTML=J(s))}renderFilmstrip(){var s;const t=this.wrapper.querySelector('[data-el="filmstrip"]'),e=((s=this.state.manifest)==null?void 0:s.canvases)||[];if(t){if(e.length<=1){t.classList.add("hidden");return}t.classList.remove("hidden"),t.innerHTML=e.map(r=>{const n=r.image.thumbnail?this.resolveUrl(r.image.thumbnail,"thumbnail"):null;return`
        <button
          type="button"
          data-canvas-index="${r.index}"
          title="${m(r.label)}"
          class="group relative h-18 w-16 shrink-0 rounded-md overflow-hidden border-2 border-transparent bg-slate-200 dark:bg-slate-800 transition focus:outline-hidden"
        >
          ${n?`<img src="${m(n)}" alt="${m(r.label)}" class="w-full h-full object-cover" loading="lazy" />`:`<span class="text-[10px] text-slate-500 p-1 block truncate">${m(r.label)}</span>`}
          ${r.kind==="scene"?'<span class="absolute top-1 right-1 px-1 rounded bg-amber-500 text-slate-950 text-[8px] font-bold">3D</span>':""}
          <span class="absolute bottom-0 inset-x-0 bg-slate-950/75 text-white text-[9px] font-mono px-1 truncate">
            ${r.index+1}
          </span>
        </button>`}).join("")}}highlightActiveThumbnail(){const t=this.wrapper.querySelector('[data-el="filmstrip"]');t&&t.querySelectorAll("[data-canvas-index]").forEach(e=>{const s=parseInt(e.dataset.canvasIndex,10);e.classList.toggle("border-purple-500",s===this.state.canvasIndex),e.classList.toggle("border-transparent",s!==this.state.canvasIndex)})}setLoading(t){var e;(e=this.wrapper.querySelector('[data-el="loading-box"]'))==null||e.classList.toggle("hidden",!t)}setError(t){const e=this.wrapper.querySelector('[data-el="error-box"]');e&&(e.textContent=t||"",e.classList.toggle("hidden",!t))}}const Z="https://iiif.vam.ac.uk/collections/O24955/manifest.json",G=new K("#iiif-viewer",{manifestUrl:Z,theme:"dark",height:"680px",proxyRoutes:window.location.hostname==="localhost"?{"http://localhost:8000/images":"/images","http://localhost:8000/finds":"/finds"}:null}),F=document.querySelectorAll("[data-preset]");F.forEach(a=>{a.addEventListener("click",()=>{F.forEach(t=>{t.classList.remove("bg-purple-600","hover:bg-purple-500"),t.classList.add("bg-slate-800","hover:bg-slate-700")}),a.classList.remove("bg-slate-800","hover:bg-slate-700"),a.classList.add("bg-purple-600","hover:bg-purple-500"),G.loadManifest(a.dataset.preset)})});export{m as e};
