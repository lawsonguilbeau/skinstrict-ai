export function isBase64(value: string): boolean {
  const length = value.length;
  if (length === 0 || length % 4 !== 0) return false;

  let paddingLength = 0;
  if (value.charCodeAt(length - 1) === 61) {
    paddingLength = value.charCodeAt(length - 2) === 61 ? 2 : 1;
  }

  const contentLength = length - paddingLength;
  const expectedRemainder = paddingLength === 2 ? 2 : paddingLength === 1 ? 3 : 0;
  if (contentLength % 4 !== expectedRemainder) return false;

  for (let index = 0; index < contentLength; index += 1) {
    const code = value.charCodeAt(index);
    const isLetter = (code >= 65 && code <= 90) || (code >= 97 && code <= 122);
    const isDigit = code >= 48 && code <= 57;
    if (!isLetter && !isDigit && code !== 43 && code !== 47) return false;
  }

  return true;
}
