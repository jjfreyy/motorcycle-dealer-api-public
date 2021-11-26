import striptags from "striptags"
import crypto from "crypto"
import dateformat from "dateformat"
import * as db from "./db.js"

export function base_url(val = "") {
    return `http://localhost:3000/${val}`
}

export function coalesce(value, type = "string", assign = null, allow_zero = true) {
    if (get_data_type(type) === "Object") {
        assign = type.assign ?? assign
        allow_zero = type.allow_zero ?? allow_zero
        type = type.type ?? "string"
    }

    if (!Array.isArray(value)) value = [value]
    for (const val of value) {
        if (is_empty(val, allow_zero)) continue
        switch (type) {
            case "string": return val
            case "date": return format_date(val)
            case "number": return convert_number_tocurrency(val)
        }
    }
    return assign
}

export function convert_currency_tonumber(currency) {
    currency = currency.replace(/[.]/g, "")
    currency = currency.replace(",", ".")
    return currency[currency.length - 1] === "." ? currency : Math.round((parseFloat(currency) + Number.EPSILON) * 100) / 100 + ""
}
  
export function convert_number_tocurrency(number, convert_tonumber = false) {
    if (is_empty(number) || number === "-") {
      return number
    }
  
    if (convert_tonumber) number = convert_currency_tonumber(number)
    const is_minus = number < 0;
    if (is_minus) number = number.replace(/[\-]/, "")
    
    const number_arr = number.toString().split(".")
    const remainder = number_arr[0].length % 3
    let currency = number_arr[0].substr(0, remainder)
    const thousand = number_arr[0].substr(remainder).match(/\d{3}/gi)
    if (thousand !== null && thousand.length > 0) {
      separator = remainder > 0 ? "." : ""
      currency += separator + thousand.join('.')
    }
  
    if (number_arr[1] === "") { 
      currency += ","
    } else if (!is_nan(number_arr[1]) && number_arr[1] > 0) {
      currency += "," +number_arr[1].substr(0, 2)
    }
    
    currency = is_minus ? "-" + currency : currency
  
    return currency
}

export function ctrim(val) {
    return val.replace(/[\s]+/g, " ").trim()
}

export function deep_copy(data) {
    return JSON.parse(JSON.stringify(data))
}

export function format_exception(e) {
    console.log(e)
}

export function generate_random_hex(length = 128) {
    return crypto.randomBytes(length / 2).toString("hex")
}

export function generate_random_token(length = 8) {
    const digits = "0123456789"
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"
    let token = ""
    for (let i = 0; i < length; i++) {
      if (Math.random() < .4) token += digits[Math.floor(Math.random() * digits.length)]
      else token += chars[Math.floor(Math.random() * chars.length)]
    }
    return token
}

export function get_autocomplete_limit() {
    return 10
}

export function format_date(date = undefined, format = "dd-mm-yyyy") {
    if (get_data_type(date) === "Object") {
        format = date.format ?? format
        date = date.date
    }

    try {
        return dateformat(
            is_empty(date) ? new Date() : new Date(date),
            format
        )
    } catch (e) {
        return "-"
    }
}

export function get_data_type(val) {
    return Object.prototype.toString.call(val).replace(/[\[\]]/g, "").split(" ")[1]
}

export function if_empty_then({value, type = "string", assign = "-", allow_zero = true}) {
    if (is_empty(value, allow_zero)) return assign
    switch (type) {
      case "string": default: return value
      case "date": return format_date(value)
      case "number": return convert_number_tocurrency(value)
    }
}

export function is_empty(value, allow_zero = true) {
    if (value === null || value === undefined || value === "") return true
    if (!allow_zero && [0, "0"].includes(value)) return true 
    return false;
}
  
export function is_empty_array(arr) {
    if (arr === undefined || arr === null || !Array.isArray(arr) || arr.length === 0) return true
    return false
}

export function is_nan(number) {
    return number === "" || isNaN(number);
}  

export function sanitize(val) {
    if (is_nan(val)) return db.escape(ctrim(striptags(val)))
    return val
}

export function sanitize_json(json) {
    const newJson = {}
    for (let [k, v] of Object.entries(json)) {
        newJson[k] = sanitize(v)
    }
    return newJson
}
