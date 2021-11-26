import dotenv from "dotenv"
import app from "./config/routes.js"
dotenv.config()

app.listen(process.env.PORT, () => {
    console.log(`Running lestari api server on port ${process.env.PORT}`)
})
