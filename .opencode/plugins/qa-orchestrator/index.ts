import { Plugin } from "@opencode/plugin"
import { spawn } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import { mkdtemp, readFile, rm } from "node:fs/promises"
import { homedir, tmpdir } from "node:os"
import { join } from "node:path"

/**
 * qa-orchestrator
 *
 * Adds tools for a Playwright QA workflow:
 *   - qa_pick_model       : resolve a model by cost tier / find cheapest capable model
 *   - qa_parallel_agents  : launch several subagents in parallel and collect results
 *   - qa_parallel_control : list / message / interrupt running subagents
 *   - qa_run_tests        : run Playwright and return structured results
 *
 * Models are configurable through environment variables so the plugin stays
 * portable: QA_CHEAP_MODEL, QA_STANDARD_MODEL, QA_DEEP_MODEL, QA_PROVIDER.
 */

const PROVIDER = process.env.QA_PROVIDER || "openrouter"

// Built-in defaults. Precedence: defaults < .opencode/qa-routing.json < env vars.
const ROUTING_DEFAULTS = {
  router: "jev", // jev | llm | off
  routerModel: "openrouter/deepseek/deepseek-v4-flash-0731",
  typesafeModel: "jev-latest",
  typesafeEndpoint: "https://api.typesafe.ai/v1/systemone",
  instructions: "Which cost tier should handle this software/QA task",
  criteria: {
    cheap:
      "Mechanical, repetitive, small or well-specified edits, formatting, test data, renames, writing a straightforward test or spec",
    standard: "Normal engineering work: writing or fixing tests, triaging a failure, code review, small refactors",
    deep: "Hard architecture, subtle or ambiguous debugging, unclear design, decisions with wide blast radius",
  },
  models: {
    cheap: "openrouter/deepseek/deepseek-v4.1-flash",
    standard: "openrouter/deepseek/deepseek-v4-pro-0813",
    deep: "openrouter/qwen/qwen3.8-max-0902",
  },
}

let ROUTER = ROUTING_DEFAULTS.router
let ROUTER_MODEL = ROUTING_DEFAULTS.routerModel
let TYPESAFE_MODEL = ROUTING_DEFAULTS.typesafeModel
let TYPESAFE_ENDPOINT = ROUTING_DEFAULTS.typesafeEndpoint
let TIER_INSTRUCTIONS = ROUTING_DEFAULTS.instructions
let TIER_CRITERIA = { ...ROUTING_DEFAULTS.criteria }
let TIERS = { ...ROUTING_DEFAULTS.models }
const ROUTING_DEFAULT = process.env.QA_ROUTING || "auto" // "auto" | "off"

/**
 * Load .opencode/qa-routing.json (or $QA_ROUTING_FILE), then apply env overrides.
 * Returns the config file path when one was found.
 *
 * Shape:
 * {
 *   "router": "jev" | "llm" | "off",
 *   "routerModel": "openrouter/deepseek/deepseek-v4-flash-0731",
 *   "typesafeModel": "jev-latest",
 *   "typesafeEndpoint": "https://api.typesafe.ai/v1/systemone",
 *   "instructions": "Which cost tier should handle this software/QA task",
 *   "criteria": { "cheap": "...", "standard": "...", "deep": "..." },
 *   "models":   { "cheap": "...", "standard": "...", "deep": "..." }
 * }
 */
