/**
 * weather-sync.js — مزامنة بيانات الطقس
 *
 * التدفق:
 *   GitHub Actions (كل 30 دقيقة)
 *     → Open-Meteo API (batch requests)
 *     → معالجة + ضغط البيانات
 *     → Firestore (للـ Auth + البيانات التفصيلية)
 *     → GitHub Pages CDN (المصدر الرئيسي للتطبيق — سريع + غير محدود)
 */

'use strict';

const admin  = require('firebase-admin');
const fetch  = require('node-fetch');
const fs     = require('fs');
const path   = require('path');
const { CITIES } = require('./cities');

// ─── تهيئة Firebase Admin ──────────────────────────────────────
const DRY_RUN = process.env.DRY_RUN === 'true';
const LOG = (...args) => console.log(new Date().toISOString(), ...args);

// Firebase اختياري: بدون مفتاح يستمر رفع البيانات إلى GitHub Pages (المصدر الرئيسي للتطبيق)
let db = null;
try {
  let serviceAccount = null;
  if (process.env.FIREBASE_SERVICE_ACCOUNT) serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  else if (fs.existsSync(path.join(__dirname, 'serviceAccountKey.json'))) serviceAccount = require('./serviceAccountKey.json');
  if (serviceAccount) {
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    db = admin.firestore();
  } else {
    LOG('⚠️ FIREBASE_SERVICE_ACCOUNT غير موجود — تخطي Firestore والاكتفاء بـ GitHub Pages');
  }
} catch (e) {
  LOG('⚠️ تعذّر تهيئة Firebase — تخطي Firestore:', e.message);
  db = null;
}

// ─── ثوابت API ────────────────────────────────────────────────
const OPEN_METEO_BASE  = 'https://api.open-meteo.com/v1/forecast';
const TIMEZONE         = 'Africa/Khartoum';
const FORECAST_DAYS    = 14;
const FORECAST_HOURS   = 336;
const BATCH_SIZE       = 10;
const RETRY_LIMIT      = 3;
const RETRY_DELAY_MS   = 2000;
const FETCH_TIMEOUT_MS = 15000;

const CURRENT_PARAMS = [
  'temperature_2m','relative_humidity_2m','apparent_temperature',
  'weather_code','cloud_cover','wind_speed_10m','wind_direction_10m',
  'wind_gusts_10m','surface_pressure','precipitation','visibility',
  'dew_point_2m','is_day'
].join(',');

const HOURLY_PARAMS = [
  'temperature_2m','apparent_temperature','precipitation_probability',
  'precipitation','weather_code','relative_humidity_2m',
  'wind_speed_10m','wind_direction_10m','cloud_cover',
  'uv_index','is_day','visibility','pressure_msl'
].join(',');

const DAILY_PARAMS = [
  'temperature_2m_max','temperature_2m_min','apparent_temperature_max',
  'apparent_temperature_min','precipitation_sum','precipitation_probability_max',
  'weather_code','wind_speed_10m_max','wind_gusts_10m_max',
  'wind_direction_10m_dominant','uv_index_max','sunrise','sunset','daylight_duration'
].join(',');

