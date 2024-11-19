import fs from 'fs';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { formatSPLCode, HLSPL, SPLBytes } from './hlspl.js';

async function main() {
  const argv = await yargs(hideBin(process.argv))
    .option('output', {
      alias: 'o',
      type: 'string',
      description: 'Output file name',
    })
    .option('format', {
      alias: 'f',
      type: 'string',
      choices: ['bytes', 'c', 'defines', 'hex'],
      description: 'Output format',
      default: 'c',
    })
    .demandCommand(1, 'You need to provide the SPL source file name').argv;

  const inputFileName = argv._[0] as string;
  const outputFileName = argv.output;
  const format = argv.format;

  const data = fs.readFileSync(inputFileName, 'utf8');
  const result = HLSPL(data);

  let formattedResult: string;
  switch (format) {
    case 'c':
      formattedResult = formatSPLCode(result);
      break;
    case 'defines':
      formattedResult = result.defines.join('\n');
      break;
    case 'bytes':
      formattedResult = JSON.stringify(SPLBytes(result));
      break;
    case 'hex':
      formattedResult = SPLBytes(result)
        .map((byte) => byte.toString(16).padStart(2, '0'))
        .join(' ');
      break;
    default:
      console.error(`Invalid format: ${format}. Use 'c', 'defines', or 'bytes'`);
      process.exit(1);
  }

  if (outputFileName) {
    fs.writeFileSync(outputFileName, formattedResult, 'utf8');
  } else {
    console.log(formattedResult);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
