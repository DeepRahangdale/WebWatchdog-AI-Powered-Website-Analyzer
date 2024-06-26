import express from 'express';
import cors from 'cors';
import puppeteer from 'puppeteer';
import MistralClient from '@mistralai/mistralai';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const port = 3001;
const client = new MistralClient(process.env.MISTRAL_API_KEY);

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.send('Proxy server is running');
});

app.get('/proxy', async (req, res) => {
  const url = req.query.url; //route jo url parameter expect krta ho!!
  console.log(`Received request to analyze URL: ${url}`);

  try {
    const text = await fetchWebsiteText(url);
    console.log(`Fetched text from ${url}`);
    const aiAnalysis = await analyzeTextWithAI(text);
    console.log(`AI Analysis completed for ${url}`);
    
    res.json({ text, aiAnalysis }); //to share respone in json formst
  } catch (error) {
    console.error('Error fetching URL or analyzing text:', error.message);
    res.status(500).json({ error: error.message });
  }
});
//for our chatbot
app.post('/chatbot', async (req, res) => {
  const { text, question } = req.body; //expects a POST request with text & question in body!!!
  const prompt = `You are a chatbot that can answer questions based on the following website text:\n\n${text}\n\nQuestion: ${question}\n\nAnswer:`;

  try {
    const chatStreamResponse = await client.chatStream({
      model: 'mistral-large-latest',
      messages: [{ role: 'user', content: prompt }],
    });

    let aiResponse = '';
    for await (const chunk of chatStreamResponse) {
      if (chunk.choices[0].delta.content !== undefined) {
        aiResponse += chunk.choices[0].delta.content;
      }
    }

    res.json({ answer: aiResponse });
  } catch (error) {
    console.error('Mistral API Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

//function to extract the requidered content from the website
async function fetchWebsiteText(url) {
  let browser;
  try {
    browser = await puppeteer.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'domcontentloaded' }); //initial HTML document has been completely loaded

    // Yaha Update karo to extract specific text you need from the page
    const text = await page.evaluate(() => document.body.innerText);

    return text;
  } catch (error) {
    console.error('Error fetching website text:', error.message);
    throw new Error('Error fetching website text');
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

//Function to analyze the text which we extract
async function analyzeTextWithAI(text) {
  const prompt = `Analyze the following website text, focusing on these key points:

1. Problem: What problem does the product/service solve?
2. Solution: How does it solve the problem? Features and benefits?
3. Target Customers: Who are the ideal customers?
4. Use Cases: Provide real-world examples of product/service usage.

Website Text:
${text}`;

  try {
    const chatStreamResponse = await client.chatStream({
      model: 'mistral-tiny',
      messages: [{ role: 'user', content: prompt }],
    });

    let aiResponse = '';
    for await (const chunk of chatStreamResponse) {
      if (chunk.choices[0].delta.content !== undefined) {
        aiResponse += chunk.choices[0].delta.content;
      }
    }

    return aiResponse;
  } catch (error) {
    console.error('Mistral API Error:', error.message);
    throw new Error('An error occurred while communicating with the Mistral API');
  }
}

app.listen(port, () => {
  console.log(`Proxy server running at http://localhost:${port}`);
});
