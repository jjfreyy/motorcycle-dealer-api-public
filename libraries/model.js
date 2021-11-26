import dotenv from "dotenv"
import mysql from "mysql"
import * as utils from "../helpers/utils.js"
dotenv.config()

export default class Model {
    constructor(db = "lestari_server") {
        this.db = db
    }

    async _create_connection() {
        if (this.con && this.con.state === "disconnected") {
            this.con.destroy()
        }

        this.con = mysql.createConnection({
            host: process.env[`db.${this.db}.host`],
            user: process.env[`db.${this.db}.user`],
            _password: process.env[`db.${this.db}.password`],
            get password() {
                return this._password
            },
            set password(value) {
                this._password = value
            },
            database: process.env[`db.${this.db}.database`],
            port: process.env[`db.${this.db}.port`] ?? 3306,
            charset: "utf8_general_ci",
            // multipleStatements: false,
            // useConnectionPooling: true,
        })

        this.con.connect(err => {
            if (err) {
                utils.format_exception(err)
                setTimeout(() => {
                    this._create_connection()
                }, 500)
            } 
        })

        this.con.on("error", async err => {
            utils.format_exception(err)
            console.log("Attempting to reconnect")
            this._create_connection()
        })
    }

    query_builder = {select: "SELECT *"}

    // delete
        delete(table, where, reset = true) {
            const query = this.delete_as_string(table, where, reset)
            return this.query(query, [], reset)
        }    
    
