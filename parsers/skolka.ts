import cheerio from "cheerio";
import { Moment } from "moment-timezone";
import request from "request";

import { IMenuItem } from "./IMenuItem";
import { IParser } from "./IParser";
import "./parserUtil";
import { getDateRegex, parsePrice } from "./parserUtil";

export class Skolka implements IParser {
    public parse(html: string, date: Moment, doneCallback: (menu: IMenuItem[]) => void): void {
        const $ = cheerio.load(html);

        const dateReg = getDateRegex(date);
        const todayNameReg = new RegExp("^\\s*" + date.format("dddd"), "i");

        const pic = $(".entry-content img");
        const link = $(".entry-content a").filter(function() {
            return $(this).text() !== "" && !/<a/.test($(this).html());
        });

        if (pic.length === 0 && link.length > 0) {
            const pdfUrl = link.attr("href");
            callOcr(pdfUrl, "pdf");
        } else if (pic.parent().filter("a").length > 0) {
            const picHref = pic.parent().attr("href");
            callOcr(picHref, "url");
        } else if (pic.attr("src") !== undefined) {
            const picSrc = pic.attr("src");
            callOcr(picSrc, "encoded");
        } else {
            parseMenu($("div.entry-content", "#post-2").text());
        }

        function callOcr(picData, actionMetod) {
            request.post({
                headers: { "Content-type": "application/x-www-form-urlencoded" },
                url: "http://at11ocr.azurewebsites.net/api/process/" + actionMetod,
                body: "=" + encodeURIComponent(picData)
            }, (error, response, body) => {
                if (!error) {
                    parseMenu(body);
                }
                doneCallback([]);
            });
        }

        function parseMenu(menuString: string) {
            const lines = menuString.split("\n").filter((val) => val.trim());

            const texts: string[] = [];
            let price;
            for (let i = 0; i < lines.length; i++) {
                if (todayNameReg.test(lines[i])) {
                    for (let offset = 0; offset < 3; offset++) {
                        let txt = lines[i + offset];
                        if (offset === 0) {
                            txt = txt.replace(todayNameReg, "");
                        }
                        if (offset === 1) {
                            txt = txt.replace(dateReg, "");
                        }
                        txt = normalize(txt);
                        if (txt) {
                            texts.push(txt);
                        }
                    }
                }
                if (/Hodnota/.test(lines[i])) {
                    price = parsePrice(lines[i]).price;
                } else {
                    price = price || NaN;
                }
            }

            const dayMenu: IMenuItem[] = texts.map((text, index) => {
                return { isSoup: /polievka/i.test(text), text, price: index === 0 ? NaN : price };
            });
            doneCallback(dayMenu);
        }

        function normalize(str: string): string {
            return str.tidyAfterOCR()
                    .removeItemNumbering()
                    .removeMetrics()
                    .normalizeWhitespace()
                    .correctCommaSpacing();
        }
    }
}
