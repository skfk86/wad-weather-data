'use strict';

/**
 * cities.js — قائمة مدن السودان
 * مستخرجة من index.html v9.5
 * تُستخدم من weather-sync.js
 */

const CITIES = {
  // ── الخرطوم وضواحيها ──
  khartoum:    { name: 'الخرطوم',        lat: 15.5007, lon: 32.5599, elev: 381,  region: 'الخرطوم' },
  bahri:       { name: 'بحري',            lat: 15.6319, lon: 32.5510, elev: 375,  region: 'الخرطوم' },
  omdurman:    { name: 'أم درمان',        lat: 15.6445, lon: 32.4777, elev: 370,  region: 'الخرطوم' },
  jebel:       { name: 'جبل أولياء',      lat: 15.2097, lon: 32.4884, elev: 378,  region: 'الخرطوم' },
  soba:        { name: 'سوبا',            lat: 15.4000, lon: 32.6333, elev: 375,  region: 'الخرطوم' },
  halfaya:     { name: 'حلفاية الملوك',   lat: 15.6833, lon: 32.5667, elev: 371,  region: 'الخرطوم' },

  // ── الجزيرة ──
  wadmadani:   { name: 'ودمدني',          lat: 14.4000, lon: 33.5167, elev: 407,  region: 'الجزيرة' },
  managil:     { name: 'المناقل',         lat: 14.2500, lon: 32.9833, elev: 390,  region: 'الجزيرة' },
  rufa:        { name: 'الرفاعة',         lat: 14.6167, lon: 33.8167, elev: 405,  region: 'الجزيرة' },
  hassa:       { name: 'حسب الله',        lat: 14.0833, lon: 33.1667, elev: 395,  region: 'الجزيرة' },

  // ── النيل الأبيض ──
  rabak:       { name: 'ربك',             lat: 13.1796, lon: 32.7398, elev: 378,  region: 'النيل الأبيض' },
  kosti:       { name: 'كوستي',           lat: 13.1667, lon: 32.6667, elev: 375,  region: 'النيل الأبيض' },
  renk:        { name: 'رنك',             lat: 11.7500, lon: 32.7833, elev: 387,  region: 'النيل الأبيض' },
  ghaddar:     { name: 'الغدار',          lat: 12.5500, lon: 32.4500, elev: 380,  region: 'النيل الأبيض' },

  // ── النيل الأزرق ──
  sennar:      { name: 'سنار',            lat: 13.5500, lon: 33.5667, elev: 420,  region: 'النيل الأزرق' },
  eddamazin:   { name: 'الدمازين',        lat: 11.7876, lon: 34.3616, elev: 467,  region: 'النيل الأزرق' },
  roseires:    { name: 'الروصيرص',        lat: 11.8579, lon: 34.3858, elev: 470,  region: 'النيل الأزرق' },
  suki:        { name: 'السوكي',          lat: 13.3333, lon: 33.9000, elev: 415,  region: 'النيل الأزرق' },

  // ── سنار ──
  sinjah:      { name: 'سنجة',            lat: 13.1500, lon: 33.9167, elev: 422,  region: 'سنار' },
  abuhashim:   { name: 'أبو حجار',        lat: 14.2333, lon: 34.9000, elev: 490,  region: 'سنار' },

  // ── كسلا ──
  kassala:     { name: 'كسلا',            lat: 15.4500, lon: 36.4000, elev: 500,  region: 'كسلا' },
  newhalfa:    { name: 'حلفا الجديدة',    lat: 15.3500, lon: 35.6167, elev: 470,  region: 'كسلا' },
  khashm:      { name: 'خشم القربة',      lat: 15.0500, lon: 35.9000, elev: 485,  region: 'كسلا' },
  tokar:       { name: 'طوكر',            lat: 18.4333, lon: 37.7333, elev: 26,   region: 'كسلا' },
  sinkat:      { name: 'سنكات',           lat: 18.8500, lon: 36.8500, elev: 758,  region: 'كسلا' },
  wad_alheliu: { name: 'ود الحليو',       lat: 15.7000, lon: 36.3000, elev: 512,  region: 'كسلا' },

  // ── القضارف ──
  gedaref:     { name: 'القضارف',         lat: 14.0339, lon: 35.3970, elev: 595,  region: 'القضارف' },
  gallabat:    { name: 'قلابات',          lat: 12.9667, lon: 36.1500, elev: 612,  region: 'القضارف' },
  doka:        { name: 'الدوكة',          lat: 13.5167, lon: 35.8000, elev: 580,  region: 'القضارف' },
  fashaga:     { name: 'الفشقة',          lat: 14.2833, lon: 36.0000, elev: 560,  region: 'القضارف' },

  // ── البحر الأحمر ──
  portsudan:   { name: 'بورتسودان',       lat: 19.6158, lon: 37.2164, elev: 6,    region: 'البحر الأحمر' },
  suakin:      { name: 'سواكن',           lat: 19.1167, lon: 37.3333, elev: 5,    region: 'البحر الأحمر' },
  halaib:      { name: 'حلايب',           lat: 22.2000, lon: 36.6333, elev: 10,   region: 'البحر الأحمر' },
  shalatein:   { name: 'شلاتين',          lat: 23.1333, lon: 35.6500, elev: 15,   region: 'البحر الأحمر' },

  // ── نهر النيل ──
  atbara:      { name: 'عطبرة',           lat: 17.6953, lon: 33.9833, elev: 345,  region: 'نهر النيل' },
  shendi:      { name: 'شندي',            lat: 16.6948, lon: 33.4291, elev: 360,  region: 'نهر النيل' },
  berber:      { name: 'بربر',            lat: 18.0167, lon: 33.9833, elev: 325,  region: 'نهر النيل' },
  hamed:       { name: 'حامد',            lat: 16.9333, lon: 33.7833, elev: 352,  region: 'نهر النيل' },
  damer:       { name: 'الدامر',          lat: 17.5967, lon: 33.9569, elev: 348,  region: 'نهر النيل' },
  elmeteima:   { name: 'المتمة',          lat: 16.5667, lon: 33.3000, elev: 362,  region: 'نهر النيل' },

  // ── الشمالية ──
  dongola:     { name: 'دنقلا',           lat: 19.1726, lon: 30.4800, elev: 227,  region: 'الشمالية' },
  karima:      { name: 'كريمة',           lat: 18.5500, lon: 31.8500, elev: 252,  region: 'الشمالية' },
  merowe:      { name: 'مروي',            lat: 18.4756, lon: 31.8264, elev: 258,  region: 'الشمالية' },
  abriha:      { name: 'أبري',            lat: 20.7833, lon: 30.3500, elev: 215,  region: 'الشمالية' },
  delgo:       { name: 'دلقو',            lat: 20.1333, lon: 30.4167, elev: 218,  region: 'الشمالية' },
  wadi_halfa:  { name: 'وادي حلفا',       lat: 21.7969, lon: 31.3388, elev: 173,  region: 'الشمالية' },
  kulma:       { name: 'قلعة النحل',      lat: 19.4833, lon: 30.8000, elev: 240,  region: 'الشمالية' },

  // ── شمال كردفان ──
  elobeid:     { name: 'الأبيض',          lat: 13.1843, lon: 30.2176, elev: 570,  region: 'شمال كردفان' },
  enahud:      { name: 'النهود',          lat: 12.7000, lon: 28.4333, elev: 573,  region: 'شمال كردفان' },
  bara:        { name: 'بارا',            lat: 13.7167, lon: 30.3667, elev: 558,  region: 'شمال كردفان' },
  umrawaba:    { name: 'أم روابة',        lat: 12.9000, lon: 31.2333, elev: 450,  region: 'شمال كردفان' },

  // ── جنوب كردفان ──
  kadugli:     { name: 'كادقلي',          lat: 11.0129, lon: 29.7183, elev: 530,  region: 'جنوب كردفان' },
  talodi:      { name: 'تلودي',           lat: 10.6167, lon: 30.3833, elev: 640,  region: 'جنوب كردفان' },
  dilling:     { name: 'دلّنج',           lat: 12.0500, lon: 29.6500, elev: 545,  region: 'جنوب كردفان' },
  heiban:      { name: 'هيبان',           lat: 11.3333, lon: 30.1000, elev: 580,  region: 'جنوب كردفان' },

  // ── غرب كردفان ──
  elfulah:     { name: 'الفولة',          lat: 11.7167, lon: 28.3500, elev: 460,  region: 'غرب كردفان' },
  muglad:      { name: 'المُجلد',         lat: 11.0333, lon: 27.7500, elev: 420,  region: 'غرب كردفان' },

  // ── شمال دارفور ──
  elfasher:    { name: 'الفاشر',          lat: 13.6279, lon: 25.3494, elev: 730,  region: 'شمال دارفور' },
  mellit:      { name: 'مليط',            lat: 15.1167, lon: 25.6833, elev: 780,  region: 'شمال دارفور' },
  kutum:       { name: 'كتم',             lat: 14.2000, lon: 24.6667, elev: 810,  region: 'شمال دارفور' },

  // ── غرب دارفور ──
  elgeneina:   { name: 'الجنينة',         lat: 13.4572, lon: 22.4472, elev: 800,  region: 'غرب دارفور' },
  kulbus:      { name: 'كلبس',            lat: 13.7833, lon: 22.1167, elev: 770,  region: 'غرب دارفور' },

  // ── جنوب دارفور ──
  nyala:       { name: 'نيالا',           lat: 12.0490, lon: 24.8794, elev: 670,  region: 'جنوب دارفور' },
  edd:         { name: 'الضعين',          lat: 11.4667, lon: 26.1333, elev: 500,  region: 'جنوب دارفور' },

  // ── وسط دارفور ──
  zalingei:    { name: 'زالنجي',          lat: 12.9079, lon: 23.4712, elev: 900,  region: 'وسط دارفور' },

  // ── شرق دارفور ──
  eldeain:     { name: 'الدعين',          lat: 11.4700, lon: 26.1200, elev: 505,  region: 'شرق دارفور' },
  adilla:      { name: 'عديلة',           lat: 12.5167, lon: 27.4000, elev: 540,  region: 'شرق دارفور' },
};

// المدن الرئيسية — تظهر أولاً في الواجهة

// ── المدن الرئيسية — مدينة واحدة لكل ولاية ──

const MAIN_CITIES = [
  'khartoum','wadmedani','kosti','sennar','damazin',
  'kassala','gedaref','portsudan','atbara','dongola',
  'elobeid','kadugli','ennahud','elfasher','nyala',
  'geneina','zalingei','ed_daein',
];

module.exports = { CITIES, MAIN_CITIES };
