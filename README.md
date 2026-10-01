---
license: cc-by-4.0
language:
- id
pretty_name: Korpus Nama Bayi Indonesia (Asuh Anak, 2.089 entri)
size_categories:
- 1K<n<10K
task_categories:
- text-classification
tags:
- indonesian
- baby-names
- names
- onomastics
---

# Korpus Nama Bayi Indonesia (Asuh Anak, 2.089 entri)

Dataset ini adalah korpus lengkap 2.089 entri nama bayi dari kamus nama di [asuhanak.com](https://asuhanak.com), diambil 2026-07-31. Tiap baris memuat nama, gender, bahasa asal, arti, tema, varian, dan fitur bentuk (jumlah huruf, kata, perkiraan suku kata, huruf awal dan akhir).

Analisis lengkapnya terbit sebagai riset orisinal: **[Anatomi 2.089 Nama Bayi Indonesia](https://asuhanak.com/artikel/riset-anatomi-2089-nama-bayi-indonesia)**.

## Berkas

| Berkas | Isi |
|---|---|
| `nama-bayi-korpus-asuhanak-2026-07-31.csv` | Korpus penuh, 2.089 baris |
| `hasil-analisis-asuhanak-2026-07-31.json` | Hasil agregasi yang dipakai di artikel riset |
| `analisis-korpus-nama-bayi.mjs` | Script Node.js untuk mereproduksi analisis |

## Kolom CSV

`slug, nama, gender, asal, arti, tema, varian, jumlah_varian, jumlah_huruf, jumlah_kata, perkiraan_suku_kata, huruf_awal, huruf_akhir`

## Catatan metodologi

Ini sensus atas isi kamus Asuh Anak, bukan sampel nama yang benar-benar didaftarkan di Dukcapil. Angkanya menggambarkan isi kamus, bukan popularitas nama di populasi.

## Lisensi dan sitasi

[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Silakan pakai, olah, dan terbitkan ulang dengan atribusi:

> Asuh Anak (2026). *Anatomi 2.089 Nama Bayi Indonesia*. https://asuhanak.com/artikel/riset-anatomi-2089-nama-bayi-indonesia