// ─── مساعدات ──────────────────────────────────────────────────
async function fetchWithRetry(url, attempt = 1) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${url.slice(0, 80)}`);
    return await res.json();
  } catch (e) {
    clearTimeout(timer);
    if (attempt >= RETRY_LIMIT) throw e;
    LOG(`⚠️ Retry ${attempt}/${RETRY_LIMIT}: ${e.message}`);
    await sleep(RETRY_DELAY_MS * attempt);
    return fetchWithRetry(url, attempt + 1);
  }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function buildForecastUrl(city) {
  const params = new URLSearchParams({
    latitude:           city.lat,
    longitude:          city.lon,
    timezone:           TIMEZONE,
    current:            CURRENT_PARAMS,
    hourly:             HOURLY_PARAMS,
    daily:              DAILY_PARAMS,
    wind_speed_unit:    'kmh',
    precipitation_unit: 'mm',
    forecast_days:      FORECAST_DAYS,
    forecast_hours:     FORECAST_HOURS,
    // ecmwf_ifs025 لا يوفر visibility أو uv_index — يُرجعهما null دائمًا.
    // best_match يختار تلقائيًا أفضل نموذج متاح لكل موقع (ICON للسودان غالبًا)
    // ويضمن توفّر كل الحقول المطلوبة، خصوصًا visibility وuv_index.
    models:             'best_match',
  });
  return `${OPEN_METEO_BASE}?${params}`;
}

function compressData(rawData, cityKey) {
  const cur = rawData.current || {};
  const hr  = rawData.hourly  || {};
  const dl  = rawData.daily   || {};

  const current = {
    t:   Math.round(cur.temperature_2m    ?? 0),
    at:  Math.round(cur.apparent_temperature ?? 0),
    rh:  Math.round(cur.relative_humidity_2m ?? 0),
    wc:  cur.weather_code                  ?? 0,
    cc:  Math.round(cur.cloud_cover        ?? 0),
    ws:  Math.round(cur.wind_speed_10m     ?? 0),
    wd:  Math.round(cur.wind_direction_10m ?? 0),
    wg:  Math.round(cur.wind_gusts_10m     ?? 0),
    pr:  Math.round(cur.surface_pressure   ?? 0),
    pp:  Math.round(cur.precipitation      ?? 0),
    vis: Math.round((cur.visibility ?? 0) / 1000),
    dp:  Math.round(cur.dew_point_2m       ?? 0),
    day: cur.is_day                        ?? 1,
  };

  const round  = arr => (arr || []).slice(0, 48).map(v => Math.round(v ?? 0));
  const round1 = arr => (arr || []).slice(0, 48).map(v => v != null ? +v.toFixed(1) : 0);

  const hourly_48 = {
    t:   round(hr.temperature_2m),
    at:  round(hr.apparent_temperature),
    pp:  round(hr.precipitation_probability),
    pr:  round1(hr.precipitation),
    wc:  (hr.weather_code || []).slice(0, 48),
    rh:  round(hr.relative_humidity_2m),
    ws:  round(hr.wind_speed_10m),
    wd:  round(hr.wind_direction_10m),
    cc:  round(hr.cloud_cover),
    uv:  round1(hr.uv_index),
    day: (hr.is_day  || []).slice(0, 48),
    vis: (hr.visibility || []).slice(0, 48).map(v => Math.round((v ?? 0) / 1000)),
    p:   round(hr.pressure_msl),
    time:(hr.time   || []).slice(0, 48),
  };

  const hourly_full = {
    t:   round(hr.temperature_2m),
    pp:  round(hr.precipitation_probability),
    wc:  (hr.weather_code || []),
    ws:  round(hr.wind_speed_10m),
    time:(hr.time || []),
  };

  const daily = {
    max:  (dl.temperature_2m_max || []).map(v => Math.round(v ?? 0)),
    min:  (dl.temperature_2m_min || []).map(v => Math.round(v ?? 0)),
    amax: (dl.apparent_temperature_max || []).map(v => Math.round(v ?? 0)),
    amin: (dl.apparent_temperature_min || []).map(v => Math.round(v ?? 0)),
    psum: (dl.precipitation_sum || []).map(v => v != null ? +v.toFixed(1) : 0),
    pp:   (dl.precipitation_probability_max || []).map(v => Math.round(v ?? 0)),
    wc:   (dl.weather_code || []),
    wmax: (dl.wind_speed_10m_max || []).map(v => Math.round(v ?? 0)),
    wgust:(dl.wind_gusts_10m_max || []).map(v => Math.round(v ?? 0)),
    wdir: (dl.wind_direction_10m_dominant || []).map(v => Math.round(v ?? 0)),
    uv:   (dl.uv_index_max || []).map(v => v != null ? +v.toFixed(1) : 0),
    sr:   dl.sunrise || [],
    ss:   dl.sunset  || [],
    dl:   (dl.daylight_duration || []).map(v => Math.round((v ?? 0) / 3600)),
    time: dl.time   || [],
  };

  return { current, hourly_48, hourly_full, daily };
}

function generateAlerts(allCityData) {
  const alerts = [];
  const now = Date.now();
  for (const [cityKey, data] of Object.entries(allCityData)) {
    if (!data) continue;
    const city = CITIES[cityKey];
    const c = data.current;
    const d = data.daily;
    if (c.t >= 45) alerts.push({ type:'heat', city:cityKey, name:city.name, msg:`موجة حر شديدة في ${city.name}: ${c.t}°م`, severity:3, ts:now });
    else if (c.t >= 42) alerts.push({ type:'heat', city:cityKey, name:city.name, msg:`حرارة مرتفعة في ${city.name}: ${c.t}°م`, severity:2, ts:now });
    if (c.wg >= 70) alerts.push({ type:'wind', city:cityKey, name:city.name, msg:`رياح عاتية في ${city.name}: هبوب ${c.wg} كم/س`, severity:3, ts:now });
    else if (c.ws >= 50) alerts.push({ type:'wind', city:cityKey, name:city.name, msg:`رياح قوية في ${city.name}: ${c.ws} كم/س`, severity:2, ts:now });
    if (d && d.pp && d.pp[0] >= 70) alerts.push({ type:'rain', city:cityKey, name:city.name, msg:`احتمال أمطار غداً في ${city.name}: ${d.pp[0]}%`, severity:2, ts:now });
  }
  alerts.sort((a, b) => b.severity - a.severity);
  return alerts.slice(0, 20);
}


// ─── تنسيق كامل لـ GitHub Pages (نفس صيغة Open-Meteo) ────────────────────
function buildFullFormat(rawData, cityKey) {
  const city = CITIES[cityKey];
  const cur  = rawData.current || {};
  const hr   = rawData.hourly  || {};
  const dl   = rawData.daily   || {};
  const now  = Date.now();
  return {
    city_key: cityKey, name: city.name, region: city.region,
    lat: city.lat, lon: city.lon, updated_ms: now,
    current_weather: {
      temperature:           cur.temperature_2m         ?? 0,
      apparent_temperature:  cur.apparent_temperature   ?? 0,
      weathercode:           cur.weather_code           ?? 0,
      weather_code:          cur.weather_code           ?? 0,
      windspeed:             cur.wind_speed_10m         ?? 0,
      wind_speed_10m:        cur.wind_speed_10m         ?? 0,
      winddirection:         cur.wind_direction_10m     ?? 0,
      wind_direction_10m:    cur.wind_direction_10m     ?? 0,
      windgusts:             cur.wind_gusts_10m         ?? 0,
      surface_pressure:      cur.surface_pressure       ?? 0,
      precipitation:         cur.precipitation          ?? 0,
      visibility:            cur.visibility             ?? 0,
      relative_humidity_2m:  cur.relative_humidity_2m   ?? 0,
      dew_point_2m:          cur.dew_point_2m           ?? 0,
      is_day:                cur.is_day                 ?? 1,
      cloud_cover:           cur.cloud_cover            ?? 0,
    },
    hourly: {
      time:                      hr.time                       || [],
      temperature_2m:            hr.temperature_2m             || [],
      apparent_temperature:      hr.apparent_temperature       || [],
      precipitation_probability: hr.precipitation_probability  || [],
      precipitation:             hr.precipitation              || [],
      weathercode:               hr.weather_code               || [],
      weather_code:              hr.weather_code               || [],
      relative_humidity_2m:      hr.relative_humidity_2m       || [],
      wind_speed_10m:            hr.wind_speed_10m             || [],
      wind_direction_10m:        hr.wind_direction_10m         || [],
      cloud_cover:               hr.cloud_cover                || [],
      uv_index:                  hr.uv_index                   || [],
      is_day:                    hr.is_day                     || [],
      visibility:                hr.visibility                 || [],
      pressure_msl:              hr.pressure_msl               || [],
    },
    daily: {
      time:                         dl.time                           || [],
      temperature_2m_max:           dl.temperature_2m_max            || [],
      temperature_2m_min:           dl.temperature_2m_min            || [],
      apparent_temperature_max:     dl.apparent_temperature_max      || [],
      apparent_temperature_min:     dl.apparent_temperature_min      || [],
      precipitation_sum:            dl.precipitation_sum             || [],
      precipitation_probability_max:dl.precipitation_probability_max || [],
      weathercode:                  dl.weather_code                  || [],
      weather_code:                 dl.weather_code                  || [],
      wind_speed_10m_max:           dl.wind_speed_10m_max            || [],
      wind_gusts_10m_max:           dl.wind_gusts_10m_max            || [],
      wind_direction_10m_dominant:  dl.wind_direction_10m_dominant   || [],
      uv_index_max:                 dl.uv_index_max                  || [],
      sunrise:                      dl.sunrise                       || [],
      sunset:                       dl.sunset                        || [],
      daylight_duration:            dl.daylight_duration             || [],
    },
  };
}

// ─── الجلب الدفعي — Open-Meteo Batch API (طلب واحد) ──────────
async function fetchCitiesBatch(cityKeys) {
  const results = {};
  const valid   = cityKeys.filter(k => CITIES[k]);
  const CHUNK   = 50;

  for (let i = 0; i < valid.length; i += CHUNK) {
    const chunk = valid.slice(i, i + CHUNK);
    const lats  = chunk.map(k => CITIES[k].lat).join(',');
    const lons  = chunk.map(k => CITIES[k].lon).join(',');
    const params = new URLSearchParams({
      latitude: lats, longitude: lons, timezone: TIMEZONE,
      current: CURRENT_PARAMS, hourly: HOURLY_PARAMS, daily: DAILY_PARAMS,
      wind_speed_unit: 'kmh', precipitation_unit: 'mm',
      forecast_days: FORECAST_DAYS, forecast_hours: FORECAST_HOURS,
      models: 'best_match',
    });
    LOG(`📡 طلب واحد لـ ${chunk.length} مدينة...`);
    try {
      const data = await fetchWithRetry(`${OPEN_METEO_BASE}?${params}`);
      const arr  = Array.isArray(data) ? data : [data];
      chunk.forEach((key, idx) => { results[key] = arr[idx] || null; });
    } catch (e) {
      LOG(`❌ فشل: ${e.message}`);
      chunk.forEach(key => { results[key] = null; });
    }
    if (i + CHUNK < valid.length) await sleep(1000);
  }
  return results;
}

// ─── (legacy) لا تُستخدم بعد الآن ────────────────────────────
async function fetchCitiesBatch_OLD(cityKeys) {
  const results = {};
  const batches = [];
  for (let i = 0; i < cityKeys.length; i += BATCH_SIZE) batches.push(cityKeys.slice(i, i + BATCH_SIZE));

  for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
    const batch = batches[batchIdx];
    LOG(`📡 batch ${batchIdx + 1}/${batches.length}: ${batch.join(', ')}`);
    const promises = batch.map(async (key) => {
      const city = CITIES[key];
      if (!city) return [key, null];
      try {
        const data = await fetchWithRetry(buildForecastUrl(city));
        return [key, data];
      } catch (e) {
        LOG(`❌ فشل ${key}: ${e.message}`);
        return [key, null];
      }
    });
    const batchResults = await Promise.all(promises);
    batchResults.forEach(([k, v]) => { results[k] = v; });
    if (batchIdx < batches.length - 1) await sleep(500);
  }
  return results;
}

// ─── الكتابة إلى Firestore ─────────────────────────────────────
async function writeToFirestore(allRaw, allCompressed) {
  if (!db) { LOG('⏭️ Firestore معطّل (لا مفتاح)'); return; }
  const now   = admin.firestore.FieldValue.serverTimestamp();
  const nowMs = Date.now();
  const batch = db.batch();
  const snapshot = { updated_at: now, updated_ms: nowMs, cities: {} };

  for (const [cityKey, compressed] of Object.entries(allCompressed)) {
    const city = CITIES[cityKey];
    snapshot.cities[cityKey] = { ...compressed.current, h48: compressed.hourly_48, name: city.name, region: city.region };
    const forecastRef = db.collection('weather').doc('forecast').collection('cities').doc(cityKey);
    batch.set(forecastRef, {
      updated_at: now, updated_ms: nowMs, city_key: cityKey,
      name: city.name, region: city.region, lat: city.lat, lon: city.lon,
      current: compressed.current, hourly: compressed.hourly_full, daily: compressed.daily,
    }, { merge: false });
  }

  batch.set(db.collection('weather').doc('snapshot'), snapshot, { merge: false });

  const alertsInput = {};
  for (const [k, city] of Object.entries(snapshot.cities)) alertsInput[k] = { current: city, daily: null };
  const alerts = generateAlerts(alertsInput);
  batch.set(db.collection('weather').doc('alerts'), { updated_at: now, updated_ms: nowMs, items: alerts, count: alerts.length }, { merge: false });
  batch.set(db.collection('weather').doc('meta'), { last_sync: now, last_sync_ms: nowMs, cities_count: Object.keys(allCompressed).length, schema_version: 2 }, { merge: true });

  if (DRY_RUN) { LOG('🔵 DRY RUN — Firestore'); return; }
  await batch.commit();
  LOG(`✅ Firestore: ${Object.keys(allCompressed).length} مدينة`);
}

// ─── الكتابة إلى GitHub Pages ──────────────────────────────────
async function writeToGitHubPages(allCompressed, allRaw) {
  const token     = process.env.GH_PAGES_TOKEN;
  const dataRepo  = process.env.GH_PAGES_REPO || 'skfk86/wad-weather-data';
  const branch    = 'main';
  const baseUrl   = `https://api.github.com/repos/${dataRepo}/contents`;
  const nowMs     = Date.now();

  if (!token) { LOG('⚠️ GH_PAGES_TOKEN غير موجود — تخطي GitHub Pages'); return; }

  // ── بناء ملف snapshot.json (كل المدن) ──
  const snapshot = { updated_ms: nowMs, cities: {} };
  for (const [cityKey, compressed] of Object.entries(allCompressed)) {
    const city = CITIES[cityKey];
    snapshot.cities[cityKey] = {
      ...compressed.current,
      h48:    compressed.hourly_48,
      d14:    compressed.daily,
      name:   city.name,
      region: city.region,
    };
  }

  const alertsInput = {};
  for (const [k, s] of Object.entries(snapshot.cities)) alertsInput[k] = { current: s, daily: { pp: s.d14?.pp } };
  const alerts = generateAlerts(alertsInput);

  // ── الملفات المراد رفعها ──
  const files = [
    {
      path: 'weather/snapshot.json',
      content: JSON.stringify(snapshot),
    },
    {
      path: 'weather/alerts.json',
      content: JSON.stringify({ updated_ms: nowMs, items: alerts }),
    },
    {
      path: 'weather/meta.json',
      content: JSON.stringify({ updated_ms: nowMs, cities_count: Object.keys(allCompressed).length }),
    },
  ];

  // ملف لكل مدينة — بالتنسيق الكامل (نفس صيغة Open-Meteo)
  // ملاحظة: كان هذا مقصورًا سابقًا على MAIN_CITIES (18 مدينة فقط، و5 منها بمفاتيح
  // خاطئة أصلاً فلم تُكتب حتى)، فكانت 49 من أصل 67 مدينة تُحرم من ملف GitHub CDN
  // الكامل الخاص بها وتضطر للاعتماد على Cloudflare/Firestore/Open-Meteo دائمًا.
  // بما أن الهدف الآن هو الاعتماد الكامل على GitHub CDN لكل المدن، نكتب الـ 67 كاملة.
  for (const [cityKey, rawData] of Object.entries(allRaw)) {
    if (!rawData) continue;
    files.push({
      path: `weather/cities/${cityKey}.json`,
      content: JSON.stringify(buildFullFormat(rawData, cityKey)),
    });
  }

  if (DRY_RUN) { LOG(`🔵 DRY RUN — GitHub Pages: ${files.length} ملفات`); return; }

  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type':  'application/json',
    'Accept':        'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };

  let written = 0;
  for (const file of files) {
    try {
      // جلب SHA الملف الحالي (مطلوب للتحديث)
      let sha = null;
      try {
        const getRes = await fetch(`${baseUrl}/${file.path}?ref=${branch}`, { headers });
        if (getRes.ok) { const d = await getRes.json(); sha = d.sha; }
      } catch(_){}

      const body = {
        message: `weather: update ${file.path} [skip ci]`,
        content: Buffer.from(file.content).toString('base64'),
        branch,
      };
      if (sha) body.sha = sha;

      const putRes = await fetch(`${baseUrl}/${file.path}`, {
        method: 'PUT', headers, body: JSON.stringify(body),
        signal: AbortSignal.timeout(15000),
      });

      if (putRes.ok) { written++; }
      else { const err = await putRes.text(); LOG(`❌ فشل ${file.path}: ${err.slice(0,100)}`); }
    } catch(e) {
      LOG(`❌ خطأ ${file.path}: ${e.message}`);
    }
  }

  const snapKB = Math.round(Buffer.byteLength(JSON.stringify(snapshot)) / 1024);
  LOG(`✅ GitHub Pages: ${written}/${files.length} ملفات (snapshot: ${snapKB}KB)`);

  // ── تفريغ ذاكرة تخزين jsDelivr المؤقتة ──
  // jsDelivr يخزّن ملفات فرع @main لعدة ساعات افتراضياً. بدون هذه الخطوة
  // سيستمر ملايين المستخدمين في رؤية بيانات قديمة رغم نجاح الرفع أعلاه.
  await purgeJsDelivrCache(files.map(f => f.path));
}

