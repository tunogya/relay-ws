import { Handler, SNSEvent, SNSEventRecord } from "aws-lambda";
import { connectToDatabase } from "../utils/astradb";
import openai from "../utils/openai";
// @ts-ignore
import { verifyEvent } from "nostr-tools/pure";

/**
 * xray_content
 * only listen kind = 1
 */
export const handler: Handler = async (event: SNSEvent, context) => {
  const records = event.Records;

  const { db } = await connectToDatabase();

  const processRecord = async (record: SNSEventRecord) => {
    try {
      const _event = JSON.parse(record.Sns.Message);
      const isValid = verifyEvent(_event);

      if (!isValid) {
        return;
      }

      if (_event.kind !== 1) {
        return;
      }

      if (!_event.content) {
        return;
      }

      const PROMPT = `You need to analyze and process the user's input content, which generally falls into the following categories: Emotions, People, Objects, Characters, Places, Themes, Actions, etc. The values ​​of Emotions are: Balance, Calm, Concentration, Confidence, Content, Determination, Indifference, Peace, Admiration, Compassion, Curiosity, Desire, Excitement, Friendship, Gratitude, Love, Lust, Amusement, Courage, Delight, Domination, Euphoria, Humour, Inspiration, Joy, Pride, Relief, Satisfaction, Apprehension, Fear, Fragility, Horror, Mistrust, Panic, Subservience, Surprise, Agitation, Anger, Cruelty, Destruction, Frustration, Hatred, Jealousy, Vengeance, Anxiety, Discouragement, Loneliness, Negligence, Nostlgia, Pain, Pity, Sadness, Awkawrdness, Boredom, Confusion, Disgust, Guilt, Humiliation, Lost, Regret, Shame. The value of Objects is not limited. The value of People is the name of the person who appears in the content. Unlike People, Characters do not need to write names, but are expressed through occupations and relationships, such as Boyfriend, Dog, Neighbor, Dragon, etc. Place is the place where the content appears, such as Airport, Beach, Asia, Heaven, Road, etc. Themes is the theme of the content, such as Addiction, Family, Music, Video game, etc. Action is action, such as Running, Being naked, Writing exams, Camping, etc. Except for People's names, everything else needs to be standardized in English. The return value is json. Such as {"emotions": ["Balance", "Calm"], "people": ["Alice"], "objects": ["Stars", "Tattoos"], "characters": ["Boyfriend", " Dog"], "places": ["Airport"], "themes": ["Addiction"], "actions": ["Running"]}.`;

      const request = await openai.chat.completions.create({
        messages: [
          {
            role: "system",
            content: PROMPT,
          },
          {
            role: "user",
            content: _event.content,
          },
        ],
        model: "gpt-3.5-turbo",
        temperature: 0.2,
        user: _event.pubkey,
        response_format: {
          type: "json_object",
        },
      });

      const reply = request.choices[0].message.content;

      if (!reply) {
        return;
      }

      const data = JSON.parse(reply);

      const queue = [];

      for (const [key, value] of Object.entries(data)) {
        if (!value) {
          continue;
        }
        // @ts-ignore
        for (const item of value) {
          queue.push({
            id: _event.id,
            pubkey: _event.pubkey,
            key: key,
            value: item,
          });
        }
      }

      await db.collection("contents").insertMany(queue);
    } catch (_) {
      throw new Error("Intentional failure to trigger DLQ");
    }
  };

  await Promise.all(records.map(processRecord));

  console.log(`Successfully processed ${records.length} records.`);
  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ success: true }),
  };
};
