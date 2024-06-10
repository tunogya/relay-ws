const backOffSecond = (nonce: number) => {
  const factor = Math.random() * 0.2 + 1;
  return 2 ** nonce * factor;
};

export default backOffSecond;