async function purgeJsDelivrCache(paths) {
  const repo = process.env.GH_PAGES_REPO || 'skfk86/wad-weather-data';
  let purged = 0;
  for (const path of paths) {
    try {
      const url = `https://purge.jsdelivr.net/gh/${repo}@main/${path}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (res.ok) purged++;
    } catch (e) {
      LOG(`⚠️ فشل تفريغ jsDelivr لـ ${path}: ${e.message}`);
    }
  }
  LOG(`🧹 jsDelivr purge: ${purged}/${paths.length}`);
}

// ─── نقطة الدخول ──────────────────────────────────────────────
async function main() {
  LOG('🚀 بدء مزامنة بيانات الطقس...');
  const startTime = Date.now();
  const cityKeys  = Object.keys(CITIES);
  LOG(`📋 مدن: ${cityKeys.length}`);

  const allRaw = await fetchCitiesBatch(cityKeys);
  const success = Object.values(allRaw).filter(Boolean).length;
  LOG(`📊 ${success} نجح، ${cityKeys.length - success} فشل`);
  if (success === 0) { LOG('💥 لا بيانات — إيقاف'); process.exit(1); }

  // ضغط البيانات مرة واحدة فقط
  const allCompressed = {};
  for (const [k, raw] of Object.entries(allRaw)) {
    if (raw) allCompressed[k] = compressData(raw, k);
  }

  // الكتابة المتوازية
  await Promise.all([
    writeToFirestore(allRaw, allCompressed),
    writeToGitHubPages(allCompressed, allRaw),
  ]);

  LOG(`⏱️ اكتملت في ${((Date.now() - startTime) / 1000).toFixed(1)}ث`);
  process.exit(0);
}

main().catch(e => { LOG('💥', e.message); console.error(e); process.exit(1); });
