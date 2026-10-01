/**
 * Riset Anatomi Nama Bayi Indonesia - Asuh Anak
 * ================================================
 * Script pengolah data untuk artikel riset di:
 *   https://asuhanak.com/artikel/riset-anatomi-2089-nama-bayi-indonesia
 *
 * TUJUAN: setiap angka yang muncul di artikel harus bisa dihitung ulang
 * oleh siapa pun dari data mentah yang sama. Tidak ada angka yang diketik
 * manual ke artikel tanpa keluar dari script ini.
 *
 * SUMBER DATA (primer, milik sendiri):
 *   website/data/baby-names.json - Kamus Nama Bayi Asuh Anak, 2.089 entri.
 *   Dataset kurasi redaksi, dipakai untuk halaman /nama-bayi di asuhanak.com.
 *   Snapshot dibekukan pada 2026-07-31.
 *
 * CARA MENJALANKAN (dari root repo "Asuh Anak"):
 *   node data/riset/analisis-korpus-nama-bayi.mjs
 *
 * KELUARAN:
 *   data/riset/nama-bayi-korpus-2026-07-31.csv   (data mentah + kolom turunan)
 *   data/riset/hasil-analisis-2026-07-31.json    (semua angka artikel)
 *   stdout                                       (tabel siap baca)
 *
 * Dilisensikan CC BY 4.0. Boleh dipakai ulang dengan atribusi tautan ke
 * asuhanak.com.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..");
const SOURCE = path.join(ROOT, "website", "data", "baby-names.json");
const TANGGAL_AMBIL = "2026-07-31";

const OUT_CSV = path.join(HERE, `nama-bayi-korpus-${TANGGAL_AMBIL}.csv`);
const OUT_JSON = path.join(HERE, `hasil-analisis-${TANGGAL_AMBIL}.json`);

// ---------------------------------------------------------------------------
// 1. Muat data mentah
// ---------------------------------------------------------------------------

const NAMES = JSON.parse(fs.readFileSync(SOURCE, "utf8"));

// ---------------------------------------------------------------------------
// 2. Definisi metrik (semua eksplisit, tidak ada langkah tersembunyi)
// ---------------------------------------------------------------------------

/** Jumlah huruf, spasi dan tanda hubung tidak dihitung. */
const jumlahHuruf = (s) => s.replace(/[^A-Za-z]/g, "").length;

/** Jumlah kata penyusun nama (nama rangkaian bisa 2 atau 3 kata). */
const jumlahKata = (s) => s.trim().split(/\s+/).length;

/**
 * Perkiraan jumlah suku kata untuk satu kata.
 *
 * ATURAN (sengaja sederhana supaya bisa direproduksi persis):
 * setiap huruf vokal (a, i, u, e, o) dihitung sebagai satu inti suku kata,
 * KECUALI pasangan diftong "ai", "au", dan "oi" yang dihitung satu.
 *
 * Ini PENDEKATAN, bukan pemenggalan fonologis resmi. Contoh yang tepat:
 * Muhammad = 3, Kirana = 3, Alifia = 4, Zaidan = 2, Aisyah = 2.
 * Contoh yang bisa meleset: Naura dihitung 2, padahal banyak orang
 * melafalkannya Na-u-ra (3). Keterbatasan ini diumumkan di artikel.
 * Karena aturan yang sama dipakai untuk semua kelompok, PERBANDINGAN antar
 * kelompok tetap sahih walaupun angka absolutnya perkiraan.
 */
function sukuKataKata(kata) {
  const w = kata.toLowerCase().replace(/[^a-z]/g, "");
  const VOKAL = "aeiou";
  const DIFTONG = ["ai", "au", "oi"];
  let n = 0;
  let i = 0;
  while (i < w.length) {
    if (VOKAL.includes(w[i])) {
      n += 1;
      if (DIFTONG.includes(w.slice(i, i + 2))) i += 2;
      else i += 1;
      while (i < w.length && VOKAL.includes(w[i])) {
        n += 1;
        i += 1;
      }
    } else {
      i += 1;
    }
  }
  return n;
}

/** Total suku kata satu entri nama (dijumlah dari tiap kata penyusunnya). */
const sukuKata = (s) =>
  s
    .trim()
    .split(/\s+/)
    .reduce((a, w) => a + sukuKataKata(w), 0);

const hurufAwal = (s) => s.trim()[0].toUpperCase();
const hurufAkhir = (s) => s.trim().slice(-1).toLowerCase();

