import dotenv from "dotenv"
import express from "express"
import * as utils from "../helpers/utils.js"
dotenv.config()
const app = express()

app.use("/brosur", express.static(process.env.PDF_PATH))

app.get("/", (req, res) => {
    res.json("Welcome to lestari api server")
})

app.get("/api", (req, res, next) => {
    const token = utils.sanitize(req.headers.authorization ?? req.query.token)
    const API_TOKEN = process.env.API_TOKEN
    if (!utils.is_empty(API_TOKEN) && token !== API_TOKEN) return res.status(401).json({message: "Not Authorized"})
    next()
}, async (req, res) => {
    try {
        const mod = await import(`../models/${req.query.mod}.js`)
        const type = req.query.type
        const result = await mod.read(type, utils.sanitize_json(req.query))
        if (!result[0]) res.status(400)
        res.json(result[1])
    } catch (e) {
        utils.format_exception(e)
        res.status(500).json({message: "Koneksi ke server sedang down"})
    }
})

export default app
