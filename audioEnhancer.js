// 🎧 Audio Enhancer v2.0 — Auto-EQ + Manual
(function audioEnhancer() {
  if (!Spicetify?.Player || !Spicetify?.Platform || !Spicetify?.PopupModal || !Spicetify?.Topbar) {
    setTimeout(audioEnhancer, 300); return;
  }

  const STORAGE_KEY = "audioEnhancer:settings";
  const DEFAULT = {
    enabled: true, autoMode: true, bassBoost: 0, stereoWidth: 0,
    compressorEnabled: false, compressorThreshold: -24, compressorRatio: 4,
    preamp: 0, eq: [0,0,0,0,0,0,0,0], preset: "flat", perTrack: {}
  };

  const BANDS = [
    {freq:32,type:"lowshelf",label:"32"},{freq:64,type:"peaking",label:"64"},
    {freq:250,type:"peaking",label:"250"},{freq:1000,type:"peaking",label:"1K"},
    {freq:4000,type:"peaking",label:"4K"},{freq:8000,type:"peaking",label:"8K"},
    {freq:12000,type:"peaking",label:"12K"},{freq:16000,type:"highshelf",label:"16K"}
  ];

  const PRESETS = {
    flat:       {name:"🎚️ Flat",       eq:[0,0,0,0,0,0,0,0],       bass:0},
    bass_boost: {name:"🔊 Bass Boost", eq:[6,5,3,0,0,0,0,0],       bass:4},
    treble:     {name:"✨ Treble",     eq:[0,0,0,0,2,4,5,6],       bass:0},
    vocal:      {name:"🎤 Vocal",      eq:[-2,-1,0,4,5,3,0,-1],    bass:0},
    electronic: {name:"⚡ Electronic", eq:[5,4,1,0,-1,2,4,5],      bass:3},
    rock:       {name:"🎸 Rock",       eq:[4,3,1,0,-1,2,4,3],      bass:2},
    jazz:       {name:"🎷 Jazz",       eq:[3,2,0,2,3,3,2,1],       bass:1},
    classical:  {name:"🎻 Classical",  eq:[0,0,0,0,0,2,3,4],       bass:0},
    hifi:       {name:"💎 Hi-Fi",      eq:[3,2,0,1,2,4,5,4],       bass:2},
    night:      {name:"🌙 Night",      eq:[-3,-2,0,2,1,-1,-2,-4],  bass:0},
    loudness:   {name:"📢 Loudness",   eq:[5,4,0,0,-1,0,3,5],      bass:3},
    hiphop:     {name:"🎤 Hip-Hop",    eq:[5,4,1,1,-1,1,2,3],      bass:4},
    pop:        {name:"🎵 Pop",        eq:[1,2,3,3,2,1,0,-1],      bass:1},
    acoustic:   {name:"🪕 Acoustic",   eq:[2,1,0,1,2,3,3,2],       bass:0},
    rnb:        {name:"🎶 R&B",        eq:[4,3,1,2,1,2,2,1],       bass:3},
    mexicana:   {name:"🎺 Mexicana",   eq:[3,2,0,1,2,3,3,2],       bass:2},
    reggaeton:  {name:"🔥 Reggaetón",  eq:[5,4,1,0,2,3,4,4],       bass:4},
    tropical:   {name:"🌴 Tropical",   eq:[3,2,1,2,4,5,4,3],       bass:2},
    metal:      {name:"🤘 Metal",      eq:[5,3,-1,-2,1,3,5,4],     bass:3},
    reggae:     {name:"🇯🇲 Reggae",     eq:[4,5,2,0,1,2,3,2],       bass:4},
    indie:      {name:"🎸 Indie",      eq:[2,1,0,1,2,3,2,1],       bass:1},
    country:    {name:"🤠 Country",    eq:[2,1,0,2,3,4,3,2],       bass:1}
  };

  let S = load();
  let audioCtx=null, sourceNode=null, eqFilters=[], bassFilter=null;
  let compNode=null, preampNode=null, splitter=null, merger=null;
  let gainL=null, gainR=null, connected=false, currentTrackId=null;

  function load(){try{const r=Spicetify.LocalStorage.get(STORAGE_KEY);return r?{...DEFAULT,...JSON.parse(r)}:{...DEFAULT}}catch(e){return{...DEFAULT}}}
  function save(){
    const s={...S};
    // Limit perTrack to last 200 entries
    const keys=Object.keys(s.perTrack||{});
    if(keys.length>200){keys.slice(0,keys.length-200).forEach(k=>delete s.perTrack[k])}
    Spicetify.LocalStorage.set(STORAGE_KEY,JSON.stringify(s));
  }

  function findAudio(){return document.querySelector("audio")||document.querySelector("video")}

  function initChain(){
    if(connected) return;
    const el=findAudio();
    if(!el){setTimeout(initChain,1000);return}
    try{
      audioCtx=new(window.AudioContext||window.webkitAudioContext)();
      sourceNode=audioCtx.createMediaElementSource(el);
      preampNode=audioCtx.createGain();
      preampNode.gain.value=Math.pow(10,S.preamp/20);
      eqFilters=BANDS.map((b,i)=>{
        const f=audioCtx.createBiquadFilter();
        f.type=b.type;f.frequency.value=b.freq;f.gain.value=S.eq[i];
        if(b.type==="peaking")f.Q.value=1.4;return f;
      });
      bassFilter=audioCtx.createBiquadFilter();
      bassFilter.type="lowshelf";bassFilter.frequency.value=100;bassFilter.gain.value=S.bassBoost;
      compNode=audioCtx.createDynamicsCompressor();
      compNode.threshold.value=S.compressorThreshold;compNode.ratio.value=S.compressorRatio;
      compNode.knee.value=10;compNode.attack.value=0.003;compNode.release.value=0.25;
      splitter=audioCtx.createChannelSplitter(2);
      merger=audioCtx.createChannelMerger(2);
      gainL=audioCtx.createGain();gainR=audioCtx.createGain();
      updateStereo();wire();connected=true;
      console.log("[AE] ✅ Audio chain ready");
    }catch(e){console.error("[AE] Init error:",e)}
  }

  function wire(){
    try{sourceNode.disconnect()}catch(e){}
    if(!S.enabled){sourceNode.connect(audioCtx.destination);return}
    let n=sourceNode;
    n.connect(preampNode);n=preampNode;
    for(const f of eqFilters){n.connect(f);n=f}
    n.connect(bassFilter);n=bassFilter;
    if(S.compressorEnabled){n.connect(compNode);n=compNode}
    if(S.stereoWidth!==0){
      n.connect(splitter);
      splitter.connect(gainL,0);splitter.connect(gainR,1);
      gainL.connect(merger,0,0);gainR.connect(merger,0,1);
      merger.connect(audioCtx.destination);
    }else{n.connect(audioCtx.destination)}
  }

  function updateStereo(){
    const w=S.stereoWidth/100;
    if(gainL)gainL.gain.value=1+w*0.5;
    if(gainR)gainR.gain.value=1+w*0.5;
  }
  function updateEQ(){eqFilters.forEach((f,i)=>f.gain.value=S.eq[i])}
  function updateBass(){if(bassFilter)bassFilter.gain.value=S.bassBoost}
  function updatePreamp(){if(preampNode)preampNode.gain.value=Math.pow(10,S.preamp/20)}

  function applyPreset(key,silent){
    const p=PRESETS[key];if(!p)return;
    S.preset=key;S.eq=[...p.eq];S.bassBoost=p.bass;
    updateEQ();updateBass();if(connected)wire();save();
    if(!silent)Spicetify.showNotification("🎛️ Preset: "+p.name);
  }

  const ARTIST_OVERRIDES = {
    "latin mafia": "rnb",
    "peso pluma": "mexicana",
    "natanael cano": "mexicana",
    "fuerza regida": "mexicana",
    "junior h": "mexicana",
    "eslabon armado": "mexicana",
    "grupo frontera": "mexicana",
    "carin leon": "mexicana",
    "christian nodal": "mexicana",
    "julion alvarez": "mexicana",
    "luis r conriquez": "mexicana",
    "xavi": "mexicana",
    "chinito pacas": "mexicana",
    "calibre 50": "mexicana",
    "eden munoz": "mexicana",
    "alfredo olivas": "mexicana",
    "bad bunny": "reggaeton",
    "j balvin": "reggaeton",
    "karol g": "reggaeton",
    "feid": "reggaeton",
    "daddy yankee": "reggaeton",
    "rauw alejandro": "reggaeton",
    "romeo santos": "tropical",
    "aventura": "tropical",
    "marc anthony": "tropical",
    "arctic monkeys": "indie",
    "tame impala": "indie",
    "metallica": "metal",
    "slipknot": "metal",
    "morgan wallen": "country",
    "luke combs": "country"
  };

  async function getToken(){
    let token = null;
    try { token = await Spicetify.Platform.AuthorizationAPI.getState().then(s => s.token.accessToken); } catch(e){}
    if (token) return token;
    
    try { token = Spicetify.Platform.Session.accessToken; } catch(e){}
    if (token) return token;

    try { 
      const res = await Spicetify.CosmosAsync.get("sp://oauth/v2/token");
      if (res && res.accessToken) return res.accessToken;
    } catch(e){}

    return null;
  }

  const GENRE_MAP = [
    {keys: ["edm","electro","house","techno","trance","dubstep","drum and bass","dnb",
            "hardstyle","psytrance","synthwave","future bass","bass music","dance",
            "big room","progressive house","deep house","tropical house","uk garage","club"], preset: "electronic"},
    {keys: ["hip hop","hip-hop","hiphop","rap","trap","drill","grime","boom bap",
            "dirty south","crunk","phonk","underground hip hop","gangsta",
            "latin hip hop","urban contemporary","latin"], preset: "hiphop"},
    {keys: ["reggaeton","reggaetón","urbano latino","perreo","dembow",
            "latin urban","trap latino","música urbana","musica urbana",
            "urbano","música latina","musica latina"], preset: "reggaeton"},
    {keys: ["r&b","rnb","soul","neo soul","funk","motown","quiet storm",
            "contemporary r&b","new jack swing","afrobeats","afroswing","afro",
            "r&b/soul"], preset: "rnb"},
    {keys: ["rock","punk","grunge","hard rock","post-punk","emo","screamo","hardcore",
            "classic rock","garage rock","stoner","rock en espanol"], preset: "rock"},
    {keys: ["metal","heavy metal","nu metal","thrash","death metal",
            "metalcore","black metal","doom metal","power metal","symphonic metal"], preset: "metal"},
    {keys: ["pop","synth pop","electropop","k-pop","j-pop","teen pop","dance pop",
            "art pop","chamber pop","latin pop","pop latino","europop",
            "pop rock","power pop","bubblegum","pop rap"], preset: "pop"},
    {keys: ["indie","indie rock","indie pop","alternative","alt rock",
            "alternative rock","shoegaze","dream pop"], preset: "indie"},
    {keys: ["jazz","swing","bebop","bossa nova","smooth jazz","acid jazz",
            "fusion","big band","cool jazz","free jazz","latin jazz"], preset: "jazz"},
    {keys: ["classical","orchestra","symphony","chamber","opera","baroque",
            "romantic","concerto","sonata","choral","minimalism",
            "contemporary classical","neoclassical","piano"], preset: "classical"},
    {keys: ["acoustic","folk","singer-songwriter","unplugged","cantautor"], preset: "acoustic"},
    {keys: ["country","bluegrass","americana","alt-country","country pop",
            "nashville","outlaw country"], preset: "country"},
    {keys: ["regional mexicano","sierreno","ranchera","corrido","corridos tumbados",
            "música mexicana","musica mexicana","banda","norteño","norteno",
            "mariachi","grupero","tejano","sierreño","huapango",
            "banda sinaloense","norteño-banda","corridos"], preset: "mexicana"},
    {keys: ["salsa","bachata","merengue","vallenato","tropical","cumbia",
            "guaracha","bolero","chachacha","mambo","timba"], preset: "tropical"},
    {keys: ["reggae","dancehall","ska","rocksteady","dub","roots reggae",
            "moombahton"], preset: "reggae"},
    {keys: ["podcast","spoken","audiobook","comedy","speech","vocal","a cappella",
            "spoken word"], preset: "vocal"},
    {keys: ["lo-fi","lofi","chillhop","ambient","downtempo","chillout","new age",
            "meditation","sleep","relaxation","spa","study","focus","ethereal"], preset: "night"},
    {keys: ["bass","sub bass","808","baile funk","brazilian bass"], preset: "bass_boost"},
    {keys: ["deathcore","industrial","noise","speedcore","gabber"], preset: "loudness"},
  ];

  async function autoAnalyze(debugMode = false){
    if(!S.autoMode && !debugMode) return;
    let log = [];
    const logDebug = (msg) => { log.push(msg); console.log("[AE Debug]", msg); };

    try{
      const track=Spicetify.Player.data?.item;
      if(!track) {
        if(debugMode) Spicetify.showNotification("❌ No hay canción reproduciéndose");
        return;
      }
      const trackId=track.uri?.split(":")[2];
      if(!trackId||(trackId===currentTrackId && !debugMode)) return;
      currentTrackId=trackId;

      logDebug("Analizando: " + track.name);

      if(S.perTrack[trackId]){
        applyPreset(S.perTrack[trackId],true);
        Spicetify.showNotification("🎧 "+PRESETS[S.perTrack[trackId]]?.name+" (guardado) → "+(track.name||"").substring(0,20));
        return;
      }

      const token = await getToken();
      logDebug("Token obtenido: " + (token ? "SÍ" : "NO"));

      const artistUri=track.artists?.[0]?.uri;
      const artistId=artistUri?.split(":")[2];
      let genres=[];
      let method="";

      // ── Cache System ──
      const CACHE_KEY = "ae:artistCache";
      let cache = {};
      try { cache = JSON.parse(Spicetify.LocalStorage.get(CACHE_KEY) || "{}"); } catch(e){}

      if(artistId && cache[artistId]){
        genres = cache[artistId];
        method = "cache";
        logDebug("Géneros (Caché): " + genres.join(", "));
      }

      // Strategy 1: fetch artist genres with Bearer token
      if(!genres.length && artistId && token){
        try{
          logDebug("Fetch API a /artists/" + artistId);
          const res=await fetch("https://api.spotify.com/v1/artists/"+artistId,{
            headers:{"Authorization":"Bearer "+token}
          });
          if(res.ok){
            const data=await res.json();
            if(data?.genres?.length){
              genres=data.genres;
              method="api";
              logDebug("Géneros (API principal): " + genres.join(", "));
            } else {
              logDebug("La API respondió (200), pero el artista no tiene géneros.");
            }
          } else {
            logDebug("Error API (Status: " + res.status + ")");
          }
        }catch(e){logDebug("Fetch error: " + e.message)}
      }

      // Strategy 2: iTunes API Fallback (Bypass Spotify 429 Rate Limit)
      if(!genres.length && track.artists?.[0]?.name){
        try{
          const artistName = track.artists[0].name;
          logDebug("Intentando API externa (iTunes) para: " + artistName);
          const res = await fetch("https://itunes.apple.com/search?term=" + encodeURIComponent(artistName) + "&entity=musicArtist&limit=1");
          if(res.ok){
            const data = await res.json();
            if(data.results && data.results[0] && data.results[0].primaryGenreName){
              const itunesGenre = data.results[0].primaryGenreName.toLowerCase();
              genres = [itunesGenre];
              method = "itunes";
              logDebug("Género (iTunes): " + itunesGenre);
            }
          }
        }catch(e){logDebug("iTunes API error: " + e.message)}
      }

      // Strategy 3: internal metadata
      if(!genres.length){
        const meta=track.metadata||{};
        const possibleGenre=meta.genre||meta.album_genre||meta.artist_genre||"";
        if(possibleGenre){
          genres=[possibleGenre.toLowerCase()];
          method="meta-genre";
          logDebug("Género (Metadata): " + genres[0]);
        }
      }

      if(!genres.length){
        const combined=[
          track.name, track.album?.name,
          ...(track.artists||[]).map(a=>a.name)
        ].filter(Boolean).join(" ").toLowerCase();
        genres=[combined];
        method="keywords";
        logDebug("Género (Keywords): " + genres[0]);
      }

      // Save to cache if found via API
      if(artistId && genres.length && (method==="api" || method==="internal")){
        cache[artistId] = genres;
        // Limit cache size to 500 artists
        const keys = Object.keys(cache);
        if(keys.length > 500){
          const newCache = {};
          keys.slice(-400).forEach(k => newCache[k] = cache[k]);
          cache = newCache;
        }
        Spicetify.LocalStorage.set(CACHE_KEY, JSON.stringify(cache));
      }

      const artistName = track.artists?.[0]?.name || "";
      const preset=matchGenre(genres, artistName);
      logDebug("Preset seleccionado: " + preset);
      applyPreset(preset,true);

      const genreDisplay=method!=="keywords"?genres.slice(0,2).join(", "):"fallback";
      
      if(debugMode) {
        Spicetify.PopupModal.display({
          title: "🛠️ Auto-EQ Debug Log",
          content: `<textarea readonly style="width:100%;height:300px;background:#111;color:#0f0;font-family:monospace;border:none;padding:10px;">${log.join("\n")}</textarea>`,
          isLarge: true
        });
      } else {
        Spicetify.showNotification(
          "🎧 "+PRESETS[preset].name+" ["+genreDisplay+"] → "+(track.name||"").substring(0,20)
        );
      }

    }catch(e){
      logDebug("Error fatal: " + e.message);
      if(debugMode) Spicetify.showNotification("❌ Error: " + e.message);
      applyPreset("hifi",true);
    }
  }

  function matchGenre(genres, artistName = ""){
    const artistLow = artistName.toLowerCase();
    for (const [artist, preset] of Object.entries(ARTIST_OVERRIDES)) {
      if (artistLow.includes(artist)) return preset;
    }

    const text=genres.join(" ").toLowerCase();
    let bestPreset="pop", bestCount=0;
    for(const mapping of GENRE_MAP){
      let count=0;
      for(const key of mapping.keys){
        if(text.includes(key)) count++;
      }
      if(count>bestCount){
        bestCount=count;
        bestPreset=mapping.preset;
      }
    }
    // If no genre matched at all, use pop as safe default
    return bestCount>0 ? bestPreset : "pop";
  }

  function saveTrackPreset(presetKey){
    if(!currentTrackId) return;
    S.perTrack[currentTrackId]=presetKey;
    save();
    Spicetify.showNotification("💾 Preset guardado para esta canción");
  }

  function clearTrackPreset(){
    if(!currentTrackId) return;
    delete S.perTrack[currentTrackId];
    save();
    Spicetify.showNotification("🗑️ Preset de canción eliminado");
  }

  // ── UI ──
  function mkSlider(label,val,min,max,step,fn){
    const pct=((val-min)/(max-min))*100;
    return `<div style="display:flex;align-items:center;gap:8px;margin:3px 0;">
      <span style="min-width:38px;font-size:11px;color:#a0a0a0;text-align:right">${label}</span>
      <input type="range" min="${min}" max="${max}" step="${step}" value="${val}"
        style="flex:1;height:4px;accent-color:#1db954;cursor:pointer"
        oninput="(${fn})(this.value);this.nextElementSibling.textContent=(this.value>0?'+':'')+parseFloat(this.value).toFixed(1)"/>
      <span style="min-width:42px;font-size:11px;color:#b3b3b3">${val>0?"+":""}${parseFloat(val).toFixed(1)}</span>
    </div>`;
  }

  function showUI(){
    window.__AE={
      setEQ(i,v){S.eq[i]=+v;updateEQ();S.preset="custom";save()},
      setBass(v){S.bassBoost=+v;updateBass();save()},
      setStereo(v){S.stereoWidth=+v;updateStereo();if(connected)wire();save()},
      setPreamp(v){S.preamp=+v;updatePreamp();save()},
      setCompT(v){S.compressorThreshold=+v;if(compNode)compNode.threshold.value=+v;save()},
      setCompR(v){S.compressorRatio=+v;if(compNode)compNode.ratio.value=+v;save()},
      toggleComp(){S.compressorEnabled=!S.compressorEnabled;if(connected)wire();save()},
      preset(k){applyPreset(k);Spicetify.PopupModal.hide();setTimeout(showUI,100)},
      toggle(){S.enabled=!S.enabled;if(connected)wire();save();
        Spicetify.showNotification(S.enabled?"🎧 ON":"🔇 OFF");
        Spicetify.PopupModal.hide();setTimeout(showUI,100)},
      toggleAuto(){S.autoMode=!S.autoMode;save();
        if(S.autoMode)autoAnalyze();
        Spicetify.PopupModal.hide();setTimeout(showUI,100)},
      saveTrack(){saveTrackPreset(S.preset);Spicetify.PopupModal.hide();setTimeout(showUI,100)},
      clearTrack(){clearTrackPreset();Spicetify.PopupModal.hide();setTimeout(showUI,100)},
      debugAuto(){Spicetify.PopupModal.hide();setTimeout(() => autoAnalyze(true), 100)}
    };

    const track=Spicetify.Player.data?.item;
    const trackName=track?.name||"Sin canción";
    const artistName=track?.artists?.[0]?.name||"";
    const hasSaved=currentTrackId&&S.perTrack[currentTrackId];

    const presetBtns=Object.entries(PRESETS).map(([k,p])=>{
      const a=S.preset===k;
      return `<button onclick="window.__AE.preset('${k}')"
        style="padding:5px 9px;border-radius:20px;border:1px solid ${a?"#1db954":"#333"};
        background:${a?"#1db954":"#282828"};color:${a?"#000":"#b3b3b3"};
        font-size:11px;cursor:pointer;white-space:nowrap">${p.name}</button>`;
    }).join("");

    const eqSliders=BANDS.map((b,i)=>
      mkSlider(b.label,S.eq[i],-12,12,0.5,`function(v){window.__AE.setEQ(${i},v)}`)
    ).join("");

    const c=document.createElement("div");
    c.innerHTML=`<div style="font-family:-apple-system,sans-serif;color:#e0e0e0;max-height:65vh;overflow-y:auto;padding:4px">

      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <div><span style="font-size:13px;font-weight:600">Estado: </span>
          <span style="color:${S.enabled?"#1db954":"#ff4444"};font-weight:600">${S.enabled?"✅ ACTIVO":"❌ OFF"}</span></div>
        <button onclick="window.__AE.toggle()"
          style="padding:5px 14px;border-radius:20px;border:none;background:${S.enabled?"#ff4444":"#1db954"};color:#fff;cursor:pointer;font-size:12px;font-weight:600">
          ${S.enabled?"Apagar":"Encender"}</button>
      </div>

      <!-- Auto Mode -->
      <div style="margin-bottom:12px;padding:10px;background:${S.autoMode?"#1a2e1a":"#1a1a1a"};border:1px solid ${S.autoMode?"#1db954":"#333"};border-radius:8px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
          <div>
            <span style="font-size:12px;font-weight:600;color:#fff">🤖 Auto-EQ Inteligente</span>
            <button onclick="window.__AE.debugAuto()" style="background:transparent;border:1px solid #555;color:#888;font-size:9px;padding:2px 6px;border-radius:4px;margin-left:6px;cursor:pointer">Debug</button>
          </div>
          <button onclick="window.__AE.toggleAuto()"
            style="padding:4px 14px;border-radius:12px;border:none;font-size:11px;cursor:pointer;font-weight:600;
            background:${S.autoMode?"#1db954":"#333"};color:${S.autoMode?"#000":"#fff"}">
            ${S.autoMode?"ON":"OFF"}</button>
        </div>
        <div style="font-size:11px;color:#888">Detecta el tipo de canción y aplica el mejor ecualizador automáticamente.</div>
        <div style="margin-top:6px;font-size:11px;color:#b3b3b3">
          🎵 <strong>${trackName}</strong> ${artistName?"— "+artistName:""}
          ${S.preset!=="flat"?" · Preset: <span style='color:#1db954'>"+PRESETS[S.preset]?.name+"</span>":""}
        </div>
        <div style="display:flex;gap:6px;margin-top:6px">
          <button onclick="window.__AE.saveTrack()"
            style="padding:4px 10px;border-radius:12px;border:1px solid #333;background:#282828;color:#b3b3b3;font-size:10px;cursor:pointer">
            💾 Guardar para esta canción</button>
          ${hasSaved?`<button onclick="window.__AE.clearTrack()"
            style="padding:4px 10px;border-radius:12px;border:1px solid #ff4444;background:#2a1a1a;color:#ff4444;font-size:10px;cursor:pointer">
            🗑️ Borrar guardado</button>`:""}
        </div>
      </div>

      <!-- Presets -->
      <div style="margin-bottom:12px">
        <div style="font-size:12px;font-weight:600;margin-bottom:6px;color:#fff">🎛️ Presets</div>
        <div style="display:flex;flex-wrap:wrap;gap:5px">${presetBtns}</div>
      </div>

      <!-- Preamp -->
      <div style="margin-bottom:10px;padding:8px;background:#1a1a1a;border-radius:8px">
        <div style="font-size:12px;font-weight:600;margin-bottom:2px;color:#fff">🔈 Preamp</div>
        ${mkSlider("Vol",S.preamp,-12,12,0.5,"function(v){window.__AE.setPreamp(v)}")}
      </div>

      <!-- EQ -->
      <div style="margin-bottom:10px;padding:8px;background:#1a1a1a;border-radius:8px">
        <div style="font-size:12px;font-weight:600;margin-bottom:2px;color:#fff">🎚️ Ecualizador</div>
        ${eqSliders}
      </div>

      <!-- Bass -->
      <div style="margin-bottom:10px;padding:8px;background:#1a1a1a;border-radius:8px">
        <div style="font-size:12px;font-weight:600;margin-bottom:2px;color:#fff">🔊 Bass Boost</div>
        ${mkSlider("Bass",S.bassBoost,0,12,0.5,"function(v){window.__AE.setBass(v)}")}
      </div>

      <!-- Stereo -->
      <div style="margin-bottom:10px;padding:8px;background:#1a1a1a;border-radius:8px">
        <div style="font-size:12px;font-weight:600;margin-bottom:2px;color:#fff">🎧 Stereo Width</div>
        <div style="display:flex;align-items:center;gap:8px;margin:3px 0">
          <span style="min-width:38px;font-size:11px;color:#a0a0a0;text-align:right">Wide</span>
          <input type="range" min="0" max="100" step="5" value="${S.stereoWidth}"
            style="flex:1;height:4px;accent-color:#1db954;cursor:pointer"
            oninput="window.__AE.setStereo(this.value);this.nextElementSibling.textContent=this.value+'%'"/>
          <span style="min-width:42px;font-size:11px;color:#b3b3b3">${S.stereoWidth}%</span>
        </div>
      </div>

      <!-- Compressor -->
      <div style="margin-bottom:10px;padding:8px;background:#1a1a1a;border-radius:8px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
          <span style="font-size:12px;font-weight:600;color:#fff">🗜️ Compresor</span>
          <button onclick="window.__AE.toggleComp();this.textContent=${!S.compressorEnabled}?'ON':'OFF';this.style.background=${!S.compressorEnabled}?'#1db954':'#333'"
            style="padding:3px 12px;border-radius:12px;border:none;font-size:11px;cursor:pointer;
            background:${S.compressorEnabled?"#1db954":"#333"};color:#fff">${S.compressorEnabled?"ON":"OFF"}</button>
        </div>
        ${mkSlider("Thresh",S.compressorThreshold,-50,0,1,"function(v){window.__AE.setCompT(v)}")}
        <div style="display:flex;align-items:center;gap:8px;margin:3px 0">
          <span style="min-width:38px;font-size:11px;color:#a0a0a0;text-align:right">Ratio</span>
          <input type="range" min="1" max="20" step="0.5" value="${S.compressorRatio}"
            style="flex:1;height:4px;accent-color:#1db954;cursor:pointer"
            oninput="window.__AE.setCompR(this.value);this.nextElementSibling.textContent=this.value+':1'"/>
          <span style="min-width:42px;font-size:11px;color:#b3b3b3">${S.compressorRatio}:1</span>
        </div>
      </div>

      <div style="text-align:center;color:#555;font-size:10px;margin-top:6px">Audio Enhancer v2.0 · Auto-EQ</div>
    </div>`;

    Spicetify.PopupModal.display({title:"🎧 Audio Enhancer",content:c,isLarge:true});
  }

  // ── Topbar Button ──
  const icon=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M7 18h2V6H7v12zm4 4h2V2h-2v20zm-8-8h2v-4H3v4zm12 4h2V6h-2v12zm4-8v4h2v-4h-2z"/></svg>`;
  new Spicetify.Topbar.Button("Audio Enhancer",icon,showUI);

  // ── Song change listener ──
  Spicetify.Player.addEventListener("songchange",()=>{
    if(!connected)setTimeout(initChain,500);
    setTimeout(autoAnalyze,800);
  });

  if(Spicetify.Player.isPlaying?.()){setTimeout(initChain,500);setTimeout(autoAnalyze,1000)}

  console.log("[AE] v2.0 loaded — Auto-EQ enabled");
  Spicetify.showNotification("🎧 Audio Enhancer v2.0 cargado");
})();
