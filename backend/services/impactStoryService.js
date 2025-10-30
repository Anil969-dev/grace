const ImpactStory = require("../models/impactStory");
const { GoogleGenAI } = require("@google/genai");
const dotenv = require("dotenv");

dotenv.config();

async function generateAIStoryDescription(userInput) {
    try {
        const ai = new GoogleGenAI({
            apiKey: process.env.GEMINI_API_KEY,
        });

        const aiResponse = await ai.models.generateContent({
            model: "gemini-2.5-flash-lite",
            contents: `Act as a compassionate storyteller. Your task is to transform a user's description of an event into a short, emotional, and gentle impact story. This story should highlight the positive change or effect that resulted from the action described.
                Based on the user's input, you must:
                1.  **Create a Title:** A short, inspiring title for the impact story.
                2.  **Write the Impact Story (as 'content'):** This should be the core of the output.
                    *   **Tone:** Gentle, emotional, and heartwarming.
                    *   **Focus:** Emphasize the "why" and the positive outcome—how the action helped someone or something.
                    *   **Length:** Strictly between 20 and 25 words.
                3.  **Determine a Category:** A single, relevant category word for this type of story (e.g., "Community," "Environment," "Animal Welfare").
                4.  **Tense:** Use the past tense to describe the event.
                5. **Fallback:** If the user input is not sufficient to generate a meaningful story, return a default message indicating that more information is needed.

                **CRITICAL:** You must format your entire response as a single, valid JSON object. Do not include any text or markdown formatting before or after the JSON object.

                **Here is an example of the desired output structure:**
                {
                  "title": "A Shoreline's Second Chance",
                  "content": "Our small group gathered to clean the beach, and with every piece of trash removed, we felt the coastline breathe a sigh of relief.",
                  "category": "Environment"
                }
                ---
                **User Input:** "${userInput}"
                ---
        `,
        });

        const aiData = await aiResponse.text;
        const cleanedAiData = aiData.replace(/```json\n|\n```/g, "").trim();
        const result = JSON.parse(cleanedAiData);

        return result;
    } catch (error) {
        throw error;
    }
}

async function createImpactStory(data) {
    try {
        const impactStory = new ImpactStory(data);
        await impactStory.save();
        return impactStory;
    } catch (error) {
        throw error;
    }
}

async function readImpactStories(filter = {}) {
    try {
        const impactStories = await ImpactStory.find(filter);
        return impactStories;
    } catch (error) {
        throw error;
    }
}

async function readLatestImpactStories(count = 3) {
    const latestStories = await ImpactStory.find({})
        .sort("-createdAt")
        .limit(count);

    return latestStories;
}

async function updateImpactStory(filter = {}, data = {}) {
    try {
        const impactStory = await ImpactStory.findOneAndUpdate(filter, data, {
            new: true,
        });
        return impactStory;
    } catch (error) {
        throw error;
    }
}

async function deleteImpactStory(filter = {}) {
    try {
        await ImpactStory.deleteOne(filter);
    } catch (error) {
        throw error;
    }
}

module.exports = {
    generateAIStoryDescription,
    createImpactStory,
    readImpactStories,
    readLatestImpactStories,
    updateImpactStory,
    deleteImpactStory,
};
