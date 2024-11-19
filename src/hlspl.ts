const DEFAULT_ORIGIN = 16;

const oneOperand = {
  ADD: '+',
  SUB: '-',
  XOR: '^',
  OR: '|',
  AND: '&',
  DELAY: ',',
  JMP: '=',
  LOOP: '@',
  READ: 'r',
  WRITE: 'w',
  EREAD: '?',
  EWRITE: '!',
};

const simple = {
  SHL: '<',
  SHR: '>',
  DUP: '2',
  XCHG: 'x',
  SLEEP: 'z',
};

const opCodes = ',><=@&|^+-2?!rwxz';

interface ISymbols {
  [key: string]: string;
}

export interface IHLSPLResult {
  origin: number;
  code: string[];
  defines: string[];
}

function immediate(value: string, symbols: ISymbols, makeError: (msg: string) => Error) {
  if (value[0] === '@') {
    return 'LABEL_' + value.substring(1);
  }
  if (symbols[value] != null) {
    return `${symbols[value]} /* ${value} */`;
  }
  const intValue = parseInt(value);
  if (isNaN(intValue) || intValue >= 256) {
    throw makeError('Invalid int value: ' + value);
  }
  if (opCodes.includes(String.fromCharCode(intValue))) {
    throw makeError('PUSH reserved value: ' + value);
  }
  return value;
}

export function HLSPL(source: string): IHLSPLResult {
  const code: string[] = [];
  let lineNumber = 0;
  const symbols: Record<string, string> = {};
  let offset = 0;
  let origin = DEFAULT_ORIGIN;
  for (const line of source.split('\n')) {
    lineNumber++;
    const makeError = (message: string) => new Error(`Line ${lineNumber}: ${message}`);
    const trimmed = line.trim();
    const comment = trimmed.replace(/.*?($|;|\/\/)/, '');
    const [cmdOrig, ...args] = trimmed
      .replace(/(;|\/\/).+/, '')
      .trim()
      .split(/\s+/);
    const emitCommand = (value: string, main = true) => {
      offset++;
      const commentText = main && comment ? `       // ${comment.trim()}` : '';
      code.push(`${value},${commentText}`);
    };
    const cmd = cmdOrig.toUpperCase();
    if (cmd === '') {
      code.push(comment ? '// ' + comment.trim() : '');
    } else if (cmd === '.ORIGIN') {
      origin = parseInt(args[0]);
      symbols['SPELL_ORIGIN'] = origin.toString();
    } else if (cmd === 'CONST') {
      if (args.length !== 2) {
        throw makeError(`Invalid number of arguments to ${cmd}`);
      }
      const [name, value] = args;
      if (symbols[name] != null) {
        throw makeError(`Constant ${name} already defined`);
      }
      symbols[name] = value;
    } else if (cmd === 'PUSH') {
      if (args.length !== 1) {
        throw makeError(`Invalid number of arguments to ${cmd}`);
      }
      emitCommand(immediate(args[0], symbols, makeError));
    } else if (cmd === 'CALL1' || cmd === 'CALLX') {
      if (args.length < 1 || args.length > 2) {
        throw makeError(`Invalid number of arguments to ${cmd}`);
      }
      if (cmd === 'CALLX') {
        emitCommand(`'x'`, false);
      }
      const padding = args.length === 2 ? parseInt(args[1], 10) : 0;
      const returnAddr = immediate((offset + 3 + origin + padding).toString(), symbols, makeError);
      emitCommand(returnAddr); // Return address
      // exchange argument and return address
      const temp = code[code.length - 1];
      code[code.length - 1] = code[code.length - 2];
      code[code.length - 2] = temp;
      emitCommand(immediate(args[0], symbols, makeError), false);
      emitCommand(`'='`);
      for (let i = 0; i < padding; i++) {
        emitCommand('0 /* pad */', false);
      }
    } else if (cmd === 'STOP') {
      emitCommand('0xff'); // Return address
    } else if (cmd in oneOperand) {
      if (args.length > 1) {
        throw makeError(`Too many arguments to ${cmd}`);
      }
      if (args.length === 1) {
        emitCommand(immediate(args[0], symbols, makeError), false);
      }
      emitCommand(`'${oneOperand[cmd as keyof typeof oneOperand]}'`);
    } else if (cmd in simple) {
      emitCommand(`'${simple[cmd as keyof typeof simple]}'`);
      if (args.length > 0) {
        throw makeError(`Too many arguments to ${cmd}`);
      }
    } else if (cmd[0] === ':') {
      const label = cmdOrig.substring(1);
      const value = offset + origin;
      if (opCodes.includes(String.fromCharCode(value))) {
        throw makeError(`Label value ${value} translates to an opcode: ${label}`);
      }
      symbols[`LABEL_${label}`] = value.toString();
      code.push('// ' + trimmed);
      continue;
    } else {
      throw makeError(`Unknown command: ${cmd}`);
    }
  }

  const defines = [];
  for (const [symbol, value] of Object.entries(symbols)) {
    defines.push(`#define ${symbol} ${value}`);
  }
  return { origin, defines, code };
}

export function formatSPLCode({ origin, defines, code }: IHLSPLResult) {
  const lines = code.map((line) => (line.startsWith('//') ? line : '  ' + line));
  while (lines[0].trim() == '') {
    lines.shift();
  }
  if (origin > 0) {
    lines.unshift('  ' + '0, '.repeat(origin).trim());
  }

  return `${defines.join('\n')}

uint8_t program[256] = {
${lines.join('\n')}
};
`;
}

export function SPLBytes({ defines, code }: IHLSPLResult) {
  const defineMap: { [key: string]: number } = {};
  for (const item of defines) {
    const parts = item.trim().split(' ');
    if (parts[0] === '#define') {
      defineMap[parts[1]] = parseInt(parts[2]);
    }
  }
  return code
    .map((line) => {
      const bare = line
        .trim()
        .replace(/\/\/.+$|\/\*.+?\*\//g, '')
        .replace(/,\s*$/, '')
        .trim();
      if (bare === '') {
        return null;
      }
      if (defineMap[bare]) {
        return defineMap[bare];
      }
      if (/^(0x[0-9a-f]+|[0-9]+)$/i.test(bare) && !isNaN(parseInt(bare))) {
        return parseInt(bare);
      }
      if (/^0b[01]+$/i.test(bare)) {
        return parseInt(bare.substring(2), 2);
      }
      const charMatch = /'\\?(.)'/.exec(bare);
      if (charMatch) {
        return charMatch[1].charCodeAt(0);
      }
      throw new Error(`Invalid C-SPL input: ${line}`);
    })
    .filter((n) => n !== null) as number[];
}
