"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runtime = void 0;
exports.POST = POST;
const server_1 = require("next/server");
const api_handlers_1 = require("../../../lib/api-handlers");
exports.runtime = "nodejs";
async function POST(request) {
    const result = await (0, api_handlers_1.handleTemplates)(request);
    return server_1.NextResponse.json(result.body, {
        status: result.status,
        headers: result.headers,
    });
}
