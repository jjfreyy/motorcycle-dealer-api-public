import Model from "../libraries/model.js"
import * as utils from "../helpers/utils.js"
import * as db from "../helpers/db.js"
const lestari_server = new Model("lestari_server")
const lestari_sm = new Model("lestari_sm")

export async function read(type, data) {
    switch (type) {
        case "ac_item":
            var filter = data.f
            var query = `
                Select a.IDItem id, a.NmItem dname, CONCAT(a.IDItem, ' - ', a.NmItem) dfname 
                From (item a 
                Left Join kategori b On a.IDkategori = b.IDkategori)
                WHERE (a.Nmitem LIKE '%${filter}%' Or a.IDItem LIKE '%${filter}%') AND b.Kelompok = 'MOTOR' And a.StsAktifJ = 1
                LIMIT ${utils.get_autocomplete_limit()}
            `
            var result = await lestari_server.query(query)
        return [true, result]
        case "get_item_stok":
            var {ii: id_item, tr: tahun_rakit, oi: office_id} = data
            var query_office = ["", "", "", ""]
            var err_response = [false, utils.ctrim(`Data stok ${id_item} tidak dapat ditemukan!`)]
            if (!utils.is_empty(office_id) && office_id !== "-1") {
                var kd_cabang = await db.check_data("branch_office", [{office_id: office_id}], { select: "kd_cabang", db: "lestari_sm" })
                if (utils.is_empty(kd_cabang)) return [false, "Cabang tidak dapat ditemukan!"]
                query_office = [
                    ` AND a.KdCabang = '${kd_cabang}'`,
                    ` AND LEFT(tbe.NoPo, 2) = '${kd_cabang}'`,
                    ` AND KdCabang2 = '${kd_cabang}'`,
                    ` AND o.kd_cabang = '${kd_cabang}'`,
                ]
            }

            var id_item1 = await lestari_server.query(`
                SELECT IF(IDItemI = '',IDItem,IDItemI) As IDItemI 
                FROM (
                    SELECT DISTINCT(IDItemI) As IDItemI, IDItem FROM Stok WHERE IDItem = '${id_item}'
                ) X
            `)
            id_item1 = id_item1?.[0]?.IDItemI
            if (utils.is_empty(id_item1)) return err_response;
            
            var query = `
                WITH cte1 AS (
                    SELECT 
                    IFNULL(y.NmGudang, x.KdGudang) AS gudang, x.IDWarna, SUM(x.IDItem) AS Total
                    FROM (
                    SELECT a.KdGudang, 1 AS IDItem, IDWarna
                    FROM Stok a
                    WHERE 
                        a.StsCO = 0 AND 
                        a.NoPJ = '' AND 
                        (a.IDItem = '${id_item1}' OR a.IDItemI = '${id_item1}') AND 
                        a.ThnRakit = '${tahun_rakit}'
                        ${query_office[0]}
                    
                    UNION ALL
                    SELECT 'Main Dealer', IFNULL(SUM(Qty-QtyTerima),0) AS IdItem, tbe1.IDWarna
                    FROM pembeliand AS tbe1
                    JOIN pembelian AS tbe ON tbe1.NoPO = tbe.NoPO
                    WHERE 
                        Qty <> QtyTerima AND 
                        IDItem IN (
                        SELECT IF(IDItem IS NULL, '${id_item}', IDItem)
                        FROM GbgItemD
                        WHERE IDItem = '${id_item}'
                        ) AND
                        tbe.StsBatal = 0
                        ${query_office[1]} 
                        
                    UNION ALL
                    SELECT 'PAC Belum Terima', SUM(Qty-QtyTerima) AS IDItem, IDWarna
                    FROM MutasiD
                    WHERE 
                        NoMutasi IN (
                        SELECT NoMutasi
                        FROM Mutasi
                        WHERE 
                            YEAR(TglMutasi) = '${tahun_rakit}' AND 
                            JnsMutasi = 2 AND  
                            StsBatal = 0
                            ${query_office[2]}
                        ) AND 
                        IDItem IN (
                        SELECT IF(IDItem IS NULL, '${id_item}', IDItem)
                        FROM GbgItemD
                        WHERE IDItem IN (
                            SELECT IDItem
                            FROM GbgItemD
                            WHERE IDItem = '${id_item}'
                        )
                        ) AND 
                        Qty <> QtyTerima
                    ) x
                    LEFT JOIN Gudang y ON x.KdGudang = y.KdGudang
                    GROUP BY x.KdGudang, x.IDWarna
                    ORDER BY x.KdGudang
                )
                
                SELECT gudang, GROUP_CONCAT(CONCAT(IDWarna, ':', total) ORDER BY IDWarna SEPARATOR ';') stok_detail
                FROM cte1
                WHERE gudang IN ('Main Dealer', 'PAC Belum Terima')
                GROUP BY gudang
                
                UNION ALL
                SELECT gudang, GROUP_CONCAT(CONCAT(IDWarna, ':', total) ORDER BY IDWarna SEPARATOR ';') stok_detail
                FROM cte1
                WHERE gudang NOT IN ('Main Dealer', 'PAC Belum Terima')
                GROUP BY gudang
            `
            var result = await lestari_server.query(query)
            if (utils.is_empty_array(result)) return $error_response
            var id_item_list = await lestari_server.query(`
                SELECT GROUP_CONCAT(IFNULL(CONCAT('\\'', IDItem, '\\''), '\\'${id_item}\\'') SEPARATOR ',') id_item_list 
                FROM gbgitemd 
                WHERE NoBukti IN (
                    SELECT NoBukti 
                    FROM gbgitemd 
                    WHERE IDItem IN (SELECT IDItem FROM GbgItemD WHERE IDItem = '${id_item}')
                )
            `)
            id_item_list = id_item_list?.[0]?.id_item_list
            if (utils.is_empty(id_item_list)) id_item_list = `'${id_item}'`
            var result1 = await lestari_sm.query(`
                SELECT 'Pending Kirim Penjualan' gudang, GROUP_CONCAT(CONCAT(IDWARNA, ':', total) ORDER BY IDWarna SEPARATOR ';') stok_detail
                FROM (
                    SELECT a.color_id IDWarna, COUNT(a.credit_id) Total
                    FROM (((credit a 
                    LEFT JOIN pending_result b on a.credit_id = b.credit_id)
                    LEFT JOIN pending_send c on b.pending_result_id = c.pending_result_id)
                    LEFT JOIN branch_office o on a.office_id = o.office_id)
                    WHERE c.status = '0' ${query_office[3]}
                    AND a.product_category_id IN (${id_item_list})
                    GROUP BY a.product_category_id, a.color_id
                ) t1 
            `)
            result.splice(2, 0, result1[0])
        return [true, result]
    }
}