        delete_as_string(table, where, reset = true) {
            if (utils.get_data_type(table) === "Object") {
                where = table.where ?? where
                reset = table.reset ?? reset
                table = table.table
            }
            
            if (!utils.is_empty(table)) this.table(table)
            if (!utils.is_empty_array(where)) this.where(where)
            let del = `DELETE FROM ${this.query_builder.table}`
            del += utils.is_empty(this.query_builder.where) ? "" : ` ${this.query_builder.where}`
            if (reset) this.reset()
            return del
        }
    // delete
    // in
        _where_in(data, parentheses = false, type = "AND", notin = false) {
            if ((Array.isArray(data) && utils.is_empty_array(data)) || utils.is_empty(data)) return

            if (utils.get_data_type(parentheses) === "Object") {
                type = parentheses.type ?? type
                notin = parentheses.notin ?? notin
                parentheses = parentheses.parentheses ?? false
            }

            let where = this.query_builder.where
            let has_open_parentheses = where?.substr(-1, 1) === "("
            if (has_open_parentheses) where = where.substr(0, where.length - 1).trim()
            where = utils.is_empty(where) ? `WHERE` 
                : `${where} ${type}${has_open_parentheses ? ` (` : ""}${parentheses ? " (" : ""}`
            let where_ = []
            data.forEach(e => {
                let [k, v] = Object.entries(e)[0]
                if (utils.get_data_type(v) === "String" && !/select/i.test(v)) v = v.split(", ")
                else {
                    v.forEach((e1, i) => {
                        v[i] = `'${escape(e1)}'`
                    })
                    v = v.join(`, `)
                }
                where_.push(`${k} ${notin ? "NOT " : ""}IN (${v})`)
            })
            
            where += ` ${where_.join(` ${type} `)}`
            this.query_builder.where = `${where}${parentheses ? " )" : ""}`
        }

        or_where_in(data, parentheses) {
            this._where_in(data, parentheses, "OR")
            return this
        }

        or_where_not_in(data, parentheses) {
            this._where_in(data, parentheses, "OR", true)
            return this
        }

        where_in(data, parentheses = false) {
            this._where_in(data, parentheses)
            return this
        }

        where_not_in(data, parentheses) {
            this._where_in(data, parentheses, "AND", true)
            return this
        }
    // in
    // insert
        /**
         * data format: [{col1: val1}, {col2 : val2}] 
         */
        async insert(table, data, reset = true) {
            const query = this.insert_as_string(table, data, reset)
            try {
                const result = await this.query(query, {reset: reset})
                return [true, {affected_rows: result.affectedRows, insert_id: result.insertId}]
            } catch (e) {
                utils.format_exception(e)
                return [false]
            }
        }

        /**
         * data_format: [{col1: val1}, {col2 : val2}] 
         */
        insert_as_string(table, data, reset = true) {
            if (utils.get_data_type(table) === "Object") {
                data = table.data ?? data 
                reset = table.reset ?? reset 
                table = table.table
            }

            if (!utils.is_empty(table)) this.table(table)
            if (!utils.is_empty_array(data)) this.set(data)
            let insert = `INSERT INTO ${this.query_builder.table} (`
            let values = "VALUES ("
            let set = utils.is_empty_array(this.query_builder.set) ? [] : this.query_builder.set
            set.forEach((e, i, arr) => {
                let [k, v] = Object.entries(e)[0]
                insert += ` ${k}`
                values += ` ${escape(v)}`
                if (i !== (arr.length - 1)) {
                    insert += ","
                    values += ","
                } else {
                    insert += " )"
                    values += " )"
                }
            })
            if (reset) this.reset()
            return `${insert} ${values}`
        }

        /**
         * ```
         * data_format: [
         *      [col1, col2, col3],
         *      [val1, val2, val3],
         *      [val1, val2, val3],
         * ]
         * ```
         */
        async insert_batch(table, data, reset = true) {
            let query = this.insert_batch_as_string(table, data, reset)
            try {
                const result = await this.query(query, {reset: reset})
                return [true, {affected_rows: result.affectedRows}]
            } catch (e) {
                utils.format_exception(e)
                return [false]
            }
        }

        /**
         * ```
         * data_format: [
         *      [col1, col2, col3],
         *      [val1, val2, val3],
         *      [val1, val2, val3],
         * ]
         * ```
         */
        insert_batch_as_string(table, data, reset = true) {
            if (utils.get_data_type(table) === "Object") {
                data = table.data ?? data
                reset = table.reset ?? reset
                table = table.table
            }

            if (!utils.is_empty(table)) this.table(table)
            if (!utils.is_empty_array(data)) this.set(data)
            let set = utils.is_empty_array(this.query_builder.set) ? [] : utils.deep_copy(this.query_builder.set)

            let insert = `INSERT INTO ${this.query_builder.table} (`
            set.shift().forEach((e, i, arr) => {
                insert += ` ${e}`
                if (i !== (arr.length -1)) insert += ","
                else insert += " )"
            })

            let values = "VALUES"
            set.forEach((e, i, arr) => {
                values += " ("
                e.forEach((e1, j, arr1) => {
                    values += ` ${escape(e1)}`
                    if (j !== (arr1.length - 1)) values += ","
                })
                values += " )"
                if (i !== (arr.length - 1)) values += ","
            })
            if (reset) this.reset()
            return `${insert} ${values}`
        }
    // insert
    // like
        _like(data, side = "both", parentheses = false, type = "AND", not_like = false) {
            if ((Array.isArray(data) && utils.is_empty_array(data)) || utils.is_empty(data)) return
            
            if (utils.get_data_type(side) === "Object") {
                parentheses = side.parentheses ?? parentheses
                type = side.type ?? type
                not_like = side.not_like ?? not_like
                side = side.side ?? "both"
            }

            let where = this.query_builder.where
            let has_open_parentheses = where?.substr(-1, 1) === "("
            if (has_open_parentheses) where = where.substr(0, where.length - 1).trim()
            where = utils.is_empty(where) ? `WHERE` 
                : `${where} ${type}${has_open_parentheses ? ` (` : ""}${parentheses ? " (" : ""}`
                
            const side_left = side === "both" || side === "left" ? "%" : ""
            const side_right = side === "both" || side === "right" ? "%" : ""
            const data_type = utils.get_data_type(data)
            if (data_type === "String") where += ` ${data}`
            else {
                let where_ = []
                data.forEach(e => {
                    let [k, v] = Object.entries(e)[0]
                    v = `${side_left}${escape(v)}${side_right}`
                    where_.push(`${k} ${not_like ? "NOT " : ""}LIKE '${v}'`)
                })
                where += ` ${where_.join(` ${type} `)}`
            }
            this.query_builder.where = `${where}${parentheses ? " )" : ""}`
        }
        
        like(data, side = "both", parentheses = false) {
            this._like(data, side, parentheses)
            return this
        }

        not_like(data, side = "both", parentheses = false) {
            this._like(data, side, parentheses, "AND", true)
            return this
        }

        or_like(data, side = "both", parentheses = false) {
            this._like(data, side, parentheses, "OR")
            return this
        }

        or_not_like(data, side = "both", parentheses = false) {
            this._like(data, side, parentheses, "OR", true)
            return this
        }
    // like
    // update
        /**
         * data_format: [{col1: val1}, {col2: val2}]
         */
        async update(table, data, where, reset = true) {
            const query = this.update_as_string(table, data, where, reset)
            try {
                const result = await this.query(query, {reset: reset})
                return [true, {affected_rows: result.affectedRows, changed_rows: result.changedRows}]
            } catch (e) {
                utils.format_exception(e)
                return [false]
            }
        }
        
        /**
         * data_format: [{col1: val1}, {col2: val2}]
         */
        update_as_string(table, data, where, reset = true) {
            if (utils.get_data_type(table) === "Object") {
                data = table.data ?? data
                where = table.where ?? where
                reset = table.reset ?? reset
                table = table.table
            }

            if (!utils.is_empty(table)) this.table(table)
            if (!utils.is_empty_array(data)) this.set(data)
            if (!utils.is_empty(where)) this.where(where)
            let update = `UPDATE ${this.query_builder.table} SET`
            let set = utils.is_empty_array(this.query_builder.set) ? [] : this.query_builder.set
            set.forEach((e, i, arr) => {
                let [k, v] = Object.entries(e)[0]
                update += ` ${k} = ${escape(v)}${i !== (arr.length - 1) ? "," : ""}`
            })
            update += utils.is_empty(this.query_builder.where) ? "" : ` ${this.query_builder.where}`
            if (reset) this.reset()
            return update
        }
    // update
    // read
        from(table) {
            this.query_builder.table = table
            return this
        }

        get(table, limit, reset = true) {
            const query = this.get_as_string(table, limit, reset)
            return this.query(query, {reset: reset}) 
        }

        get_as_string(table, limit, reset = true) {
            if (utils.get_data_type(table) === "Object") {
                limit = table.limit ?? limit
                reset = table.reset ?? reset
                table = table.table
            }

            if (!utils.is_empty(table)) this.from(table)
            if (!utils.is_empty(limit)) this.limit(limit)
            const query_builder = this.query_builder
            if (reset) this.reset()
            
            let select = query_builder.select ?? ""
            let from = ` FROM ${query_builder.table ?? ""}`
            let join = utils.is_empty(query_builder.join) ? "" : ` ${query_builder.join}`
            let where = utils.is_empty(query_builder.where) ? "" : ` ${query_builder.where}`
            let group_by = utils.is_empty(query_builder.group_by) ? "" : ` ${query_builder.group_by}`
            let order_by = utils.is_empty(query_builder.order_by) ? "" : ` ${query_builder.order_by}`
            limit = utils.is_empty(query_builder.limit) ? "" : ` ${query_builder.limit}`
            
            let query = `${select}${from}${join}${where}${group_by}${order_by}${limit}`
            return query
        }

        group_by(data) {
            this.query_builder.group_by = utils.is_empty(this.query_builder.group_by)
            ? `GROUP BY ${data}` : `${this.query_builder.group_by}, ${data}`
            return this
        }

        group_close() {
            this.query_builder.where = `${this.query_builder.where} )`
            return this
        }

        group_open() {
            let where = utils.is_empty(this.query_builder.where) ? `WHERE (` : `${this.query_builder.where} (`
            this.query_builder.where = where
            return this
        }

        join(table, condition, type = "") {
            this.query_builder.join = utils.is_empty(this.query_builder.join) 
            ? `${utils.is_empty(type) ? type : `${type.toUpperCase()} `}JOIN ${table} ON ${condition}`
            : `${this.query_builder.join} ${utils.is_empty(type) ? type : `${type.toUpperCase()} `}JOIN ${table} ON ${condition}`
            return this
        }

        limit(limit) {
            if (!Array.isArray(limit)) limit = [limit]
            this.query_builder.limit = `LIMIT ${limit.reverse().join(", ")}`
            return this
        }

        order_by(data) {
            this.query_builder.order_by = utils.is_empty(this.query_builder.order_by)
            ? `ORDER BY ${data}` : `${this.query_builder.order_by}, ${data}`
            return this
        }

        async query(query, params = [], reset = true) {
            if (utils.get_data_type(params) === "Object") {
                reset = params.reset ?? reset
                params = params.params ?? []
            }

            if (reset) this.reset()
            await this._create_connection()
            const result = await new Promise((resolve, reject) => {
                this.con.query(query, params, (err, res, fields) => {
                    if (err) reject(err)
                    resolve(res)
                })
            })
            this.con.end()
            
            return result
        }

        select(fields) {
            this.query_builder.select = `SELECT ${fields}`
            return this
        }

        set(data) {
            this.query_builder.set = data
            return this
        }

        table(table) {
            return this.from(table)
        }
    // read
    // utilities
        adjust_auto_increment(table) {
            return this.query(`ALTER TABLE ${table} AUTO_INCREMENT = 0`)
        }

        escape(data) {
            data = mysql.escape(data)
            if (data[0] === "'") {
                data = data.substr(1, data.length - 2)
            }
            return data
        }

        async get_last_insert_id() {
            const result = await this.query("SELECT LAST_INSERT_ID() AS last_insert_id") 
            return result[0].last_insert_id
        }

        reset() {
            this.query_builder = {select: "SELECT *"}
        }

        trans_start() {
            this.con.beginTransaction()
        }
        
        trans_commit() {
            this.con.commit()
        }
        
        trans_rollback(tables = []) {
            if (!Array.isArray(tables)) tables = [tables]

            this.con.rollback()
            tables.forEach((e) => {
                this.adjust_auto_increment(e)
            })
        }
    // utilities
    // where
        _where(data, parentheses = false, type = "AND") {
            if ((Array.isArray(data) && utils.is_empty_array(data)) || utils.is_empty(data)) return

            if (utils.get_data_type(parentheses) === "Object") {
                type = parentheses.type ?? type
                parentheses = parentheses.parentheses ?? false
            }

            let where = this.query_builder.where
            let has_open_parentheses = where?.substr(-1, 1) === "("
            if (has_open_parentheses) where = where.substr(0, where.length - 1).trim()
            where = utils.is_empty(where) ? `WHERE` 
                : `${where} ${type}${has_open_parentheses ? ` (` : ""}${parentheses ? " (" : ""}`
            const data_type = utils.get_data_type(data)
            if (data_type === "String") where += ` ${data}`
            else {
                let where_ = []
                data.forEach(e => {
                    let [k, v] = Object.entries(e)[0]
                    where_.push(`${k}${/^[\w\.]+[\s]+([\=]|(\<\=?)|(\>\=?)|like|(\!\=)|(\<\>))$/i.test(k) ? "" : " ="} '${escape(v)}'`)
                })
                where += ` ${where_.join(` ${type} `)}`
            }
            this.query_builder.where = `${where}${parentheses ? " )" : ""}`
        }

        or_where(data, parentheses = false) {
            this._where(data, parentheses, "OR")
            return this
        }

        where(data, parentheses = false) {
            this._where(data, parentheses)
            return this
        }
    // where
}
