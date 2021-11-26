import Model from "../libraries/model.js"
import * as utils from "../helpers/utils.js"
import * as db from "../helpers/db.js"
const lestari_server = new Model("lestari_server")

export async function read(type, data) {
    switch (type) {
        case "ac_dokumen_samsat":
            var { tp: tipe_pencarian, f: filter } = data
            if (tipe_pencarian === "0") {
                var result = await lestari_server.table("nomormesin").
                select("NoMesin id, NoMesin dname").
                like([{NoMesin: filter}]).
                limit(utils.get_autocomplete_limit()).
                get()
            } else {
                var result = await lestari_server.table("nomormesin").
                    select("NoRangka id, NoRangka dname").
                    like([{NoRangka: filter}]).
                    limit(utils.get_autocomplete_limit()).
                    get()
            }
        return [true, result]
        case "get_dokumen_samsat":
            var { tp: tipe_pencarian, f: filter } = data
            var error_response = [false, "Dokumen tidak dapat ditemukan!"]

            var no_mesin
            var no_rangka
            if (tipe_pencarian === "0") {
                no_mesin = filter
                no_rangka = await db.check_data("penjualan", [{NoMesin: no_mesin}], {select: "NoRangka", custom_queries: [{limit: 1}]})
                if (!no_rangka) return error_response
            } else {
                no_rangka = filter
                no_mesin = await db.check_data("penjualan", [{NoRangka: no_rangka}], {select: "NoMesin", custom_queries: [{limit: 1}]})
                if (!no_mesin) return error_response
            }

            var query_pemohon = `
                SELECT 
                    CONCAT(b.NmDepan, ' ', b.NmBelakang) Nama, b.KTP 'No. KTP', b.Alamat As Alamat, 
                    e.NmKelurahan AS Kelurahan, d.NmKecamatan As Kecamatan, c.NmKota As Kota,
                    CONCAT(NoTelp1,if (NoTelp2 = '','',','),NoTelp2) As 'No. Telp', DATE_FORMAT(a.TglPJ, '%d-%m-%Y') As 'Tgl Penjualan', (SELECT DATE_FORMAT(TglFC, '%d-%m-%Y') FROM FakturCetak WHERE NoMesin = '${no_mesin}' AND Jenis = 1) 'Tgl Terima FC', 
                    (SELECT DATE_FORMAT(TglFC, '%d-%m-%Y') FROM FakturCetak WHERE NoMesin = '${no_mesin}' AND Jenis = 2) 'Tgl Serah Agency', a.IDItem As 'Kode Tipe', f.NmItem As 'Nama Tipe', 
                    g.NmWarna As 'Kode Warna', a.NoMesin 'No. Mesin', a.NoRangka 'No. Rangka', 
                    a.IDFincoy As Fincoy 
                FROM ((((((
                    Penjualan a Left Join Konsumen b On a.KdKonsumen = b.KdKonsumen) 
                    Left Join Kota c On b.KdKota = c.KdKota) 
                    Left Join Kecamatan d On b.KdKecamatan = d.KdKecamatan) 
                    Left Join Kelurahan e On b.KdKelurahan = e.KdKelurahan) 
                    Left Join Item f On a.IDItem = f.IDItem) 
                    Left Join Warna g On a.IDWarna = g.IDWarna) 
                WHERE 
                    a.NoRangka = '${no_rangka}' AND 
                    MID(a.NoPJ, 3, 2) = 'H1' AND 
                    a.StsBatal = 0
            `
            var result_pemohon = await lestari_server.query(query_pemohon)
            if (utils.is_empty_array(result_pemohon)) return error_response
            result_pemohon = result_pemohon[0]

            var query_stnk = `
                SELECT 
                    CONCAT(a.NmDepan2, ' ', a.NmBelakang2) As Nama, a.KTP2 AS 'No. KTP', 
                    a.Alamat2 As Alamat, d.NmKelurahan AS Kelurahan, c.NmKecamatan As Kecamatan, 
                    b.NmKota As Kota
                FROM(((
                    Penjualan a 
                    Left Join Kota b On a.KdKota2 = b.KdKota) 
                    Left Join Kecamatan c On a.KdKecamatan2 = c.KdKecamatan) 
                    Left Join Kelurahan d On a.KdKelurahan2 = d.KdKelurahan) 
                WHERE 
                    a.NoRangka = '${no_rangka}' AND 
                    MID(a.NoPJ, 3, 2) = 'H1' 
                    AND a.StsBatal = 0
            `
            var result_stnk = await lestari_server.query(query_stnk)
            if (utils.is_empty_array(result_stnk)) return error_response
            result_stnk = result_stnk[0]

            var query_tgl = `
                SELECT 
                    DATE_FORMAT(a.TglTrmSTNK, '%d-%m-%Y') 'Tgl Terima STNK', 
                    (
                        SELECT CONCAT(RIGHT(TglSerah, 2), '-', MID(TglSerah, 5, 2), '-', LEFT(TglSerah, 4)) 
                        From Samsat 
                        WHERE Jenis = 2 And NoMesin = '${no_mesin}' AND TipeDok = 1
                    ) 'Tgl Serah STNK', 
                    DATE_FORMAT(a.TglTrmPlat, '%d-%m-%Y') 'Tgl Terima Plat', 
                    (
                        Select CONCAT(RIGHT(TglSerah,2), '-', MID(TglSerah,5,2), '-', LEFT(TglSerah,4)) 
                        From Samsat 
                        WHERE Jenis = 2 And NoMesin = '${no_mesin}' AND TipeDok = 2
                    ) 'Tgl Serah Plat', 
                    DATE_FORMAT(a.TglTrmBPKB, '%d-%m-%Y') 'Tgl Terima BPKB', 
                    (
                        Select CONCAT(RIGHT(TglSerah,2), '-', MID(TglSerah,5,2), '-', LEFT(TglSerah,4)) 
                        From Samsat 
                        WHERE Jenis = 2 And NoMesin = '${no_mesin}' AND TipeDok = 3
                    ) 'Tgl Serah BPKB'
                From penjualan a 
                WHERE 
                    Mid(a.NoPJ, 3, 2) = 'H1' And 
                    a.NoRangka = '${no_rangka}' And 
                    a.StsBatal = 0
            `
            var result_tgl = await lestari_server.query(query_tgl)
            if (utils.is_empty_array(result_tgl)) return error_response
            result_tgl = result_tgl[0]
        return [true, {data_pemohon: result_pemohon, data_stnk: result_stnk, data_tgl: result_tgl}]
    }
}
