export function parseArgs(args: string[]): Record<string, string> {
  const result: Record<string, string> = {};
  let currentKey = '';
  let currentValue = '';
  let inQuotes = false;

  for (const arg of args) {
    if (arg.startsWith('--')) {
      if (inQuotes) {
        currentValue += ' ' + arg;
        continue;
      }
      if (currentKey) result[currentKey] = currentValue.trim();
      const keyParts = arg.substring(2).split('=');
      currentKey = keyParts[0];
      if (keyParts.length > 1) {
        currentValue = keyParts.slice(1).join('=');
        if (currentValue.startsWith('"') && !currentValue.endsWith('"')) {
          inQuotes = true;
          currentValue = currentValue.substring(1);
        } else if (currentValue.startsWith('"') && currentValue.endsWith('"')) {
          currentValue = currentValue.substring(1, currentValue.length - 1);
        }
      } else {
        currentValue = '';
      }
    } else {
      if (currentValue) {
        if (inQuotes) {
          currentValue += ' ' + arg;
          if (arg.endsWith('"')) {
            inQuotes = false;
            currentValue = currentValue.substring(0, currentValue.length - 1);
          }
        } else {
          currentValue += ' ' + arg;
        }
      } else {
        currentValue = arg;
      }
    }
  }
  if (currentKey) result[currentKey] = currentValue.trim();
  return result;
}