const rerata = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const median = (a) => {
  const s = [...a].sort((x, y) => x - y);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const modus = (a) => {
  const c = new Map();
  a.forEach((v) => c.set(v, (c.get(v) || 0) + 1));
  return [...c.entries()].sort((x, y) => y[1] - x[1])[0][0];
};
const bulat1 = (x) => Math.round(x * 10) / 10;
const bulat2 = (x) => Math.round(x * 100) / 100;
const persen = (a, b) => bulat1((a / b) * 100);

/**
 * Kata umum bahasa Indonesia yang dibuang sebelum menghitung frekuensi kata
 * di kolom "arti". Daftar ini sengaja ditulis lengkap di sini supaya siapa pun
 * bisa memeriksa dan mengulang perhitungan yang sama.
 */
const STOPWORD = new Set([
  "yang", "dan", "atau", "dari", "di", "ke", "pada", "untuk", "dengan",
  "sebagai", "adalah", "itu", "ini", "akan", "bagi", "oleh", "dalam", "serta",
  "juga", "lagi", "se", "si", "para", "nya", "sang", "tak", "tidak", "bisa",
  "dapat", "maupun", "baik", "ia", "dia", "mereka", "kami", "kita", "anda",
  "saya", "pun", "agar", "supaya", "karena", "sehingga", "saat", "ketika",
  "telah", "sudah", "masih", "selalu", "sangat", "lebih", "paling", "amat",
  "begitu", "banyak", "satu", "dua", "punya", "memiliki", "beri", "diberi",
  "penuh", "orang", "yg", "a", "an", "the", "of",
]);

/** Pecah teks arti jadi kata, huruf kecil, tanpa tanda baca. */
const kataArti = (s) =>
  s
    .toLowerCase()
    .replace(/[^a-zà-ÿ\s-]/gi, " ")
    .split(/[\s-]+/)
    .filter(Boolean);

/**
 * Hitung berapa BANYAK NAMA yang artinya memuat sebuah kata.
 * Dihitung per nama (satu nama menyumbang maksimal 1 untuk tiap kata), bukan
 * per kemunculan, supaya arti yang panjang tidak menggelembungkan angkanya.
 */
function frekuensiKataArti(subset) {
  const c = new Map();
  for (const n of subset) {
    const unik = new Set();
    for (const w of kataArti(n.arti)) {
      if (w.length < 3 || STOPWORD.has(w)) continue;
      unik.add(w);
    }
    for (const w of unik) c.set(w, (c.get(w) || 0) + 1);
  }
  return c;
}

// ---------------------------------------------------------------------------
// 3. Bangun tabel turunan per nama
// ---------------------------------------------------------------------------

const ROWS = NAMES.map((n) => ({
  slug: n.slug,
  nama: n.name,
  gender: n.gender,
  asal: n.origin,
  arti: n.meaning,
  tema: (n.themes || []).join("|"),
  varian: (n.variants || []).join("|"),
  jumlah_varian: (n.variants || []).length,
  jumlah_huruf: jumlahHuruf(n.name),
  jumlah_kata: jumlahKata(n.name),
  perkiraan_suku_kata: sukuKata(n.name),
  huruf_awal: hurufAwal(n.name),
  huruf_akhir: hurufAkhir(n.name),
}));

// ---------------------------------------------------------------------------
// 4. Pemeriksaan mutu data (dilaporkan apa adanya di artikel)
// ---------------------------------------------------------------------------

const mutu = {
  total_baris: ROWS.length,
  slug_duplikat: ROWS.length - new Set(ROWS.map((r) => r.slug)).size,
  nama_duplikat_tanpa_kapital:
    ROWS.length - new Set(ROWS.map((r) => r.nama.toLowerCase())).size,
  asal_kosong: ROWS.filter((r) => !r.asal).length,
  arti_kosong: ROWS.filter((r) => !r.arti).length,
  tema_kosong: ROWS.filter((r) => !r.tema).length,
};

// ---------------------------------------------------------------------------
// 5. Analisis
// ---------------------------------------------------------------------------

const TOTAL = ROWS.length;
const GENDERS = ["laki-laki", "perempuan", "unisex"];
const byGender = Object.fromEntries(
  GENDERS.map((g) => [g, ROWS.filter((r) => r.gender === g)]),
);

// 5a. Komposisi gender
const komposisiGender = GENDERS.map((g) => ({
  gender: g,
  jumlah: byGender[g].length,
  persen: persen(byGender[g].length, TOTAL),
}));

// 5b. Asal bahasa x gender
const asalUnik = [...new Set(ROWS.map((r) => r.asal))];
const asalBahasa = asalUnik
  .map((asal) => {
    const s = ROWS.filter((r) => r.asal === asal);
    const l = s.filter((r) => r.gender === "laki-laki").length;
    const p = s.filter((r) => r.gender === "perempuan").length;
    const u = s.filter((r) => r.gender === "unisex").length;
    return {
      asal,
      jumlah: s.length,
      persen: persen(s.length, TOTAL),
      laki_laki: l,
      perempuan: p,
      unisex: u,
      rerata_huruf: bulat2(rerata(s.map((r) => r.jumlah_huruf))),
      rerata_suku_kata: bulat2(rerata(s.map((r) => r.perkiraan_suku_kata))),
      rerata_kata: bulat2(rerata(s.map((r) => r.jumlah_kata))),
      persen_satu_kata: persen(s.filter((r) => r.jumlah_kata === 1).length, s.length),
      persen_tiga_kata: persen(s.filter((r) => r.jumlah_kata === 3).length, s.length),
      persen_punya_varian: persen(s.filter((r) => r.jumlah_varian > 0).length, s.length),
    };
  })
  .sort((a, b) => b.jumlah - a.jumlah);

// 5c. Panjang nama per gender
const panjangNama = GENDERS.map((g) => {
  const s = byGender[g];
  const huruf = s.map((r) => r.jumlah_huruf);
  const suku = s.map((r) => r.perkiraan_suku_kata);
  const kata = s.map((r) => r.jumlah_kata);
  return {
    gender: g,
    jumlah: s.length,
    rerata_huruf: bulat2(rerata(huruf)),
    median_huruf: median(huruf),
    rerata_suku_kata: bulat2(rerata(suku)),
    median_suku_kata: median(suku),
    modus_suku_kata: modus(suku),
    rerata_kata: bulat2(rerata(kata)),
    persen_satu_kata: persen(s.filter((r) => r.jumlah_kata === 1).length, s.length),
    persen_dua_kata: persen(s.filter((r) => r.jumlah_kata === 2).length, s.length),
    persen_tiga_kata: persen(s.filter((r) => r.jumlah_kata === 3).length, s.length),
  };
});

// 5d. Panjang nama, dibatasi hanya nama satu kata (pembanding paling adil,
// karena nama rangkaian otomatis lebih panjang)
const panjangSatuKata = ["laki-laki", "perempuan"].map((g) => {
  const s = byGender[g].filter((r) => r.jumlah_kata === 1);
  return {
    gender: g,
    jumlah: s.length,
    rerata_huruf: bulat2(rerata(s.map((r) => r.jumlah_huruf))),
    median_huruf: median(s.map((r) => r.jumlah_huruf)),
    rerata_suku_kata: bulat2(rerata(s.map((r) => r.perkiraan_suku_kata))),
  };
});

// 5e. Huruf awal
const ALFABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const hitungHuruf = (subset) => {
  const c = Object.fromEntries(ALFABET.map((h) => [h, 0]));
  subset.forEach((r) => {
    if (c[r.huruf_awal] !== undefined) c[r.huruf_awal] += 1;
  });
  return c;
};
const awalSemua = hitungHuruf(ROWS);
const awalLaki = hitungHuruf(byGender["laki-laki"]);
const awalPerempuan = hitungHuruf(byGender["perempuan"]);
const hurufAwalTabel = ALFABET.map((h) => ({
  huruf: h,
  jumlah: awalSemua[h],
  persen: persen(awalSemua[h], TOTAL),
  laki_laki: awalLaki[h],
  perempuan: awalPerempuan[h],
})).sort((a, b) => b.jumlah - a.jumlah);

// 5f. Huruf akhir, hanya nama satu kata (huruf akhir nama rangkaian
// mencerminkan kata terakhirnya saja, jadi dipisah supaya jujur)
const hurufAkhirTabel = ["laki-laki", "perempuan"].map((g) => {
  const s = byGender[g].filter((r) => r.jumlah_kata === 1);
  const c = new Map();
  s.forEach((r) => c.set(r.huruf_akhir, (c.get(r.huruf_akhir) || 0) + 1));
  const vokal = s.filter((r) => "aeiou".includes(r.huruf_akhir)).length;
  return {
    gender: g,
    jumlah: s.length,
    persen_berakhir_vokal: persen(vokal, s.length),
    lima_teratas: [...c.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([huruf, jumlah]) => ({ huruf, jumlah, persen: persen(jumlah, s.length) })),
  };
});

// 5g. Ladang makna
const freqSemua = frekuensiKataArti(ROWS);
const freqLaki = frekuensiKataArti(byGender["laki-laki"]);
const freqPerempuan = frekuensiKataArti(byGender["perempuan"]);
const nL = byGender["laki-laki"].length;
const nP = byGender["perempuan"].length;

const toList = (map, n, k) =>
  [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, k)
    .map(([kata, jumlah]) => ({ kata, jumlah, persen: persen(jumlah, n) }));

const maknaSemua = toList(freqSemua, TOTAL, 20);
const maknaLaki = toList(freqLaki, nL, 15);
const maknaPerempuan = toList(freqPerempuan, nP, 15);

/**
 * Kata paling condong ke satu gender. Ambang minimal 20 kemunculan gabungan
 * supaya kata langka tidak menghasilkan selisih persen yang menyesatkan.
 */
const AMBANG = 20;
const semuaKata = new Set([...freqLaki.keys(), ...freqPerempuan.keys()]);
const condong = [...semuaKata]
  .map((kata) => {
    const l = freqLaki.get(kata) || 0;
    const p = freqPerempuan.get(kata) || 0;
    if (l + p < AMBANG) return null;
    const rl = (l / nL) * 100;
    const rp = (p / nP) * 100;
    return {
      kata,
      laki_laki: l,
      persen_laki_laki: bulat1(rl),
      perempuan: p,
      persen_perempuan: bulat1(rp),
      selisih_poin: bulat1(rl - rp),
    };
  })
  .filter(Boolean);
const condongLaki = [...condong].sort((a, b) => b.selisih_poin - a.selisih_poin).slice(0, 10);
const condongPerempuan = [...condong].sort((a, b) => a.selisih_poin - b.selisih_poin).slice(0, 10);

// 5h. Tema
const temaUnik = [...new Set(ROWS.flatMap((r) => (r.tema ? r.tema.split("|") : [])))];
const temaTabel = temaUnik
  .map((tema) => {
    const s = ROWS.filter((r) => r.tema.split("|").includes(tema));
    return { tema, jumlah: s.length, persen: persen(s.length, TOTAL) };
  })
  .sort((a, b) => b.jumlah - a.jumlah);

// 5i. Varian ejaan
const punyaVarian = ROWS.filter((r) => r.jumlah_varian > 0);
const varian = {
  nama_punya_varian: punyaVarian.length,
  persen_punya_varian: persen(punyaVarian.length, TOTAL),
  total_string_varian: ROWS.reduce((a, r) => a + r.jumlah_varian, 0),
  rerata_varian_pada_yang_punya: bulat2(rerata(punyaVarian.map((r) => r.jumlah_varian))),
  varian_terbanyak: Math.max(...ROWS.map((r) => r.jumlah_varian)),
};

// 5j. Ekstrem
const urutPanjang = [...ROWS].sort((a, b) => b.jumlah_huruf - a.jumlah_huruf);
const ekstrem = {
  terpanjang: urutPanjang.slice(0, 3).map((r) => ({ nama: r.nama, huruf: r.jumlah_huruf })),
  terpendek: urutPanjang
    .slice(-5)
    .reverse()
    .map((r) => ({ nama: r.nama, huruf: r.jumlah_huruf })),
};

// ---------------------------------------------------------------------------
// 6. Tulis keluaran
// ---------------------------------------------------------------------------

const KOLOM = [
  "slug", "nama", "gender", "asal", "arti", "tema", "varian", "jumlah_varian",
  "jumlah_huruf", "jumlah_kata", "perkiraan_suku_kata", "huruf_awal", "huruf_akhir",
];
const csvSel = (v) => {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const csv = [
  KOLOM.join(","),
  ...ROWS.map((r) => KOLOM.map((k) => csvSel(r[k])).join(",")),
].join("\n");
fs.writeFileSync(OUT_CSV, csv + "\n", "utf8");

const hasil = {
  judul: "Anatomi 2.089 Nama Bayi Indonesia",
  penerbit: "Asuh Anak (asuhanak.com)",
  tanggal_pengambilan_data: TANGGAL_AMBIL,
  sumber_data: "website/data/baby-names.json (Kamus Nama Bayi Asuh Anak)",
  lisensi: "CC BY 4.0",
  total_titik_data: TOTAL,
  mutu_data: mutu,
  komposisi_gender: komposisiGender,
  asal_bahasa: asalBahasa,
  panjang_nama_per_gender: panjangNama,
  panjang_nama_satu_kata: panjangSatuKata,
  huruf_awal: hurufAwalTabel,
  huruf_akhir_satu_kata: hurufAkhirTabel,
  makna_semua: maknaSemua,
  makna_laki_laki: maknaLaki,
  makna_perempuan: maknaPerempuan,
  kata_condong_laki_laki: condongLaki,
  kata_condong_perempuan: condongPerempuan,
  tema: temaTabel,
  varian_ejaan: varian,
  ekstrem,
};
fs.writeFileSync(OUT_JSON, JSON.stringify(hasil, null, 2), "utf8");

// ---------------------------------------------------------------------------
// 7. Cetak ringkas ke layar
// ---------------------------------------------------------------------------

const p = console.log;
p(`Sumber      : ${SOURCE}`);
p(`Tanggal     : ${TANGGAL_AMBIL}`);
p(`Titik data  : ${TOTAL}`);
p(`Mutu data   : ${JSON.stringify(mutu)}`);
p("");
p("== KOMPOSISI GENDER ==");
komposisiGender.forEach((r) => p(`${r.gender}\t${r.jumlah}\t${r.persen}%`));
p("");
p("== ASAL BAHASA ==");
p("asal\tn\t%\tL\tP\tU\thuruf\tsuku\tkata\t1kata%\t3kata%\tvarian%");
asalBahasa.forEach((r) =>
  p(
    [r.asal, r.jumlah, r.persen + "%", r.laki_laki, r.perempuan, r.unisex,
     r.rerata_huruf, r.rerata_suku_kata, r.rerata_kata, r.persen_satu_kata,
     r.persen_tiga_kata, r.persen_punya_varian].join("\t"),
  ),
);
p("");
p("== PANJANG NAMA PER GENDER ==");
p("gender\tn\thuruf(rerata/median)\tsuku(rerata/median/modus)\t1kata%\t2kata%\t3kata%");
panjangNama.forEach((r) =>
  p(
    [r.gender, r.jumlah, `${r.rerata_huruf}/${r.median_huruf}`,
     `${r.rerata_suku_kata}/${r.median_suku_kata}/${r.modus_suku_kata}`,
     r.persen_satu_kata, r.persen_dua_kata, r.persen_tiga_kata].join("\t"),
  ),
);
p("");
p("== PANJANG NAMA SATU KATA SAJA ==");
panjangSatuKata.forEach((r) =>
  p(`${r.gender}\tn=${r.jumlah}\thuruf=${r.rerata_huruf}\tmedian=${r.median_huruf}\tsuku=${r.rerata_suku_kata}`),
);
p("");
p("== HURUF AWAL (10 teratas) ==");
hurufAwalTabel.slice(0, 10).forEach((r) =>
  p(`${r.huruf}\t${r.jumlah}\t${r.persen}%\tL=${r.laki_laki}\tP=${r.perempuan}`),
);
p(`Huruf tanpa satu pun nama: ${hurufAwalTabel.filter((r) => r.jumlah === 0).map((r) => r.huruf).join(", ") || "tidak ada"}`);
p("");
p("== HURUF AKHIR (nama satu kata) ==");
hurufAkhirTabel.forEach((r) =>
  p(`${r.gender}\tn=${r.jumlah}\tberakhir vokal=${r.persen_berakhir_vokal}%\t` +
    r.lima_teratas.map((x) => `${x.huruf}=${x.persen}%`).join(" ")),
);
p("");
p("== LADANG MAKNA (20 kata teratas, semua nama) ==");
maknaSemua.forEach((r) => p(`${r.kata}\t${r.jumlah}\t${r.persen}%`));
p("");
p("== KATA PALING CONDONG KE LAKI-LAKI ==");
condongLaki.forEach((r) =>
  p(`${r.kata}\tL=${r.laki_laki}(${r.persen_laki_laki}%)\tP=${r.perempuan}(${r.persen_perempuan}%)\tselisih=${r.selisih_poin}`),
);
p("");
p("== KATA PALING CONDONG KE PEREMPUAN ==");
condongPerempuan.forEach((r) =>
  p(`${r.kata}\tL=${r.laki_laki}(${r.persen_laki_laki}%)\tP=${r.perempuan}(${r.persen_perempuan}%)\tselisih=${r.selisih_poin}`),
);
p("");
p("== TEMA ==");
temaTabel.forEach((r) => p(`${r.tema}\t${r.jumlah}\t${r.persen}%`));
p("");
p("== VARIAN EJAAN ==");
p(JSON.stringify(varian));
p("");
p("== EKSTREM ==");
p(JSON.stringify(ekstrem));
p("");
p(`CSV  -> ${OUT_CSV}`);
p(`JSON -> ${OUT_JSON}`);
