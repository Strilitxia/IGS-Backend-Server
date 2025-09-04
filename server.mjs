import "dotenv/config";
import express from "express";
import cors from "cors";
import { GoogleGenerativeAI } from "@google/generative-ai";

const app = express();
const port = process.env.PORT || 5174;

// ✅ Middleware
app.use(cors({ origin: "igsofficial25.com" })); // You can restrict later to your domain
app.use(express.json());

// ✅ Check API Key
if (!process.env.GEMINI_API_KEY) {
  console.error("❌ Missing GEMINI_API_KEY in .env file");
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// 🎯 IGFS System Prompt
const IGFS_SYSTEM_PROMPT = `You are the official business representative of IGFS (International Guide for Students).

🎯 Main Objective: Your ultimate goal is to convince users to book a consultancy session.
Always redirect them to the booking page: 👉 https://igsofficial25.com/#/contact.

📌 Rules:
- Talk ONLY about IGFS
- Share details about services, destinations, process, scholarships, fees, etc.
- If asked about unrelated topics, politely decline and bring focus back to IGFS
- Inform First, Persuade Later - explain IGFS services fully, answer questions, build trust
- After giving information, encourage them to book a consultancy for personalized guidance
- Always include the consultancy booking link when suggesting the next step
- Professional & Supportive Tone - be clear, warm, and persuasive

📌 Business Information:
Business Name: IGFS (International Guide for Students)

Our Services - End-to-end support for study abroad including:
• University Shortlisting → Personalized university matching, course selection advice, profile evaluation
• Application Assistance → SOP/LOR support, document preparation, deadline management
• Visa Guidance → Full documentation support, financial guidance, mock interviews
• Pre-Departure Support → Accommodation, travel, cultural briefings

Destinations We Offer: USA, South Korea, Italy

Work Process:
1. Discovery & Counseling – Profile analysis, psychometric tests, career brainstorming, goal setting
2. University & Course Shortlisting – Tailored list of 5–8 universities balancing dream + practical choices
3. Application & Admission – SOP/LOR guidance, application management, tracking, follow-ups
4. Visa, Finance & Pre-Departure – Visa process, education loans, scholarships, cultural prep

Scholarships & Loans: Yes, IGFS provides scholarship guidance and connects students with financial institutions for education loans.

Counseling Fees: Transparent packages with free initial consultation.

Support for Average Profiles: Yes, IGFS specializes in finding the best-fit universities for all backgrounds.

📌 Contact Information:
Email: intguideforstudents@gmail.com
Phone: +88 (01835-152037)
Address: Amtola, 60 Feet, Mirpur-1216
Office Hours: Mon–Fri: 9:00 AM – 6:00 PM, Sat: 10:00 AM – 2:00 PM

📌 Final Reminder:
- If asked something outside this business scope → Refuse politely and redirect
- Always lead the client towards booking a consultancy as the next step
- End conversations with a call to action: "Would you like me to help you schedule your consultancy session now?"`;

// Store conversation context per session (in production, use Redis or similar)
const conversations = new Map();

// ✅ Health check
app.get("/", (req, res) => {
  res.send({ status: "ok", service: "IGFS AI Chat API" });
});

// ✅ Chat endpoint
app.post("/api/chat", async (req, res) => {
  const { message, sessionId = 'default' } = req.body;

  if (!message || typeof message !== "string") {
    return res
      .status(400)
      .json({ error: "Invalid request", details: "Message is required" });
  }

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    // Get or create conversation history
    let conversation = conversations.get(sessionId);
    if (!conversation) {
      conversation = [];
      conversations.set(sessionId, conversation);
    }

    // For the first message, include the system prompt
    let fullMessage = message;
    if (conversation.length === 0) {
      fullMessage = `${IGFS_SYSTEM_PROMPT}\n\nUser: ${message}`;
    }

    // Add user message to conversation history
    conversation.push({ role: 'user', parts: [{ text: message }] });

    const chat = model.startChat({
      history: conversation.slice(0, -1), // Don't include the current message in history
      generationConfig: {
        maxOutputTokens: 1000,
        temperature: 0.7,
      },
    });

    const result = await chat.sendMessage(fullMessage);
    const reply = result.response?.text() || "I'm sorry, I don't have a response right now.";

    // Add bot response to conversation history
    conversation.push({ role: 'model', parts: [{ text: reply }] });

    // Limit conversation history to last 20 messages to prevent token limit issues
    if (conversation.length > 20) {
      conversations.set(sessionId, conversation.slice(-20));
    }

    res.json({ reply });
  } catch (err) {
    console.error("❌ Gemini API error:", err);

    let details = "Unknown error";
    if (err instanceof Error) details = err.message;

    res.status(500).json({
      error: "AI service temporarily unavailable",
      details,
      fallback: "For immediate assistance, please contact IGFS directly at +88 (01835-152037) or visit https://igsintl25.com/contact"
    });
  }
});

// ✅ Clear conversation endpoint (optional)
app.post("/api/clear-chat", (req, res) => {
  const { sessionId = 'default' } = req.body;
  conversations.delete(sessionId);
  res.json({ message: "Conversation cleared" });
});

// ✅ Start server
app.listen(port, () => {
  console.log(`✅ IGFS AI Chat API running at http://localhost:${port}`);
  console.log(`🔑 Gemini key loaded: ${process.env.GEMINI_API_KEY.slice(0, 6)}...`);
});