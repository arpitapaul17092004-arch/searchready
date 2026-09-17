"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.parsePage = parsePage;
const htmlparser2_1 = require("htmlparser2");
const cssSelect = __importStar(require("css-select"));
const domutils = __importStar(require("domutils"));
function parsePage(html) {
    const doc = (0, htmlparser2_1.parseDocument)(html);
    // css-select expects Elements; a Document node itself is not one.
    const roots = doc.children;
    const select = (selector) => cssSelect.selectAll(selector, roots);
    return {
        count(selector) {
            return select(selector).length;
        },
        textOf(selector) {
            const el = select(selector)[0];
            return el
                ? domutils
                    .textContent(el)
                    .replace(/\s+/g, " ")
                    .trim()
                : "";
        },
        allTexts(selector) {
            return select(selector).map((el) => domutils
                .textContent(el)
                .replace(/\s+/g, " ")
                .trim());
        },
        attrOf(selector, name) {
            const el = select(selector)[0];
            return el ? domutils.getAttributeValue(el, name) : undefined;
        },
        bodyText() {
            const body = cssSelect.selectOne("body", roots);
            return body
                ? domutils
                    .textContent(body)
                    .replace(/\s+/g, " ")
                    .trim()
                : "";
        },
        remove(selector) {
            for (const el of select(selector))
                domutils.removeElement(el);
        },
        exists(selector) {
            return select(selector).length > 0;
        },
    };
}
