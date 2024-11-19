import { describe, expect, it } from 'vitest';
import { formatSPLCode, HLSPL, SPLBytes } from './hlspl';

describe('HLSPL', () => {
  it('should transform PUSH with parameters', () => {
    expect(HLSPL('PUSH 22').code).toEqual(['22,']);
  });

  it('should throw if PUSH gets a reserved value', () => {
    expect(() => HLSPL('PUSH 64')).toThrow('Line 1: PUSH reserved value: 64');
  });

  it('should throw if PUSH called without arguments', () => {
    expect(() => HLSPL('PUSH')).toThrow('Line 1: Invalid number of arguments to PUSH');
  });

  it('should transform ADD with parameters', () => {
    expect(HLSPL('ADD 10').code).toEqual(['10,', "'+',"]);
  });

  it('should transform XCHG command', () => {
    expect(HLSPL('XCHG').code).toEqual(["'x',"]);
  });

  it('should substitute constants', () => {
    // prettier-ignore
    const program = [
      'CONST ADDR_PIN 0x36', 
      'PUSH ADDR_PIN',
    ];
    expect(HLSPL(program.join('\n')).code).toEqual(['0x36 /* ADDR_PIN */,']);
  });

  it('Integration test', () => {
    const program = `
.ORIGIN 0

CONST PINA 0x39
CONST DDRA 0x3A
CONST PORTA 0x3B

; Configure the first 7 uo_out pins as outputs
  PUSH 127
  WRITE DDRA
:Start
  PUSH 0        ; null terminator
  PUSH 129      ; !
  PUSH 57       ; L
  PUSH 57       ; L
  PUSH 244      ; E (actually 122, hence we SHR next)
  SHR
  PUSH 116      ; P
  PUSH 109      ; S
:Wait
  DUP
  AND 0
  XOR
  WRITE PORTA
  DELAY 250
  PUSH 0
  WRITE PORTA
  DELAY 25
  LOOP @Wait
  JMP @Start
`;

    const splResult = HLSPL(program);
    const splBytes = SPLBytes(splResult);
    expect(splBytes).toEqual([
      127, 58, 119, 0, 129, 57, 57, 244, 62, 116, 109, 50, 0, 38, 94, 59, 119, 250, 44, 0, 59, 119,
      25, 44, 11, 64, 3, 61,
    ]);

    expect(formatSPLCode(splResult)).toEqual(
      `#define SPELL_ORIGIN 0
#define PINA 0x39
#define DDRA 0x3A
#define PORTA 0x3B
#define LABEL_Start 3
#define LABEL_Wait 11

uint8_t program[256] = {
// Configure the first 7 uo_out pins as outputs
  127,
  0x3A /* DDRA */,
  'w',
// :Start
  0,       // null terminator
  129,       // !
  57,       // L
  57,       // L
  244,       // E (actually 122, hence we SHR next)
  '>',
  116,       // P
  109,       // S
// :Wait
  '2',
  0,
  '&',
  '^',
  0x3B /* PORTA */,
  'w',
  250,
  ',',
  0,
  0x3B /* PORTA */,
  'w',
  25,
  ',',
  LABEL_Wait,
  '@',
  LABEL_Start,
  '=',
  
};
`,
    );
  });
});
