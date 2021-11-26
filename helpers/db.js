import Model from "../libraries/model.js"
import * as utils from "./utils.js"

const DB = {}

export async function check_data(table, where = [], select = "1", custom_queries = [], db = "lestari_server", debug = false) {
    if (utils.get_data_type(select) === "Object") {
        custom_queries = select.custom_queries ?? custom_queries
        db = select.db ?? db
        debug = select.debug ?? debug
        select = select.select ?? "*"
    }

    db = load_db(db)
    db.table(table).select(select).where(where)
    custom_queries.forEach(e => {
        let [k, v] = Object.entries(e)[0]
        if (!Array.isArray(v)) v = [v] 
        db[k](...v)
    })

    if (debug) console.log(db.get_as_string({reset: false}))

    let result = await db.get()
    
    if (select === "1" || utils.is_empty_array(result)) return !utils.is_empty_array(result)
    
    if (result.length > 1) return result
    
    result = result[0]
    select = select.split(",")
    if (select.length === 1 && select[0].trim() !== "*") return result[select]
    return result
}

export function escape(data) {
    return load_db().escape(data)
}

export function get_last_insert_id(db = "lestari_server") {
    return load_db(db).get_last_insert_id()
}

export function load_db(db = "lestari_server") {
    if (utils.is_empty(DB[db])) DB[db] = new Model(db)
    return DB[db]
}

export function trans_start(db = "lestari_server") {
    load_db(db).trans_start()
}

export function trans_commit(db = "lestari_server") {
    load_db(db).trans_commit()
}

export function trans_rollback(db = "lestari_server", tables) {
    load_db(db).trans_rollback(tables)
}
