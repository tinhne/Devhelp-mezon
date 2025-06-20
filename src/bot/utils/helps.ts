export function extractMessage(message: string) {
  // Xử lý cả ba loại tiền tố *, / và \, cũng như trường hợp không có tiền tố
  let prefix = '';
  let cleanMessage = message;
  let commandName = '';
  let args: string[] = [];
  
  // Kiểm tra nếu là lệnh active mà không có tiền tố
  if (message === 'active') {
    return ['active', []];
  }
  
  // Kiểm tra và loại bỏ tiền tố
  if (message.startsWith('*')) {
    prefix = '*';
    cleanMessage = message.slice('*'.length);
  } else if (message.startsWith('/')) {
    prefix = '/';
    cleanMessage = message.slice('/'.length);
  } else if (message.startsWith('\\')) {
    prefix = '\\';
    cleanMessage = message.slice('\\'.length);
  } else if (message === 'activate' || message === 'deactivate' || message === 'botstatus' || 
             message.startsWith('activate ') || message.startsWith('deactivate ') || 
             message.startsWith('botstatus ')) {
    // Đặc biệt xử lý các lệnh không có tiền tố nhưng cần được nhận dạng
    prefix = '';
    cleanMessage = message;
  } else {
    return [false, []]; // Không có tiền tố hợp lệ và không phải lệnh đặc biệt
  }
  
  // Xử lý các đối số
  const argParts = cleanMessage.replace('\n', ' ').trim().split(/ +/);
  
  if (argParts.length > 0) {
    commandName = argParts.shift()?.toLowerCase() || '';
    args = argParts;
    return [commandName, args];
  } else {
    return [false, []];
  }
}

export async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function getRandomColor(): string {
  const colors: string[] = [
    '#1ABC9C', // Aqua
    '#11806A', // DarkAqua
    '#57F287', // Green
    '#1F8B4C', // DarkGreen
    '#3498DB', // Blue
    '#206694', // DarkBlue
    '#9B59B6', // Purple
    '#71368A', // DarkPurple
    '#E91E63', // LuminousVividPink
    '#AD1457', // DarkVividPink
    '#F1C40F', // Gold
    '#C27C0E', // DarkGold
    '#E67E22', // Orange
    '#A84300', // DarkOrange
    '#ED4245', // Red
    '#992D22', // DarkRed
    '#BCC0C0', // LightGrey
    '#FFFF00', // Yellow
  ];
  const randomIndex = Math.floor(Math.random() * colors.length);
  return colors[randomIndex] || '#F1C40F';
}