const loadRoutingConfig = (directory) => {
  let source = null
  const files = [process.env.QA_ROUTING_FILE, join(directory, ".opencode", "qa-routing.json")].filter(Boolean)
  for (const file of files) {
    try {
      if (!existsSync(file)) continue
      const parsed = JSON.parse(readFileSync(file, "utf8"))
      if (parsed.router) ROUTER = String(parsed.router).toLowerCase()
      if (parsed.routerModel) ROUTER_MODEL = parsed.routerModel
      if (parsed.typesafeModel) TYPESAFE_MODEL = parsed.typesafeModel
      if (parsed.typesafeEndpoint) TYPESAFE_ENDPOINT = parsed.typesafeEndpoint
      if (parsed.instructions) TIER_INSTRUCTIONS = parsed.instructions
      if (parsed.criteria && typeof parsed.criteria === "object") TIER_CRITERIA = { ...TIER_CRITERIA, ...parsed.criteria }
      if (parsed.models && typeof parsed.models === "object") TIERS = { ...TIERS, ...parsed.models }
      source = file
      break
    } catch {
      /* ignore a missing or malformed routing file */
    }
  }
  // Environment variables win over the file.
  if (process.env.QA_ROUTER) ROUTER = process.env.QA_ROUTER.toLowerCase()
  if (process.env.QA_ROUTER_MODEL) ROUTER_MODEL = process.env.QA_ROUTER_MODEL
  if (process.env.TYPESAFE_MODEL) TYPESAFE_MODEL = process.env.TYPESAFE_MODEL
  if (process.env.TYPESAFE_ENDPOINT) TYPESAFE_ENDPOINT = process.env.TYPESAFE_ENDPOINT
  if (process.env.QA_CHEAP_MODEL) TIERS = { ...TIERS, cheap: process.env.QA_CHEAP_MODEL }
  if (process.env.QA_STANDARD_MODEL) TIERS = { ...TIERS, standard: process.env.QA_STANDARD_MODEL }
  if (process.env.QA_DEEP_MODEL) TIERS = { ...TIERS, deep: process.env.QA_DEEP_MODEL }
  return source
}

// The Jev key comes from TYPESAFE_API_KEY, or from a key file (default
// ~/.config/opencode/typesafe.key, override with TYPESAFE_API_KEY_FILE).
const TYPESAFE_KEY_FILE =
  process.env.TYPESAFE_API_KEY_FILE || join(homedir(), ".config", "opencode", "typesafe.key")

const readTypesafeKey = () => {
  if (process.env.TYPESAFE_API_KEY) return process.env.TYPESAFE_API_KEY
  try {
    if (existsSync(TYPESAFE_KEY_FILE)) return readFileSync(TYPESAFE_KEY_FILE, "utf8").trim() || undefined
  } catch {
    /* ignore unreadable key file */
  }
  return undefined
}

const asList = (value) => {
  if (Array.isArray(value)) return value
  if (!value || typeof value !== "object") return []
  if (Array.isArray(value.data)) return value.data
  if (Array.isArray(value.models)) return value.models
  if (Array.isArray(value.items)) return value.items
  return []
}

const splitModel = (ref) => {
  const [providerID, ...rest] = String(ref).split("/")
  const [id, variant] = rest.join("/").split("#")
  return variant ? { providerID, id, variant } : { providerID, id }
}

