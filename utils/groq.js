const { MENTOR_SYSTEM_PROMPT } = require("./aiMentorPrompt");

const parseJsonContent = (text) => {
  if (!text || typeof text !== "string") {
    throw new Error("Empty model response");
  }
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = (fenced ? fenced[1] : text).trim();
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1) {
    throw new Error("Model did not return JSON");
  }
  return JSON.parse(raw.slice(start, end + 1));
};

const extractContent = (data) => {
  const message = data?.choices?.[0]?.message;
  if (!message) return "";
  if (typeof message.content === "string" && message.content.trim()) {
    return message.content;
  }
  if (Array.isArray(message.content)) {
    return message.content
      .map((part) => (typeof part === "string" ? part : part?.text || ""))
      .join("")
      .trim();
  }
  return "";
};

const chatCompletion = async ({
  messages,
  json = false,
  temperature = 0.4,
}) => {
  const apiKey = process.env.GROQ_API_KEY;
  const primaryModel = process.env.GROQ_MODEL || "openai/gpt-oss-120b";
  const fallbackModel = process.env.GROQ_FALLBACK_MODEL || "openai/gpt-oss-20b";
  const baseUrl = (
    process.env.GROQ_BASE_URL || "https://api.groq.com/openai/v1"
  ).replace(/\/$/, "");

  if (!apiKey) {
    const error = new Error("GROQ_API_KEY is not configured");
    error.status = 503;
    throw error;
  }

  const requestOnce = async (model, useJsonFormat) => {
    const body = {
      model,
      messages,
      temperature,
      max_tokens: json ? 900 : 700,
    };

    if (useJsonFormat) {
      body.response_format = { type: "json_object" };
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 55000);

    let res;
    try {
      res = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (error) {
      if (error?.name === "AbortError") {
        const timeoutError = new Error("Mentor timed out. Try again.");
        timeoutError.status = 504;
        throw timeoutError;
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }

    const data = await res.json().catch(() => null);
    return { res, data, model };
  };

  let { res, data, model } = await requestOnce(primaryModel, json);
  const formatUnsupported =
    json &&
    !res.ok &&
    /response_format|json_object|json mode/i.test(
      data?.error?.message || data?.message || "",
    );

  if (formatUnsupported) {
    ({ res, data, model } = await requestOnce(primaryModel, false));
  }

  const needsFallback =
    !res.ok &&
    fallbackModel &&
    fallbackModel !== primaryModel &&
    (res.status === 404 ||
      res.status === 400 ||
      /does not exist|not have access|deprecat/i.test(
        data?.error?.message || data?.message || "",
      ));

  if (needsFallback) {
    ({ res, data, model } = await requestOnce(fallbackModel, json));
  }

  if (!res.ok) {
    const message =
      data?.error?.message ||
      data?.message ||
      `Groq request failed (${res.status})`;
    const error = new Error(message);
    error.status = res.status >= 500 ? 502 : 400;
    throw error;
  }

  const content = extractContent(data);
  if (!content) {
    throw new Error("Groq returned no content");
  }

  return { content, model: data.model || model, raw: data };
};

const mentorMessages = (history, userPayload) => {
  const safeHistory = (Array.isArray(history) ? history : [])
    .filter(
      (item) =>
        item &&
        (item.role === "user" || item.role === "assistant") &&
        typeof item.content === "string" &&
        item.content.trim(),
    )
    .slice(-16)
    .map((item) => ({
      role: item.role,
      content: item.content.trim().slice(0, 4000),
    }));

  return [
    { role: "system", content: MENTOR_SYSTEM_PROMPT },
    ...safeHistory,
    { role: "user", content: userPayload },
  ];
};

module.exports = {
  chatCompletion,
  parseJsonContent,
  mentorMessages,
};
