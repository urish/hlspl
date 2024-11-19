# HLSPL

Assembler for SPELL, a simple 8-bit stack-based virtual machine from [The Skull CTF](https://skullctf.com/).

## Usage

```shell
npx tsx src/main [-o output] [-f format] input.spl
```

### Options

- `-o output`: Output file. Default: write to stdout.
- `-f format`: Output format. Default: `c`. Available formats:
  - `c`: C code.
  - `defines`: List of defines for program constants and labels.
  - `bytes`: List of bytes in JSON format.
  - `hex`: List of bytes in hexadecimal (space separated).

## Example program

The following program blinks and LED connected to the `uio[0]` pin connected to [Tiny Tapeout 6 Demo Board](https://tinytapeout.com/runs/tt06):

```
.ORIGIN 0

CONST PINB 0x36
CONST DDRB 0x37

  PUSH 1       ; Set uio[0] as output
  WRITE DDRB
:Loop
  PUSH 1
  WRITE PINB   ; Toggle uio[0]
  DELAY 250
  JMP @Loop
```

For more examples, see the [examples](examples/) directory.

## Assembler Language Syntax

1. Comments start with `;` and end at the end of the line.
2. Labels are defined by a colon, followed by the label name (e.g. `:Start`). Labels must be unique. When referenced, labels are prefixed with an at sign (e.g. `@Start`).
3. Instructions are written in uppercase, followed by up to one optional argument (e.g. `PUSH 0`). The argument is separated from the instruction by a space.
4. Arguments can be either a number or a label. Numbers can be decimal, hexadecimal (prefixed with `0x`), or binary (prefixed with `0b`).
5. The argument is optional for all instructions, except for `PUSH`. If the argument is omitted, the instruction will use the top value from the stack.

### Stack Instructions

- `PUSH <value>`: Push a value to the stack.
- `DUP`: Duplicate the top value of the stack.
- `XCHG`: Swap the top two values of the stack.

### Arithemetic Instructions

Binary arithmetic instructions operate on the top two values of the stack: the first value is the left operand, and the second value is the right operand. The result is pushed back to the stack.

- `ADD [value]`: Add the two values.
- `SUB [value]`: Subtract the first value from the second.
- `XOR [value]`: Perform a bitwise XOR operation.
- `AND [value]`: Perform a bitwise AND operation.
- `OR  [value]`: Perform a bitwise OR operation.

Unary arithmetic instructions operate on the top value of the stack, and push the result back to the stack.

- `SHL`: Shift the second value left by the first value.
- `SHR`: Shift the second value right by the first value.


## Control Flow Instructions

- `JMP [label]`: Jump to a label.
- `LOOP [label]`: Pop a value from the stack, and compare it to zero. If the value is not zero, decrement it and jump to the given label. If the value is zero, continue to the next instruction.
- `CALL1 [label]`: Pushes the address of the next instruction to the stack, and jumps to a label.
- `CALLX [label]`: Same as `CALL1`, first exchanging the top two values of the stack (emitting a `XCHG` instruction).

### I/O Instructions

- `READ [addr]`: Reads a byte from the data memory and pushes it to the stack.
- `WRITE [addr]`: Pops a value from the stack and writes it to the data memory.
- `EREAD [addr]`: Reads a byte from the program memory and pushes it to the stack.  
- `EWRITE [addr]`: Pops a value from the stack and writes it to the program memory. This enables self-modifying code.

### Runtime Instructions

- `DELAY [value]`: Delay execution for a number of milliseconds.
- `SLEEP`: Sleep until an external event occurs (e.g. key press).
- `STOP`: Stop execution.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
