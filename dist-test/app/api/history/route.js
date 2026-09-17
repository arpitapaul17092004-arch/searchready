"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runtime = void 0;
exports.GET = GET;
exports.POST = POST;
exports.DELETE = DELETE;
const server_1 = require("next/server");
const api_handlers_1 = require("../../../lib/api-handlers");
const server_2 = require("../../../lib/supabase/server");
exports.runtime = "nodejs";
const createClient = () => (0, server_2.createSupabaseServerClient)();
async function GET(request) {
    void request;
    const result = await (0, api_handlers_1.handleHistoryGet)(createClient);
    return server_1.NextResponse.json(result.body, {
        status: result.status,
        headers: result.headers,
    });
}
async function POST(request) {
    const result = await (0, api_handlers_1.handleHistoryPost)(request, createClient);
    return server_1.NextResponse.json(result.body, {
        status: result.status,
        headers: result.headers,
    });
}
async function DELETE(request) {
    const result = await (0, api_handlers_1.handleHistoryDelete)(request, createClient);
    return server_1.NextResponse.json(result.body, {
        status: result.status,
        headers: result.headers,
    });
}
