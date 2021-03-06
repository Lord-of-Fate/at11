import cheerio from "cheerio";
import { Moment } from "moment-timezone";

import { IMenuItem } from "./IMenuItem";
import "./parserUtil";

export abstract class Zomato {
    protected parseBase(html: string, date: Moment): IMenuItem[] {
        const $ = cheerio.load(html);
        const dayMenu = new Array<IMenuItem>();

        $("#daily-menu-container").find(".tmi-group").each(function() {
            const $this = $(this);

            const dayText = $this.children(".tmi-group-name").text();
            const day = getDay(dayText);

            if (day === date.format("dddd")) {
                $this.children(".tmi-daily").each(function() {
                    let text = $(this).find(".tmi-name").text().trim();
                    let price = parseFloat($(this).find(".tmi-price").text().replace(/,/, "."));
                    if (isNaN(price)) {// price probably directly in text, extract it
                        text = text.replace(/\d[.,]\d{2}$/, (match) => {
                            price = parseFloat(match.replace(",", "."));
                            return "";
                        });
                    }

                    if (!/^\d\s?[.,]/.test(text)) { // soups dont have numbering
                        text.split("/").forEach((item) => {
                            dayMenu.push({ isSoup: true, text: item.trim(), price });
                        });
                    } else {
                        dayMenu.push({ isSoup: false, text: normalize(text), price });
                    }
                });
                return false;
            }
        });

        return dayMenu;

        function getDay(text: string): string {
            const found = text.trim().match(/^(.+),/);
            if (!found || found.length < 1) {
                return null;
            }
            return found[1].toLowerCase();
        }

        function normalize(str: string) {
            return str.removeItemNumbering()
                .removeMetrics()
                .replace(/A\s(\d\s?[.,]?\s?)+$/, "")
                .correctCommaSpacing()
                .normalizeWhitespace();
        }
    }
}
