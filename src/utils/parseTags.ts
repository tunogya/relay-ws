// @ts-ignore
import { Event } from "nostr-tools/core";

export const parseEventTags = (event: Event) => {
  let tagsArray = [];
  for (const tag of event.tags) {
    const length = tag.length;
    if (length < 2) {
      continue;
    }
    const item: any = {
      id: event.id,
    };
    for (let i = 0; i < length; i++) {
      item[`tag${i}`] = tag[i];
    }
    tagsArray.push(item);
  }
  return tagsArray;
};
