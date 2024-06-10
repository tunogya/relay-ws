export const convertTagsToDict = (tags: Array<any>) => {
  const tagsDict = {};

  tags.forEach((tag) => {
    if (tag.length === 0) {
      return;
    }
    // @ts-ignore
    const key = tag[0];
    // @ts-ignore
    tagsDict[key] = tag.slice(1);
  });

  return tagsDict;
};