const refToString = (ref) => (ref ? `${ref.providerID}/${ref.id}${ref.variant ? `#${ref.variant}` : ""}` : undefined)

const modelCost = (model) => {
  const costs = Array.isArray(model && model.cost) ? model.cost : []
  const values = costs.map((entry) => Number(entry && entry.output)).filter((n) => Number.isFinite(n))
  return values.length ? Math.min(...values) : Number.POSITIVE_INFINITY
}

const isUsable = (model) =>
  !!model && model.enabled !== false && model.status !== "deprecated" && !!(model.capabilities && model.capabilities.tools)

const truncate = (text, max = 4000) => {
  const value = String(text == null ? "" : text).trim()
  return value.length > max ? `${value.slice(0, max)}\n…[truncated ${value.length - max} chars]` : value
}

// Rolling log of routing decisions, exposed by the qa_routing_log tool and, when
// QA_DEBUG=1, printed to the server log.
const ROUTING_LOG = []
const ROUTING_LOG_MAX = 200
const OPENCODE_LOG = join(homedir(), ".local", "share", "opencode", "log", "opencode.log")

const recordRouting = (entry) => {
  ROUTING_LOG.push(entry)
  if (ROUTING_LOG.length > ROUTING_LOG_MAX) ROUTING_LOG.splice(0, ROUTING_LOG.length - ROUTING_LOG_MAX)
  if (process.env.QA_DEBUG === "1" || process.env.QA_DEBUG === "true") {
    try {
      console.error("[qa-orchestrator] " + JSON.stringify(entry))
    } catch {
      /* ignore logging errors */
    }
  }
}

const withTimeout = (promise, ms, label) =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label || "operation"} timed out after ${ms}ms`)), ms)
    Promise.resolve(promise).then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (error) => {
        clearTimeout(timer)
        reject(error)
      },
    )
  })

const runProcess = (command, args, options = {}) =>
  new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: { ...process.env, ...(options.env || {}) },
      timeout: options.timeout,
      killSignal: "SIGKILL",
    })
    let stdout = ""
    let stderr = ""
    if (child.stdout) child.stdout.on("data", (chunk) => (stdout += chunk.toString()))
    if (child.stderr) child.stderr.on("data", (chunk) => (stderr += chunk.toString()))
    child.on("error", (error) => resolve({ code: -1, stdout, stderr: `${stderr}\n${String(error)}` }))
    child.on("close", (code) => resolve({ code: code == null ? -1 : code, stdout, stderr }))
  })

const summarizePlaywright = (report) => {
  const stats = (report && report.stats) || {}
  const failures = []
  const visit = (suites) => {
    for (const suite of suites || []) {
      for (const spec of suite.specs || []) {
        const tests = spec.tests || []
        const unexpected = tests.some((t) => t.status === "unexpected") || spec.ok === false
        if (!unexpected) continue
        const firstError = tests
          .flatMap((t) => t.results || [])
          .flatMap((r) => r.errors || [])
          .map((e) => e.message || e.value || "")
          .find(Boolean)
        failures.push({
          title: spec.title,
          file: spec.file || suite.file,
          error: truncate(String(firstError || "unknown error").split("\n").slice(0, 6).join("\n"), 600),
        })
      }
      if (suite.suites) visit(suite.suites)
    }
  }
  visit(report && report.suites)
  return {
    status: (stats.unexpected || 0) > 0 ? "failed" : "passed",
    counts: {
      total: stats.expected || 0,
      passed: (stats.expected || 0) - (stats.flaky || 0),
      failed: stats.unexpected || 0,
      flaky: stats.flaky || 0,
      skipped: stats.skipped || 0,
    },
    durationMs: stats.duration || 0,
    failures: failures.slice(0, 20),
  }
}

export default Plugin.define({
  id: "qa-orchestrator",

  async setup(ctx) {
    const rootDir = () => (ctx.location && ctx.location.directory) || process.cwd()
    const routingConfigFile = loadRoutingConfig(rootDir())

    // Live routing notice. Always writes a one-line entry to the server log
    // ("rodando com <modelo>"). Optionally also posts a system message in the
    // session with QA_ANNOUNCE=1, but note the model then answers it (extra
    // turn), so it is off by default.
    const announceSetting = (process.env.QA_ANNOUNCE || "0").toLowerCase()
    const announceInSession = announceSetting === "1" || announceSetting === "true"
    const lastAnnounced = new Map()
    const notifyRoute = async (sessionID, model) => {
      if (!model) return
      const now = Date.now()
      const previous = lastAnnounced.get(sessionID)
      if (previous && previous.model === model && now - previous.at < 8000) return
      lastAnnounced.set(sessionID, { model, at: now })
      try {
        console.error(`[qa] rodando com ${model}`)
      } catch {
        /* ignore logging errors */
      }
      if (announceInSession && sessionID) {
        try {
          await ctx.session.synthetic({ sessionID, text: `ⓘ rodando com ${model}` })
        } catch {
          /* notices are best-effort */
        }
      }
    }

    const listUsable = async () => {
      let models = []
      try {
        models = asList(await ctx.model.list())
      } catch {
        models = []
      }
      return models.filter(isUsable)
    }

    const cheapest = async (options = {}) => {
      const models = await listUsable()
      const pool = models
        .filter((m) => options.allowFree === true || modelCost(m) > 0)
        .filter((m) => options.anyProvider === true || !PROVIDER || m.providerID === PROVIDER)
        .sort((a, b) => modelCost(a) - modelCost(b))
      const chosen = pool[0] || models.sort((a, b) => modelCost(a) - modelCost(b))[0]
      return chosen ? { providerID: chosen.providerID, id: chosen.id } : undefined
    }

    const isTier = (value) => value === "cheap" || value === "standard" || value === "deep"

    // Jev (TypeSafe System One): one Choice question picks the tier, returning a
    // calibrated choice plus confidence.
    const classifyTierViaJev = async (text) => {
      const key = readTypesafeKey()
      if (!key) return null
      const body = {
        state: text,
        model: TYPESAFE_MODEL,
        questions: {
          tier: { type: "choice", instructions: TIER_INSTRUCTIONS, criteria: TIER_CRITERIA },
        },
      }
      try {
        const response = await fetch(TYPESAFE_ENDPOINT, {
          method: "POST",
          headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })
        if (!response.ok) return null
        const json = await response.json()
        const answer = json && json.answers && json.answers.tier
        if (answer && isTier(answer.choice)) {
          const confidence =
            typeof answer.confidence === "number" ? ` ${Math.round(answer.confidence * 100)}%` : ""
          return { tier: answer.choice, via: "jev", reason: `jev choice${confidence}: ${TIER_CRITERIA[answer.choice]}` }
        }
      } catch {
        /* fall through to the LLM router */
      }
      return null
    }

    // Fallback: ask a very cheap OpenRouter model for the tier.
    const classifyTierViaLlm = async (text) => {
      const prompt = [
        "You route software/QA tasks to a cost tier. Reply with JSON only.",
        "",
        "Tiers:",
        `- cheap: ${TIER_CRITERIA.cheap}.`,
        `- standard: ${TIER_CRITERIA.standard}.`,
        `- deep: ${TIER_CRITERIA.deep}.`,
        "",
        'Respond exactly like {"tier":"cheap|standard|deep","reason":"<=15 words"}',
        "",
        "Task:",
        text,
      ].join("\n")
      try {
        const output = await ctx.generate.text({ model: splitModel(ROUTER_MODEL), prompt })
        const raw = typeof output === "string" ? output : (output && output.text) || ""
        const match = raw.match(/\{[\s\S]*?\}/)
        const parsed = match ? JSON.parse(match[0]) : null
        const tier = parsed && parsed.tier
        if (isTier(tier)) return { tier, via: "llm", reason: `llm: ${String((parsed && parsed.reason) || "").slice(0, 120)}` }
      } catch {
        /* fall through to default */
      }
      return null
    }

    const classifyTier = async (request) => {
      const text = String(request || "").slice(0, 4000)
      let decision
      if (!text.trim()) {
        decision = { tier: "standard", via: "none", reason: "empty request" }
      } else if (ROUTER === "off") {
        decision = { tier: "standard", via: "none", reason: "routing disabled" }
      } else {
        const viaJev = ROUTER === "jev" || ROUTER === "auto" ? await classifyTierViaJev(text) : null
        decision =
          viaJev ||
          (await classifyTierViaLlm(text)) ||
          { tier: "standard", via: "none", reason: "router unavailable; defaulted to standard" }
      }
      recordRouting({
        at: new Date().toISOString(),
        router: ROUTER,
        via: decision.via,
        tier: decision.tier,
        model: TIERS[decision.tier] || TIERS.standard,
        reason: decision.reason,
        request: text.slice(0, 160),
      })
      return decision
    }

    // Decide the model for a task. Precedence:
    //   1. explicit `model`   2. explicit `tier`   3. LLM routing (default)
    //   4. routing disabled -> keep the subagent's own configured model
    const resolveModel = async (task = {}, options = {}) => {
      if (task.model) return { model: splitModel(task.model), tier: task.tier, reason: "explicit model" }

      const routing = task.routing || options.routing || ROUTING_DEFAULT
      let tier = task.tier
      let reason = "explicit tier"

      if (!tier && routing === "off") return { model: undefined, tier: undefined, reason: "agent default" }
      if (!tier) {
        const decision = await classifyTier(task.prompt || task.title || "")
        tier = decision.tier
        reason = `auto: ${decision.reason}`
      }

      if (tier === "cheapest") {
        return { model: (await cheapest(options)) || splitModel(TIERS.cheap), tier, reason }
      }
      return { model: splitModel(TIERS[tier] || TIERS.standard), tier, reason }
    }

    const lastAssistantText = async (sessionID) => {
      let messages = []
      try {
        messages = asList(await ctx.session.context({ sessionID }))
      } catch {
        return ""
      }
      for (let i = messages.length - 1; i >= 0; i--) {
        const message = messages[i]
        if (!message || message.type !== "assistant" || !Array.isArray(message.content)) continue
        const text = message.content
          .filter((part) => part && part.type === "text")
          .map((part) => part.text)
          .join("\n")
          .trim()
        if (text) return text
      }
      return ""
    }

    await ctx.tool.transform((editor) => {
      editor.namespace({
        name: "qa",
        description: "Playwright QA orchestration: model routing, parallel subagents, and test runs",
      })

      // ---------------------------------------------------------------------
      // qa_pick_model
      // ---------------------------------------------------------------------
      editor.add({
        name: "pick_model",
        description:
          "Resolve a model for a cost tier (cheap|standard|deep|cheapest) and list the cheapest capable models available. Use before delegating work to control spend.",
        input: {
          type: "object",
          properties: {
            tier: {
              type: "string",
              enum: ["cheap", "standard", "deep", "cheapest"],
              description: "Cost tier. 'cheapest' resolves dynamically from the live catalog.",
            },
            allowFree: { type: "boolean", description: "Allow $0 models when resolving 'cheapest'." },
            limit: { type: "integer", description: "How many cheapest models to list (default 8)." },
          },
          additionalProperties: false,
        },
        options: { namespace: "qa", codemode: true },
        execute: async (input) => {
          const tier = input.tier || "standard"
          const chosen = tier === "cheapest" ? await cheapest(input) : splitModel(TIERS[tier] || TIERS.standard)
          const models = await listUsable()
          const options = models
            .filter((m) => input.allowFree === true || modelCost(m) > 0)
            .sort((a, b) => modelCost(a) - modelCost(b))
            .slice(0, Number(input.limit) || 8)
            .map((m) => `${m.providerID}/${m.id}  $${modelCost(m)}/M out`)
          return {
            content: JSON.stringify({ tier, chosen: refToString(chosen), cheapestAvailable: options }, null, 2),
          }
        },
      })

      // ---------------------------------------------------------------------
      // qa_routing_log
      // ---------------------------------------------------------------------
      editor.add({
        name: "routing_log",
        description:
          "Show recent model-routing decisions (router, tier, model, reason) and where to watch live logs and the actual jev-router model on OpenRouter.",
        input: {
          type: "object",
          properties: {
            limit: { type: "integer", description: "Max entries, newest first (default 20)." },
            clear: { type: "boolean", description: "Clear the in-memory log after reading." },
          },
          additionalProperties: false,
        },
        options: { namespace: "qa", codemode: true },
        execute: async (input) => {
          const limit = Number(input.limit) || 20
          const entries = ROUTING_LOG.slice(-limit).reverse()
          if (input.clear) ROUTING_LOG.length = 0
          return {
            content: JSON.stringify(
              {
                router: ROUTER,
                configFile: routingConfigFile,
                tiers: TIERS,
                opencodeLog: OPENCODE_LOG,
                watch: `tail -f "${OPENCODE_LOG}"`,
                note: "Plugin tier routing is logged here. For the model jev-router actually picked per request, see OpenRouter -> Activity.",
                entries,
              },
              null,
              2,
            ),
          }
        },
      })

      // ---------------------------------------------------------------------
      // qa_route_request
      // ---------------------------------------------------------------------
      editor.add({
        name: "route_request",
        description:
          "Classify one request into a cost tier and return the model to use. Uses Jev (TypeSafe System One) by default, falling back to a cheap OpenRouter LLM.",
        input: {
          type: "object",
          properties: {
            request: { type: "string", description: "The task/request text to classify." },
            routing: {
              type: "string",
              enum: ["auto", "off"],
              description: "'off' skips the LLM call and returns the standard tier.",
            },
          },
          required: ["request"],
          additionalProperties: false,
        },
        options: { namespace: "qa", codemode: true },
        execute: async (input) => {
          if (input.routing === "off") {
            return {
              content: JSON.stringify(
                { tier: "standard", model: TIERS.standard, reason: "routing disabled" },
                null,
                2,
              ),
            }
          }
          const decision = await classifyTier(input.request)
          return {
            content: JSON.stringify(
              {
                tier: decision.tier,
                model: TIERS[decision.tier] || TIERS.standard,
                reason: decision.reason,
                router: ROUTER,
                configFile: routingConfigFile,
                routerDetail:
                  ROUTER === "llm"
                    ? ROUTER_MODEL
                    : readTypesafeKey()
                      ? TYPESAFE_MODEL
                      : "jev key missing -> llm fallback",
              },
              null,
              2,
            ),
          }
        },
      })

      // ---------------------------------------------------------------------
      // qa_parallel_agents
      // ---------------------------------------------------------------------
      editor.add({
        name: "parallel_agents",
        description:
          "Launch multiple QA subagents in parallel (each in its own child session), wait for them, and return their final reports. Each task's model is auto-routed per request by Jev / a cheap LLM unless you pass an explicit tier or model.",
        input: {
          type: "object",
          properties: {
            tasks: {
              type: "array",
              description: "Independent tasks to run concurrently. Give each a self-contained prompt.",
              items: {
                type: "object",
                properties: {
                  agent: { type: "string", description: "Subagent id, e.g. spec-author, page-object, test-runner." },
                  prompt: { type: "string", description: "Full task instructions (subagents do not see this chat)." },
                  title: { type: "string", description: "Short label for the child session." },
                  tier: { type: "string", enum: ["cheap", "standard", "deep", "cheapest"] },
                  model: { type: "string", description: "Explicit provider/model override; wins over tier." },
                },
                required: ["prompt"],
                additionalProperties: false,
              },
            },
            wait: { type: "boolean", description: "Wait for completion and collect reports (default true)." },
            timeoutMs: { type: "integer", description: "Per-task timeout in ms (default 900000)." },
            routing: {
              type: "string",
              enum: ["auto", "off"],
              description: "Model routing: 'auto' lets a cheap LLM pick the tier per task (default); 'off' uses each subagent's configured model.",
            },
            allowFree: { type: "boolean", description: "Allow $0 models for tier 'cheapest'." },
          },
          required: ["tasks"],
          additionalProperties: false,
        },
        options: { namespace: "qa", codemode: true },
        execute: async (input, context) => {
          const tasks = Array.isArray(input.tasks) ? input.tasks : []
          if (!tasks.length) return { content: "No tasks provided." }
          const timeoutMs = Number(input.timeoutMs) || 900000
          const progress = context && typeof context.progress === "function" ? context.progress : null

          const started = []
          for (let index = 0; index < tasks.length; index++) {
            const task = tasks[index]
            const route = await resolveModel(task, { allowFree: input.allowFree, routing: input.routing })
            const createInput = { title: task.title || `qa:${task.agent || "agent"}:${index + 1}` }
            if (context && context.sessionID) createInput.parentID = context.sessionID
            if (task.agent) createInput.agent = task.agent
            if (route.model) createInput.model = route.model

            const created = await ctx.session.create(createInput)
            const sessionID = (created && (created.id || (created.data && created.data.id))) || undefined
            if (sessionID && task.prompt) await ctx.session.prompt({ sessionID, text: task.prompt })
            started.push({
              index,
              agent: task.agent,
              tier: route.tier,
              model: refToString(route.model),
              routing: route.reason,
              sessionID,
            })
            if (progress) await progress({ status: `started ${task.agent || "agent"} ${index + 1}/${tasks.length}` })
          }

          if (input.wait === false) {
            return { content: JSON.stringify({ launched: started, waited: false }, null, 2) }
          }

          const results = await Promise.all(
            started.map(async (entry) => {
              if (!entry.sessionID) return { ...entry, status: "error", error: "session was not created" }
              try {
                await withTimeout(ctx.session.wait({ sessionID: entry.sessionID }), timeoutMs, `agent ${entry.index + 1}`)
                const summary = await lastAssistantText(entry.sessionID)
                if (progress) await progress({ status: `finished ${entry.agent || "agent"} ${entry.index + 1}/${started.length}` })
                return { ...entry, status: "completed", summary: truncate(summary) }
              } catch (error) {
                try {
                  await ctx.session.interrupt({ sessionID: entry.sessionID, resume: false })
                } catch {
                  /* ignore */
                }
                return { ...entry, status: "timeout", error: String((error && error.message) || error) }
              }
            }),
          )

          return { content: JSON.stringify({ waited: true, results }, null, 2) }
        },
      })

      // ---------------------------------------------------------------------
      // qa_parallel_control
      // ---------------------------------------------------------------------
      editor.add({
        name: "parallel_control",
        description:
          "Control subagents: action 'list' shows recent sessions, 'message' sends follow-up text to a session, 'interrupt' stops a running session.",
        input: {
          type: "object",
          properties: {
            action: { type: "string", enum: ["list", "message", "interrupt"] },
            sessionID: { type: "string", description: "Target session for 'message' or 'interrupt'." },
            text: { type: "string", description: "Follow-up text for 'message'." },
            limit: { type: "integer", description: "Max sessions to list (default 20)." },
          },
          required: ["action"],
          additionalProperties: false,
        },
        options: { namespace: "qa", codemode: true },
        execute: async (input) => {
          if (input.action === "list") {
            let page = []
            try {
              page = await ctx.session.list({ directory: rootDir(), limit: Number(input.limit) || 20 })
            } catch (error) {
              return { content: `Failed to list sessions: ${String((error && error.message) || error)}` }
            }
            const sessions = asList(page).map((s) => ({
              id: s.id,
              title: s.title,
              parentID: s.parentID,
              directory: s.directory,
            }))
            return { content: JSON.stringify({ sessions }, null, 2) }
          }

          if (!input.sessionID) return { content: "sessionID is required for this action." }

          if (input.action === "interrupt") {
            const result = await ctx.session.interrupt({ sessionID: input.sessionID, resume: false })
            return { content: JSON.stringify({ sessionID: input.sessionID, ...result }, null, 2) }
          }

          if (input.action === "message") {
            if (!input.text) return { content: "text is required for action 'message'." }
            await ctx.session.prompt({ sessionID: input.sessionID, text: input.text })
            return { content: `Sent follow-up to ${input.sessionID}.` }
          }

          return { content: `Unknown action: ${input.action}` }
        },
      })

      // ---------------------------------------------------------------------
      // qa_run_tests
      // ---------------------------------------------------------------------
      editor.add({
        name: "run_tests",
        description:
          "Run Playwright tests and return structured results (counts plus failing tests with error snippets). Uses the JSON reporter written to a temp file.",
        input: {
          type: "object",
          properties: {
            grep: { type: "string", description: "Only run tests matching this title pattern (-g)." },
            file: { type: "string", description: "Only run this spec file/folder." },
            project: { type: "string", description: "Playwright project, e.g. chromium." },
            headed: { type: "boolean", description: "Run headed." },
            timeoutMs: { type: "integer", description: "Process timeout in ms (default 900000)." },
          },
          additionalProperties: false,
        },
        options: { namespace: "qa", codemode: true },
        execute: async (input, context) => {
          const progress = context && typeof context.progress === "function" ? context.progress : null
          if (progress) await progress({ status: "running playwright" })
          const dir = await mkdtemp(join(tmpdir(), "qa-pw-"))
          const jsonPath = join(dir, "results.json")
          const testArgs = ["test", "--reporter=json"]
          if (input.grep) testArgs.push("-g", input.grep)
          if (input.file) testArgs.push(input.file)
          if (input.project) testArgs.push("--project", input.project)
          if (input.headed) testArgs.push("--headed")

          // Prefer the locally installed CLI: faster and avoids npx resolution.
          // Note: process.execPath is the OpenCode binary here, not Node, so we
          // invoke `node` from PATH.
          const localCli = join(rootDir(), "node_modules", "@playwright", "test", "cli.js")
          const [command, args] = existsSync(localCli)
            ? ["node", [localCli, ...testArgs]]
            : ["npx", ["--yes", "playwright", ...testArgs]]

          try {
            const result = await runProcess(command, args, {
              cwd: rootDir(),
              env: { PLAYWRIGHT_JSON_OUTPUT_NAME: jsonPath },
              timeout: Number(input.timeoutMs) || 900000,
            })

            let report = null
            try {
              report = JSON.parse(await readFile(jsonPath, "utf8"))
            } catch {
              report = null
            }

            if (!report) {
              return {
                content: JSON.stringify(
                  {
                    status: "unknown",
                    exitCode: result.code,
                    note: "Could not parse the Playwright JSON report.",
                    stdoutTail: truncate(result.stdout.split("\n").slice(-25).join("\n"), 2000),
                    stderrTail: truncate(result.stderr.split("\n").slice(-25).join("\n"), 2000),
                  },
                  null,
                  2,
                ),
              }
            }

            const summary = summarizePlaywright(report)
            summary.exitCode = result.code
            return { content: JSON.stringify(summary, null, 2) }
          } finally {
            await rm(dir, { recursive: true, force: true }).catch(() => {})
          }
        },
      })
    })

    // Optional: capture the model OpenRouter actually used for each request.
    // jev-router picks it internally, so OpenCode only ever sees
    // typesafe/jev-router; this reads the model back from the response stream.
    // Pre-routing: classify each prompt and switch the session model before it
    // runs, so the TUI status line shows the model that will run. On by default;
    // disable with QA_PRE_ROUTE=0.
    const preRouteSetting = (process.env.QA_PRE_ROUTE || "1").toLowerCase()
    if (preRouteSetting !== "0" && preRouteSetting !== "false" && preRouteSetting !== "off") {
      try {
        await ctx.session.hook("prompt", async (event) => {
          const sessionID = event && event.sessionID
          const text = (event && event.prompt && event.prompt.text) || ""
          if (!sessionID || !text) return
          const decision = await classifyTier(text)
          const tier = (decision && decision.tier) || "standard"
          try {
            await ctx.session.switchModel({ sessionID, model: splitModel(TIERS[tier] || TIERS.standard) })
          } catch {
            /* ignore */
          }
        })
      } catch {
        /* hook registration unsupported; ignore */
      }
    }

    // Enabled by default; disable with QA_TRACE_MODEL=0. Best-effort; never
    // blocks a request.
    const traceModel = (process.env.QA_TRACE_MODEL || "1").toLowerCase()
    if (traceModel !== "0" && traceModel !== "false" && traceModel !== "off") {
      try {
        await ctx.session.hook(
          "http.response",
          (event) => {
            try {
              const response = event.response
              const contentType = (response.headers.get("content-type") || "").toLowerCase()
              if (!contentType.includes("event-stream") || !response.body) return
              const [keep, peek] = response.body.tee()
              event.response = new Response(keep, { status: response.status, headers: response.headers })
              void (async () => {
                const reader = peek.getReader()
                const decoder = new TextDecoder()
                let buffer = ""
                try {
                  for (;;) {
                    const { done, value } = await reader.read()
                    if (done) break
                    buffer += decoder.decode(value, { stream: true })
                    const match = buffer.match(/"model"\s*:\s*"([^"]+)"/)
                    if (match) {
                      recordRouting({
                        at: new Date().toISOString(),
                        router: "openrouter",
                        via: "jev-router",
                        tier: "-",
                        model: match[1],
                        reason: `actual model for ${event.kind || "primary"} request`,
                        sessionID: event.sessionID,
                      })
                      void notifyRoute(event.sessionID, match[1])
                      break
                    }
                    if (buffer.length > 65536) break
                  }
                } catch {
                  /* ignore */
                } finally {
                  try {
                    await reader.cancel()
                  } catch {
                    /* ignore */
                  }
                }
              })()
            } catch {
              /* never break the request */
            }
          },
          { providerID: "openrouter" },
        )
      } catch {
        /* hook registration unsupported; ignore */
      }
    }
  },
})
