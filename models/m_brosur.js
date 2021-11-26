import Model from "../libraries/model.js"
import * as utils from "../helpers/utils.js"
const lestari_server = new Model("lestari_server")

export async function read(type, data) {
    switch (type) {
        case "ac_brosur":
            var filter = data.f
            var result = await lestari_server.table("tbl_series").
                select("CONCAT(nmfile, ';', nmbrosur) id, nam dname").
                like([{nam: filter}]).
                limit(utils.get_autocomplete_limit()).
                get()
        return [true, result]
    }
}
